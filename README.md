# PhaserGame

本倉庫收錄使用八位萌友角色製作的 12 款 Phaser 遊戲。

## 線上版（Phaser Game Agent，12 款皆已發佈）

每款遊戲的雲端原始碼放在各自的 `GameN/cloud/`（`src/`、`spec/`，規則測試在 `src/verify.ts`）。引擎與建置工具在 Phaser Game Agent 雲端工作區，不含在倉庫中。

| 目錄 | 遊戲 | 類型 | 線上遊玩 |
| --- | --- | --- | --- |
| `Game1` | 萌友棒球對決 | 棒球 | [遊玩](https://phaser.io/agent/local/9rwJkwrCkfc) |
| `Game2` | 萌友街頭 3x3 | 3 對 3 籃球 | [遊玩](https://phaser.io/agent/local/qShMT5e7fmJ) |
| `Game3` | 萌友卡丁車 GP | 賽車 | [遊玩](https://phaser.io/agent/local/FjxcDnWNvMB) |
| `Game4` | 萌友洛克英雄 | 橫向動作 | [遊玩](https://phaser.io/agent/local/78wQyqoVoGi) |
| `Game5` | 萌友格鬥王 | 格鬥 | [遊玩](https://phaser.io/agent/local/furxwDwPzGM) |
| `Game6` | 萌友戰棋・八方對決 | 戰棋 | [遊玩](https://phaser.io/agent/local/pqEUqeub1aN) |
| `Game7` | 萌友大亂鬥 | 俯視射擊大亂鬥 | [遊玩](https://phaser.io/agent/local/S7sNJTEcx8r) |
| `Game8` | 萌友卡牌對決 | 卡牌對戰 | [遊玩](https://phaser.io/agent/local/peC2fwqocRE) |
| `Game9` | 萌友大富翁 | 大富翁 | [遊玩](https://phaser.io/agent/local/P9PoxCYxWb4) |
| `Game10` | 萌友瘋狂坦克 | 回合制砲擊 | [遊玩](https://phaser.io/agent/local/bCmTFAj6tW4) |
| `Game11` | 萌友戰機 2026～2027 | 縱向街機射擊 | [遊玩](https://phaser.io/agent/local/fvhg1h7jEMG) |
| `Game12` | 萌友水球大作戰 | 爆爆王式水球對戰 | [遊玩](https://phaser.io/agent/local/eVdsiqEdzeb) |

## 完整離線合集與手機版

12 款完整遊戲、美術、音樂、24 份指南與攻略已收錄。首頁可搜尋及按類型篩選，遊戲播放器提供暫停、靜音、重玩、全螢幕與攻略。

```sh
npm ci
npm run dev
```

開啟終端顯示的網址（預設 http://127.0.0.1:8787）。正式遊戲包位於 `Game1–Game12/complete`，保留 Phaser AE 引擎授權；素材位於 `shared/media`。請透過 HTTP 伺服器開啟，不要直接雙擊 HTML。

手機會顯示方向鍵和各遊戲專用操作，可同時移動與攻擊。射擊大亂鬥另有拖曳瞄準區；戰棋、卡牌與桌遊可直接點畫面。支援橫直向、安全邊界、切到背景自動暫停及快速點按。橫向遊玩可獲得較大的遊戲畫面。

## 下載

[GitHub Releases](https://github.com/goldshoot0720/PhaserGame/releases) 提供：

- Android 8.0 以上 APK，內建全部遊戲與素材，可離線遊玩。
- Windows x64 ZIP，完整解壓後執行 `MoeGameCollection.exe`，請保留同目錄所有檔案。Windows 執行檔尚未進行 Authenticode 簽章。

建置需求、APK 簽章與重建指令見 [packaging/README.md](packaging/README.md)。

## 原始碼與驗證

- `GameN/cloud/src`：Phaser Game Agent 原始碼與每款遊戲的規則測試。
- `shared/mobile-cloud.ts`：共用手機控制；`npm run sync:mobile` 同步至各雲端原始碼。
- `shared/packages.json`：完整遊戲包來源與 SHA-256，可追溯發佈版本。
- `npm run check`：12 款素材、遊戲包、指南完整性，以及本機規則與輸入測試。
- `npm run verify:mobile`：啟動伺服器後，以 Chrome 實測 12 款手機橫直向、進入遊戲、多點觸控、按鍵釋放、暫停與靜音；預設測試網址為 http://127.0.0.1:8790，可用 `TEST_URL` 指定。
- `npm run stats`：更新原始碼行數報告。
- `reports`：雲端規則、手機互動與發行檢查結果。

`local.html` 另附 Game2、Game7、Game11 的 Canvas 2D 本機備用實作（`npm run build:local`）；合集與發行包預設使用完整 Phaser 版本。部分遊戲資料夾也保留早期獨立版本供開發參考。
