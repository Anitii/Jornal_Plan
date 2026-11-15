# OS Planner 2026

三本一組的計畫本系統：**MONTHLY + Y**、**WEEKLY + N**、**DAILY LOG**。
純前端（沒有後端、不用 build），可以裝成手機／電腦 App、離線使用，並透過 GitHub 私人 repo 跨裝置同步。

## 功能

| 本子 | 內容 |
|---|---|
| **MONTHLY + Y** | 365 Timeline、Yearly、12 個月曆、Monthly Navigation＋月回顧 |
| **WEEKLY + N** | 53 週；每天最上面一格「FROM MONTHLY」和月曆同一格連動；N = Free note、個人資料 |
| **DAILY LOG** | 365 天：Goal、4 類 Check list、**10 分鐘時間格**、Daily Review、點陣筆記 |

- **月曆 ↔ 週計畫連動**：在月曆 11/15 寫「面試」，W46 的 11/15 最上面一格就會出現；兩邊改哪一邊都一樣。
- **螢光筆 → 年計畫**：在月曆（或週計畫的 FROM MONTHLY 格）用螢光筆標記文字，會把「11/15 面試」寫一行到當月的 Yearly，之後可自由修改。同一行不會重複寫入。
- **10 分鐘時間格**：空格上拖曳＝新增任務；拖曳任務＝移動；拖右邊邊緣＝調整長度；點任務＝改名／顏色／完成／刪除。左邊 check list 滑過出現 ⠿，拖到時間格就排進去（名稱、完成狀態會跟 check list 連動）。
- 輸入支援 Markdown 快捷語法、馬卡龍色螢光筆與字色；內容超出格子時旁邊會出現可拖曳的捲動條。
- ☁ 跨裝置同步（每個格子各自比對修改時間合併）、匯出／匯入備份。

## 開啟方式

**線上（GitHub Pages）**：repo 的 Settings → Pages → Deploy from a branch → `main` / `(root)`，網址為 `https://<帳號>.github.io/Jornal_Plan/`。
在手機瀏覽器打開後選「加入主畫面」，電腦版 Chrome／Edge 網址列右邊的「安裝」圖示，就能當 App 用（可離線）。

**本機**：需要 [Node.js](https://nodejs.org/)。

```bash
npm start
```

然後打開 http://localhost:5178 。（因為用了 ES modules 和 service worker，直接雙擊 `index.html` 打不開，要用這個本機伺服器。）

## 跨裝置同步設定

資料預設只存在這個瀏覽器。要讓手機、平板、電腦看到同一份，到 GitHub 建立權杖、在每台裝置貼上一次。

### 方法一：秘密 Gist（預設、最簡單）

1. 打開 [建立權杖（已預選 gist）](https://github.com/settings/tokens/new?scopes=gist&description=OS%20Planner%20sync)，只勾 **gist**，設定到期日，按 Generate token，複製。
2. 打開計畫本 → **☁ 同步** → 選「秘密 Gist」→ 貼上權杖 → 儲存並同步。第一台裝置會自動在你帳號建立一個秘密 Gist（檔名 `planner-2026.json`）。
3. 其他裝置貼上**同一個**權杖即可，會自動找到同一個 Gist。

> 秘密 Gist 不會出現在搜尋或你的公開頁面，但**知道網址的人看得到**。內容很私密的話請用方法二。
> 權杖只存在該裝置的瀏覽器，請勿在共用電腦上使用；權杖過期後重新建立、在每台裝置重貼即可。

### 方法二：Private repo（進階、完全私密）

1. 建立 Private repo，例如 `Jornal_Plan_data`。
2. GitHub Settings → Developer settings → **Fine-grained tokens**：只選 `Jornal_Plan_data`，權限 **Contents：Read and write**。
3. **☁ 同步** → 選「Private repo」→ 填帳號、repo 名稱、token → 儲存並同步。每台裝置做一次。

### 同步怎麼運作

打字停下約 3 秒自動上傳；打開網頁、切回分頁、每 60 秒自動下載。每個格子各自記錄修改時間：兩台裝置改不同格子都會保留，改同一格以最後修改為準，刪除也會同步。

## 專案結構

```
index.html              外殼（工具列、對話框）
manifest.webmanifest    App 資訊（可安裝）
sw.js                   Service worker（離線快取；不快取 GitHub API）
css/app.css             全部樣式（版面尺寸都在 :root 變數）
js/
  app.js                三本書、翻頁、索引標籤、TODAY、跳日期、匯入匯出
  util.js               常數、日期工具、馬卡龍色票
  store.js              資料層：每個格子 key → 值，並記錄修改時間（同步合併用）
  sync.js               GitHub 同步與設定對話框
  editor.js             富文字格子：Markdown、格式工具列、捲動條
  timeblock.js          DAILY 10 分鐘時間格（拖曳、調整、連動 check list）
  links.js              螢光筆 → 年計畫
  nav.js                各本頁碼索引
  pages/monthly.js      月計畫本各頁
  pages/weekly.js       週計畫本各頁（含 FROM MONTHLY 連動列）
  pages/daily.js        日誌本各頁
scripts/serve.js        本機伺服器（npm start）
icons/                  App 圖示
```

### 資料格式

所有內容存在一個物件裡（瀏覽器 localStorage `osplanner2026`，同步時存成 `planner-2026.json`）：

| key | 內容 |
|---|---|
| `mo-<月0-11>-<日>` | 月曆格（週計畫 FROM MONTHLY 也是這個） |
| `mo-<月>-memo` | 月曆左側備忘 |
| `yr-<月>` | Yearly |
| `tl-<月>-<日>` | 365 Timeline |
| `nv-<月>-<組>-…` / `rv-<月>-…` | Monthly Navigation／回顧 |
| `wk-<日期>-<0-2>` / `wk-<週一日期>-memo` | 週計畫 |
| `d-<日期>-goal / q<n>h / q<n>t<r> / q<n>c<r> / rev / note` | 日誌 |
| `d-<日期>-tb` | 時間格任務（JSON：`[{id,s,n,t,c,src?,done?}]`，s/n 以 10 分鐘為單位，從 05:00 起算） |

匯出備份就是這個物件；v1 的備份檔也能直接匯入。
