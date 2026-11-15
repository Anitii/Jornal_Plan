# OS Planner 2026（電子版）

雙書系統的 2026 電子計畫本：**Monthly & Weekly** ＋ **Daily Log**，可單本或兩本同時打開（DUAL SYSTEM）。

- 365 Timeline、Yearly、Monthly ×12、Monthly Navigation＋月回顧 ×12、Weekly ×53、Free note
- Daily Log：365 天，每天有 Goal、4 類 Check list、05–24 時 Time table、Daily Review 與點陣筆記
- 輸入支援 Markdown 快捷語法、馬卡龍色螢光筆與字色（按右上「Aa 語法」看說明）
- 內容超出格子時會出現可拖曳的捲動條
- **☁ 跨裝置同步**：資料存成你 GitHub 私人 repo 裡的一個 JSON 檔

整個程式就是一個檔案 `index.html`，沒有後端。

## 開啟網頁版（GitHub Pages）

1. 到這個 repo 的 **Settings → Pages**
2. **Source** 選 *Deploy from a branch*，Branch 選 `main`、資料夾 `/ (root)`，按 Save
3. 等一兩分鐘，網址會是 `https://<你的帳號>.github.io/Jornal_Plan/`

手機、平板、其他電腦都開這個網址即可。

## 設定跨裝置同步

> ⚠ 這個 repo 是公開的網頁程式碼。**計畫本內容請放在另一個 Private repo**，不要放在這裡。

1. **建立資料用的 Private repo**：GitHub 右上 ＋ → New repository，例如 `Jornal_Plan_data`，選 **Private**。
2. **建立 token**：Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
   - Repository access：*Only select repositories* → 只選 `Jornal_Plan_data`
   - Permissions → Repository permissions → **Contents：Read and write**
   - 設定到期日，產生後複製 token
3. 打開計畫本，按右上 **☁ 同步**，填入：
   - GitHub 帳號、資料 repo 名稱（`Jornal_Plan_data`）、檔案路徑（預設 `planner-2026.json`）、token
   - 按「儲存並同步」，按鈕變成 **☁ 已同步** 就完成
4. 每台裝置都做一次第 3 步（填同一個 repo 和檔案）。

### 同步怎麼運作

- 打字停下約 3 秒後自動上傳；打開網頁、切回分頁、每 60 秒會自動下載別台裝置的更新。
- 每個格子各自記錄最後修改時間，兩台裝置同時改**不同格子**都會保留；改**同一格**時以最後修改的為準。
- 刪除內容也會同步。
- Token 只存在該裝置的瀏覽器（localStorage），只用來呼叫 GitHub API。在公用電腦用完請按「中斷連線」。
- 關閉網頁前若按鈕還是「待同步…」，請等它變成「已同步」。

## 備份

右上「匯出備份」可下載完整 JSON，「匯入」可還原。
