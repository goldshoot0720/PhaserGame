# v1.0.0 驗證紀錄

- 12 款 Phaser Game Agent 最新原始碼完成型別檢查與 343 項規則測試，全部通過。各雲端版本見 `cloud-mobile-verification.json`。
- 12 款於 Chrome 的手機觸控環境（390×844、844×390）實際進入遊戲，檢查多點觸控、釋放按鍵、暫停、靜音與離線資源載入，全數通過；詳細結果見 `mobile-verification.json`。測試封鎖非本機來源。
- 戰棋另外以快速點按選出四名隊員後進入戰鬥，用於驗證短觸控保留修正。
- 合集在桌機及手機檢查搜尋、啟動、暫停、指南開關與恢復、重玩；見 `shell-verification.json`。
- 本機素材檢查：108 個檔案；12 個完整遊戲包的 SHA-256 與來源紀錄一致；指南、攻略與共用手機控制均完整。
- 本機備用版本的 57 項規則測試與 3 項輸入／效果測試通過。
- Android 15 ARM64 模擬器成功安装簽署 APK、離線開啟合集、觸控進入棒球對局，旋轉後保留對局，確認 WebGL 2 後備渲染與系統安全邊界。未涵蓋所有 Android 廠牌實機。
- APK 通過 apksigner v2/v3 驗證，所有網站檔案逐一比對一致。
- Windows ZIP 通過 CRC，EXE 為有效 AMD64 PE；封裝內 12 個遊戲包與 108 個素材的雜湊一致。
- Windows EXE 未在 Windows 主機實際執行，亦未使用 Authenticode 憑證簽署；不把封裝檢查視為 Windows 執行測試。

可重跑工具：`npm run check`、`node tools/verify-mobile.mjs`、`node tools/verify-shell.mjs`、`node tools/verify-release.mjs`。瀏覽器測試預設使用 http://127.0.0.1:8790，需先以 `PORT=8790 npm run dev` 啟動。
