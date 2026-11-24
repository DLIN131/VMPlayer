# VMPlayer

把 MPlayer 和 VidHub 合併成一個 App：兩個影片來源放在同一個程式裡，隨時切換。有手機版、電視版和 Windows 電腦版，全部用自己的介面瀏覽和播放（不開網站本身，網站的廣告和彈出視窗不會載入）。

| 版本 | 檔案 | 說明 |
| --- | --- | --- |
| 手機版（Android） | `VMPlayer.apk` | Jetpack Compose + Media3 ExoPlayer |
| 電視版（Android TV） | `VMPlayerTV.apk` | 遙控器操作，針對電視盒子最佳化 |
| 電腦版（Windows） | `VMPlayer-Windows.zip` | Electron + hls.js，解壓後執行 `VMPlayer.exe` |

## 下載

永遠是最新版：

- 手機版：https://github.com/DLIN131/VMPlayer/releases/latest/download/VMPlayer.apk
- 電視版：https://github.com/DLIN131/VMPlayer/releases/latest/download/VMPlayerTV.apk
- 電腦版：https://github.com/DLIN131/VMPlayer/releases/latest/download/VMPlayer-Windows.zip

電腦版解壓縮到任意資料夾（建議桌面或文件，不要放在 Program Files）後執行 `VMPlayer.exe`。

## 切換來源

- 手機：首頁標題列右邊的「⇄ VidHub」／「⇄ MPlayer」
- 電視：側邊選單最下面的「切換到 …」
- 電腦：上方標題旁的「⇄ VidHub」／「⇄ MPlayer」

程式會記住上次用的來源。兩個來源的收藏、觀看紀錄、播放進度、下載清單都各自分開存。

## 兩個來源的功能

**MPlayer**：多種分類與排序、搜尋（番號、演員、標題）、演員一覽、用番號查女優、長按封面預覽、選畫質播放與下載、網站帳號登入（收藏與觀看紀錄跨裝置同步）。

**VidHub**：首頁精選、影片庫、劇集（選集、記住看到第幾集、自動接下一集）、分類、搜尋、網址設定、影片下載（離線播放）。

兩邊共用：播放器手勢與快捷鍵、自動記住播放進度、背景下載可暫停／續傳（電腦版完成後轉成 MP4）、程式內更新。

## 專案結構

```
android/
  core/    共用：com.vmplayer（App、目前來源、更新）
           com.vmplayer.mp（MPlayer 來源的抓取、解析、下載…）
           com.vmplayer.vh（VidHub 來源的抓取、解析、下載…）
  phone/   手機版：com.vmplayer.app 外殼 + mp/phone、vh/phone 兩套介面
  tv/      電視版：com.vmplayer.tv 外殼 + mp/tv、vh/tv 兩套介面
desktop/
  main.js  主程序（視窗、切換來源、更新）
  mp/ vh/  兩個來源的網路與下載（主程序）
  src/mp/ src/vh/  兩個來源的介面頁面
```

## 建置

```bash
# Android
cd android && ./gradlew :phone:assembleRelease :tv:assembleRelease

# Windows
cd desktop && npm install && node pack.js dist
```

推送到 `main` 會由 GitHub Actions 建置三個版本並發布 Release（版本號 `v1.0.<建置編號>`），各版本的程式內更新都從最新 Release 取得。簽章金鑰放在 `android/keystore/`（不進版控）。
