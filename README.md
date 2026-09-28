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
| `Game11` | 戰機 2026～2027 | 縱向街機射擊 | [遊玩](https://phaser.io/agent/local/fvhg1h7jEMG) |
| `Game12` | 水球大作戰 | 爆爆王式水球對戰 | [遊玩](https://phaser.io/agent/local/eVdsiqEdzeb) |

## 本機版（Vite）

以下目錄另有可在本機執行的版本：

| 目錄 | 遊戲 | 執行方式 |
| --- | --- | --- |
| `Game3` | 卡丁車 | `npm ci && npm run dev` |
| `Game4/guide` | 洛克英雄攻略網站 | 以瀏覽器開啟 `index.html` |
| `Game5` | 格鬥王 | `npm ci && npm run dev` |
| `Game6` | 戰棋 | 在 `Game6` 執行 `python3 -m http.server 8766` |
| `Game12` | 水球大作戰 | `npm ci && npm run dev` |

其餘遊戲的本機版本仍在補齊中，將在完成後另行提交；上方線上版已可完整遊玩。
