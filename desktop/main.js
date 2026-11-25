// VMPlayer 桌面版主程序：兩個影片來源（mp = MPlayer、vh = VidHub）共用一個視窗，
// 介面頁面依目前來源載入 src/mp 或 src/vh，切換時整頁換掉（各自的資料、下載都分開存）。
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron')
const path = require('path')
const settings = require('./vh/site') // settings.json：視窗位置、目前來源、略過的版本，以及 vh 的網址設定
const source = require('./vh/source')
const vhDownloads = require('./vh/downloads')
const fetcher = require('./mp/fetcher')
const mpDownloads = require('./mp/downloads')
const state = require('./state')
const updater = require('./updater')

const APP_NAME = 'VMPlayer'
const TEST = process.env.VMPLAYER_TEST === '1'
// 用一般 Chrome 的 UA，網站對 Electron 字樣的 UA 可能會擋
app.userAgentFallback = source.UA

// 看過的縮圖和影片片段不存磁碟快取，userData 才不會越看越大（同一次執行裡還是有記憶體快取）
app.commandLine.appendSwitch('disable-http-cache')
// 滑過縮圖的預覽短片不用先點頁面也能播
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// 播放用的 vh:// 代理要在 app ready 之前登記
source.registerScheme()

const SOURCES = ['mp', 'vh']
const currentSource = () => (SOURCES.includes(settings.get('source')) ? settings.get('source') : 'mp')
const pageOf = (s) => path.join(__dirname, 'src', s, 'index.html')

/** 刪掉以前留下的快取資料夾。一定要在 app ready 之前做，ready 之後 Chromium 已經開著這些檔案 */
function removeOldCaches() {
  const ofs = require('original-fs')
  const ud = app.getPath('userData')
  for (const n of ['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'GrShaderCache', 'ShaderCache']) {
    try {
      ofs.rmSync(path.join(ud, n), { recursive: true, force: true })
    } catch {}
  }
}

let win = null

function createWindow() {
  const b = settings.get('bounds') || {}
  win = new BrowserWindow({
    width: b.width || 1400,
    height: b.height || 900,
    x: b.x,
    y: b.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f13',
    title: APP_NAME,
    icon: path.join(__dirname, 'src', 'icon.png'),
    autoHideMenuBar: true,
    // 自動測試時不要跳出視窗
    show: !TEST,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })
  win.removeMenu()
  if (b.maximized && !TEST) win.maximize()
  win.loadFile(pageOf(currentSource()))

  const wc = win.webContents
  // 介面裡沒有要開新視窗的地方；萬一有就用系統瀏覽器
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  wc.on('will-navigate', (e) => e.preventDefault())
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F12') wc.toggleDevTools()
    else if (input.key === 'F11') win.setFullScreen(!win.isFullScreen())
    else if (input.key === 'F5') wc.reload()
    else if (input.control && (input.key === '=' || input.key === '+')) wc.setZoomLevel(wc.getZoomLevel() + 0.5)
    else if (input.control && input.key === '-') wc.setZoomLevel(wc.getZoomLevel() - 0.5)
    else if (input.control && input.key === '0') wc.setZoomLevel(0)
    else return
    e.preventDefault()
  })
  // 滑鼠側鍵：交給介面處理「上一步」
  win.on('app-command', (_e, cmd) => {
    if (cmd === 'browser-backward') wc.send('nav:back')
  })

  win.on('close', () => {
    const maximized = win.isMaximized()
    settings.set('bounds', { ...(maximized ? settings.get('bounds') : win.getNormalBounds()), maximized })
  })
  // 主視窗關掉就結束程式。網站驗證用的隱藏視窗還在的話不會觸發 window-all-closed，
  // 程式會留在背景，再開一次時被「只能開一份」擋住，看起來就是開不起來
  win.on('closed', () => app.quit())
}

