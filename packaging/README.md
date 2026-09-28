# 發行包

完整合集使用 `Game1–Game12/complete` 的 Phaser Game Agent 遊戲包，保留原引擎授權與全部遊戲程式；美術與音樂隨附於 `shared/media`。不抽取或獨立散布引擎。

## Android

`node tools/stage-release.mjs && python3 tools/build-android.py`

需 JDK 21、Android SDK platform 35 與 build-tools 35.0.1；可以 `--java`、`--sdk` 指定路徑。APK 支援 Android 8.0 以上與 WebGL 2，內建 WebView 以 HTTPS 本機資源來源載入遊戲，不需要網路或外部檔案權限。

簽署金鑰與密碼保存在 `~/.local/share/moe-game-collection/signing/`，不進 Git；後續更新必須沿用並妥善備份該資料夾。

## Windows

```sh
node tools/stage-release.mjs
node tools/stage-windows.mjs
npm ci --prefix packaging/windows
npm run package --prefix packaging/windows
```

產生 Windows x64 ZIP，完整解壓後執行 `MoeGameCollection.exe`。ZIP 內其他檔案為必要依賴，不能只移動 EXE。程式使用 Electron 沙箱與隔離內容環境，以本機 HTTP 伺服器載入離線合集。此版本未使用 Windows Authenticode 憑證簽署。

產物位於 `release/`，經檢查後上傳 GitHub Releases。
