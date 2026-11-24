// 頁面不能直接碰網路 session 和檔案，透過這裡呼叫主程序。
// 兩個來源各有自己的介面頁面（src/mp、src/vh），這裡依目前的頁面提供那個來源用的 window.hub，
// 兩邊的介面程式都不用改；IPC 頻道則分開命名（下載 dl: / vdl:、資料 state: / vstate:）。
const { contextBridge, ipcRenderer } = require('electron')

const isVh = /\/src\/vh\//.test(decodeURIComponent(location.pathname).replace(/\\/g, '/'))

/** 兩個來源共用：切換來源、全螢幕、外部連結、版本與更新 */
const common = {
  external: (url) => ipcRenderer.invoke('shell:external', url),
  fullscreen: (on) => ipcRenderer.invoke('win:fullscreen', on),
  version: () => ipcRenderer.invoke('app:version'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  onBack: (fn) => ipcRenderer.on('nav:back', () => fn()),
  /** 切換到另一個來源（整個介面換成另一個來源的頁面） */
  switchSource: () => ipcRenderer.invoke('app:switch'),
}

/** 下載 API：p = 'dl' 或 'vdl' */
const dl = (p) => ({
  list: () => ipcRenderer.invoke(`${p}:list`),
  /** 下載好的檔案網址；檔案已被刪除（或沒下載）回傳空字串 */
  local: (id) => ipcRenderer.sendSync(`${p}:local`, id),
  add: (v) => ipcRenderer.invoke(`${p}:add`, v),
  pause: (id) => ipcRenderer.invoke(`${p}:pause`, id),
  resume: (id) => ipcRenderer.invoke(`${p}:resume`, id),
  remove: (id, deleteFile) => ipcRenderer.invoke(`${p}:remove`, id, deleteFile),
  show: (id) => ipcRenderer.invoke(`${p}:show`, id),
  dir: () => ipcRenderer.invoke(`${p}:dir`),
  chooseDir: () => ipcRenderer.invoke(`${p}:chooseDir`),
  openDir: () => ipcRenderer.invoke(`${p}:openDir`),
  onUpdate: (fn) => ipcRenderer.on(`${p}:update`, (_e, j) => fn(j)),
  onRemoved: (fn) => ipcRenderer.on(`${p}:removed`, (_e, id) => fn(id)),
})

if (isVh) {
  contextBridge.exposeInMainWorld('hub', {
    ...common,
    // 收藏、觀看紀錄、播放進度存在主程序的 vh-state.json
    state: {
      all: () => ipcRenderer.sendSync('vstate:all'),
      set: (key, value) => ipcRenderer.send('vstate:set', key, value),
    },
    /** 抓網站某一頁的資料，例如 page('/v?order=viewCount&page=2') */
    page: (p) => ipcRenderer.invoke('vsite:page', p),
    base: () => ipcRenderer.invoke('vsite:base'),
    setBase: (url) => ipcRenderer.invoke('vsite:setBase', url),
    dl: dl('vdl'),
  })
} else {
  // 版本號（1.0.<CI 編號> 的最後一段；開發中是 0）
  contextBridge.exposeInMainWorld('APP_VERSION', Number(ipcRenderer.sendSync('app:versionCode')) || 0)
  contextBridge.exposeInMainWorld('hub', {
    ...common,
    // 程式資料（收藏、紀錄、播放進度、設定…）存在主程序的 state.json
    state: {
      all: () => ipcRenderer.sendSync('state:all'),
      set: (key, value) => ipcRenderer.send('state:set', key, value),
    },
    /** 抓網站頁面的 HTML（主程序處理 Cloudflare） */
    get: (url) => ipcRenderer.invoke('net:get', url),
    /** 播放前登記影片 CDN，讓它的請求補上網站的標頭 */
    media: (url) => ipcRenderer.invoke('net:media', url),
    /** 網站的 JSON API（登入、收藏、觀看記錄）：回傳 { status, text } */
    api: (method, url, json) => ipcRenderer.invoke('net:api', method, url, json),
    logout: () => ipcRenderer.invoke('net:logout'),
    base: () => ipcRenderer.invoke('site:base'),
    dl: { ...dl('dl'), options: (masterUrl) => ipcRenderer.invoke('dl:options', masterUrl) },
  })
}