function setupIpc() {
  // ---- 共用 ----
  ipcMain.handle('shell:external', (_e, url) => /^https?:/.test(url) && shell.openExternal(url))
  ipcMain.handle('win:fullscreen', (_e, on) => {
    if (win && !win.isDestroyed()) win.setFullScreen(on === undefined ? !win.isFullScreen() : !!on)
    return win?.isFullScreen() || false
  })
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.on('app:versionCode', (e) => {
    e.returnValue = app.isPackaged ? updater.currentCode() : 0
  })
  ipcMain.handle('update:check', () => checkUpdate(true))
  ipcMain.handle('app:switch', () => {
    const next = currentSource() === 'mp' ? 'vh' : 'mp'
    settings.set('source', next)
    if (win && !win.isDestroyed()) {
      if (win.isFullScreen()) win.setFullScreen(false)
      win.loadFile(pageOf(next))
    }
    return next
  })

  // ---- mp ----
  ipcMain.handle('net:get', (_e, url) => fetcher.get(url))
  ipcMain.handle('net:media', (_e, url) => fetcher.allowMedia(url))
  ipcMain.handle('net:api', (_e, method, url, json) => fetcher.api(method, url, json))
  ipcMain.handle('net:logout', () => fetcher.logout())
  ipcMain.handle('site:base', () => fetcher.BASE)

  // ---- vh ----
  ipcMain.handle('vsite:page', (_e, p) => source.page(String(p)))
  ipcMain.handle('vsite:base', () => ({ base: settings.base(), isDefault: !settings.get('base') }))
  ipcMain.handle('vsite:setBase', (_e, input) => {
    const b = input ? settings.normalizeBase(input) : ''
    settings.set('base', b === settings.DEFAULT_BASE ? '' : b)
    return settings.base()
  })
}

// ---------- 程式內更新 ----------
let updating = false

/** 回傳 'latest' | 'shown' | 'error' | 'busy' */
async function checkUpdate(manual = false) {
  if (updating) return 'busy'
  let r
  try {
    r = await updater.latest()
  } catch (e) {
    if (manual) dialog.showMessageBox(win, { type: 'error', title: APP_NAME, message: '檢查更新失敗', detail: String(e.message || e) })
    return 'error'
  }
  const now = updater.currentCode()
  if (!r || r.code <= now) {
    if (manual) dialog.showMessageBox(win, { type: 'info', title: APP_NAME, message: '已經是最新版本', detail: `目前版本 v${app.getVersion()}` })
    return 'latest'
  }
  if (!manual && settings.get('skipVersion') === r.code) return 'latest'
  const busy = mpDownloads.busy() || vhDownloads.busy()
  const choice = dialog.showMessageBoxSync(win, {
    type: 'info',
    title: APP_NAME,
    message: `發現新版本 v1.0.${r.code}（目前 v${app.getVersion()}）`,
    detail: (r.notes ? `更新內容：\n${r.notes}` : '') + (busy ? '\n\n還有影片在下載，更新後會自動從中斷的地方繼續。' : ''),
    buttons: updater.supported() ? ['立即更新', '稍後再說', '略過這個版本'] : ['開啟下載頁面', '稍後再說', '略過這個版本'],
    defaultId: 0,
    cancelId: 1,
  })
  if (choice === 2) settings.set('skipVersion', r.code)
  if (choice !== 0) return 'shown'
  if (!updater.supported()) {
    shell.openExternal(r.url)
    return 'shown'
  }

  updating = true
  try {
    await updater.prepare(r.url, (p) => {
      if (win.isDestroyed()) return
      win.setProgressBar(p >= 0 ? p / 100 : 2)
      win.setTitle(`${APP_NAME} - 下載更新 ${p >= 0 ? p + '%' : '…'}`)
    })
    win.setProgressBar(-1)
    dialog.showMessageBoxSync(win, { type: 'info', title: APP_NAME, message: '更新已下載完成', detail: '按「確定」後程式會關閉並安裝新版，完成後自動重新開啟。', buttons: ['確定'] })
    updater.install()
  } catch (e) {
    updating = false
    if (!win.isDestroyed()) {
      win.setProgressBar(-1)
      win.setTitle(APP_NAME)
    }
    dialog.showMessageBox(win, { type: 'error', title: APP_NAME, message: '更新失敗', detail: String(e.message || e) })
  }
  return 'shown'
}

// 同時只開一份：再開一次就把原本的視窗叫到前面（兩份同時跑下載會打架）
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  removeOldCaches()
  app.on('second-instance', () => {
    if (!win || win.isDestroyed()) {
      // 主視窗已經關掉（程式正在結束或卡在背景）：重新開一個
      if (app.isReady() && !app.isQuitting) createWindow()
      return
    }
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    state.create('state', 'state.json').setup()
    state.create('vstate', 'vh-state.json').setup()
    fetcher.init(source.UA)
    source.setupProtocol()
    mpDownloads.setup()
    vhDownloads.setup()
    setupIpc()
    createWindow()
    updater.cleanup()
    if (!TEST && app.isPackaged) setTimeout(() => checkUpdate(false), 5000)
  })

  app.on('window-all-closed', () => app.quit())
}

module.exports = { get win() { return win } }
