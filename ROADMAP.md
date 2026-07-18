# Movie Schedule Alarm V1.0 開發路線圖

- 專案名稱：Movie Schedule Alarm
- 目前版本：V1.0 開發中
- 專案位置：`D:\MovieAlarmWeb`
- 技術：HTML、CSS、Vanilla JavaScript、SheetJS、Electron
- 更新日期：2026-07-18
- 文件用途：記錄功能進度、測試狀態與後續開發順序

> `AGENTS.md` 定義專案應該如何開發、修改、測試與提交；`ROADMAP.md` 記錄專案目前完成到哪裡、下一步要做什麼，以及 V1.0 尚缺少哪些功能。

## 狀態圖例

- ✅ 已完成
- 🧪 已完成，等待完整測試
- 🚧 開發中
- ⏳ 尚未開始
- 🐛 需要修正
- ⛔ 暫不開發

## 目前進度說明

Commit 1 至 Commit 5、UI 主題功能、Windows Desktop Preview 2 與 Preview 3 已完成實際人工測試。設定中心仍維持 🧪，Windows 系統主音量雙向同步與正式發佈信任項目延後處理。

## ✅ Commit 1：Core Data Engine

- ✅ Excel 匯入
- ✅ 動態偵測 `Screen`、`Start`、`Finish`、`Film Title`
- ✅ 電影片名解析
- ✅ 影廳格式化
- ✅ 語言解析
- ✅ 放映規格解析
- ✅ 集中式 State
- ✅ 搜尋
- ✅ 影廳、語言與格式篩選
- ✅ 顯示結果統計
- ✅ 匯入失敗時保留上一次成功資料

已使用實際場次表驗證動態 Header、合併儲存格、錯誤保留與所有篩選組合。

## ✅ Commit 2：Schedule Engine

- ✅ 依完整日期與時間排序
- ✅ 跨午夜場次處理
- ✅ 日期分組
- ✅ 日期格式 `YYYY/MM/DD (四)`
- ✅ Next Movie 場次判定
- ✅ 同時間場次群組
- ✅ TEST FILM 排除規則
- ✅ `GC01`、`GC02` 顯示為 `GC1`、`GC2`
- ✅ 3D、DIG、TITAN、IMAX、ATMOS、4DX 規格
- ✅ `3D / DIG` 組合顯示

已以跨午夜與同時間實際資料驗證排序、分組、影廳及格式規則。

## ✅ Commit 3：Next Movie & Countdown

- ✅ Next Movie 日期
- ✅ Next Movie 開播時間
- ✅ 距離開播倒數
- ✅ 每秒更新
- ✅ 共用單一 Ticker
- ✅ 同時間多場一起顯示
- ✅ 搜尋與篩選不影響 Next Movie
- ✅ 全部開播與全部播完狀態
- ✅ 偵錯資訊面板
- ✅ 背景分頁恢復後立即重新計算

已完成實際時間推進、背景恢復與全部播完情境測試；Next Movie 使用完整 `state.sessions`，Ticker 由 `app.js` 統一驅動。

## ✅ Commit 4：Alarm Engine

- ✅ `alarm.wav` 本機音效
- ✅ 場次到點警報
- ✅ 同時間場次群組只觸發一次
- ✅ Alarm Modal
- ✅ 停止警報
- ✅ 警報音效開關
- ✅ 單一警報 Toggle 按鈕
- ✅ 警報開啟中／警報已關閉狀態
- ✅ 移除測試警報按鈕
- ✅ 移除重複警報 Toast
- ✅ 瀏覽器音訊解鎖處理
- ✅ 單一 Audio Channel
- ✅ 背景恢復時只補處理最後一個未觸發群組

已在瀏覽器完成音訊權限、播放失敗、停止、關閉期間到點與背景恢復情境測試；`alarm.js` 維持單一共享 Audio Channel。

## ✅ UI 與主題

- ✅ Apple 風格簡潔介面
- ✅ 白色與藍色主題
- ✅ 深色模式
- ✅ 淺色模式
- ✅ 高對比文字
- ✅ 響應式版面
- ✅ 不顯示電影海報
- ✅ 不使用 TMDB
- ✅ 規格 Badge 多色辨識
- ✅ 語言 Badge 多色辨識
- ✅ 新增控制項具備繁體中文標籤或 ARIA

已在桌面、窄螢幕、兩種主題及鍵盤操作下完成驗證；介面未建立海報或 TMDB 流程。

## 已完成核心功能

## ✅ Commit 5：Live Session Status

### 目標

- ✅ waiting：等待中
- ✅ playing：播放中
- ✅ finished：已播完
- ✅ 每秒更新場次狀態
- ✅ 更新 Schedule 狀態 Badge
- ✅ 更新統計卡：
  - ✅ 今日場次
  - ✅ 顯示結果
  - ✅ 已完成
  - ✅ 剩餘
  - ✅ 播放中
- ✅ 搜尋與篩選只影響顯示結果
- ✅ 全域統計使用完整 `state.sessions`
- ✅ 不建立第二個 `setInterval`

已驗證 `scheduler.js` 的 waiting／playing／finished 判定，以及共用 Ticker 對集中 `state.sessions`、Schedule Badge、每筆剩餘時間與全域統計的更新。

### ✅ 播放狀態篩選與預設隱藏已播完場次

- ✅ `statusFilter` 預設為 `ACTIVE`，Schedule 只顯示 waiting 與 playing。
- ✅ 支援進行中、全部狀態、等待中、播放中與已播完篩選。
- ✅ 播放狀態與搜尋、影廳、語言及規格條件共同套用。
- ✅ 唯一 Ticker 更新 `session.status` 後重新套用篩選。
- ✅ 已播完場次只從 `visibleSessions` 隱藏，完整 `state.sessions`、Next Movie、Alarm 與全域統計不受影響。

已完成瀏覽器與實際 Excel 人工測試。

### 驗收條件

- 場次開始後自動變成播放中
- 散場後自動變成已播完
- 統計數字與列表狀態一致
- 跨午夜場次判斷正確
- 搜尋與篩選只改變顯示結果，不改變全域時間統計
- 全站仍只有一個 Ticker
- Console 無錯誤

## ✅ Windows Desktop Preview 2

- ✅ 使用 Electron 封裝既有 HTML、CSS 與 Vanilla JavaScript 網站。
- ✅ 建立 Windows x64 Portable 與 NSIS Installer。
- ✅ SheetJS `xlsx 0.18.5` 完全本機化，斷網仍可匯入 Excel。
- ✅ Electron Main Process 使用單次計時器安排正式背景警報。
- ✅ 視窗最小化或被一般視窗覆蓋時，到點會自動還原、置頂及聚焦。
- ✅ 使用工作列閃爍提供額外提醒，停止警報後取消閃爍及強制置頂。
- ✅ Preload 只暴露固定且受限制的 Desktop Alarm IPC。
- ✅ Windows 睡眠恢復及解除鎖定後，以實際時間重新檢查目前排程。
- ✅ `assets/alarm.wav` 與離線 SheetJS 一併封裝於應用程式。
- ✅ 同一開播時間的多場場次只觸發一次，關閉程式後不留下 Electron 程序。

已以 `1.0.0-preview.2` Portable EXE 完成啟動、離線 Excel 匯入、最小化背景警報、Modal、音效、停止警報及程序結束人工驗收。建置產物由 `release/` 保存於本機且不加入 Git。

## ✅ Windows Desktop Preview 3

- ✅ Windows Desktop 每次啟動時鬧鐘預設開啟，使用者可在本次執行期間手動關閉。
- ✅ Setup 安裝版支援 Windows 登入後自動啟動設定，並顯示 Windows 實際啟動狀態。
- ✅ 尚未匯入當日場次時，以應用程式 Modal 與 Windows 原生 Notification 提醒。
- ✅ 使用既有標準化場次日期判定是否包含本機今天的有效場次。
- ✅ Portable 不建立永久 Windows 啟動項目，並清楚標示僅 Setup 支援。
- ✅ Setup 建立開始功能表與桌面捷徑，可由正式安裝項目釘選工作列並穩定重啟。
- ✅ 固定 AppUserModelID 與單一實例處理，重複啟動時還原並聚焦既有視窗。
- ✅ 保留 Electron Main Process 背景排程、最小化後自動還原、置頂、工作列閃爍與安全 preload IPC。
- ✅ SheetJS 與 `alarm.wav` 完全本機封裝，Portable 與 Setup 斷網仍可匯入 Excel。

已以 `1.0.0-preview.3` Portable 與 Setup 完成啟動、離線 Excel、今日場次提醒、登入啟動設定、開始功能表、工作列、背景警報及程序結束人工驗收。建置產物維持於忽略的 `release/`，不加入 Git。

- ✅ 正式 Windows `icon.ico`、應用程式視窗圖示與固定作者 metadata 已套用至 Preview 4 Portable 及 Setup。
- ✅ Windows 系統匣背景常駐、最小化隱藏、雙擊還原及結束監控確認已完成人工驗收。
- ✅ 標準化場次週期可在本機保存並於啟動時安全恢復，最後一場結束後提醒匯入下一週資料。

### ⏳ Desktop 延後項目

- ⏳ Windows 系統主音量雙向同步；目前桌面版程式音量固定為 100%，實際響度由 Windows 主音量與應用程式音量混音器控制。
- ⏳ 正式程式碼簽章憑證與簽署流程。
- ⏳ SmartScreen 發布者信任與正式發佈聲譽。
- ⏳ Electron 主版本安全升級；需另開獨立工作並完成相容性與回歸測試。

## ✅ DCP 中文片名本機對照

- ✅ 匯入「現有DCP」工作表的中文片名與英文片名欄位。
- ✅ 清理預告版本尾碼並建立去重、衝突可追蹤的本機 Map。
- ✅ Schedule、Next Movie、Alarm Modal 與搜尋同時支援中文及原始英文片名。
- ✅ 對照資料只保存清理後的必要欄位於 localStorage，不執行 XLSM 巨集。
- ✅ 重新匯入完整取代舊 Map，失敗保留舊資料，清除後恢復英文顯示。

已使用實際 DCP 與場次資料完成重複匯入、中文片名套用及失敗保留舊資料人工驗收。

## ✅ PDF 場次表匯入

- ✅ 本機 PDF.js 解析 Vista Projection Schedule 文字層，不依賴 CDN、OCR 或網路服務。
- ✅ 依文字座標與每頁表頭動態還原 Screen、Start、Finish、Status、Film Title。
- ✅ 日期區段可跨頁延續，並支援跨午夜開始及結束日期時間。
- ✅ Excel 與 PDF 共用集中 `state.sessions` 匯入流程，新資料完整取代舊資料。
- ✅ DCP 中文片名、搜尋、Next Movie、Countdown 與 Alarm 沿用既有資料流。

已使用實際單日與跨週期 PDF 完成 Electron 匯入、日期修復、營運日切換及場次顯示人工驗收。

## 下一階段

## 🧪 Commit 6：Settings Center

### 目標

- 🧪 警報音量設定
- 🧪 警報音效選擇
- 🧪 提前提醒分鐘數
- 🧪 深色／淺色主題設定
- 🧪 是否顯示偵錯面板
- 🧪 設定儲存到 localStorage
- 🧪 重新整理後保留一般設定
- 🧪 音訊仍需由使用者重新點擊解鎖

設定中心已完成程式整合，等待瀏覽器人工測試後才可標示為 ✅。

### 驗收條件

- 設定可儲存
- 重新整理後設定可恢復
- 不儲存敏感資訊
- 不破壞既有 Alarm Engine
- 不建立第二個 Audio、State 或 Ticker
- 警報音訊解鎖狀態不寫入 localStorage

## ⏳ Commit 7：Performance & V1.0 Release

### 目標

- 清理未使用函式
- 清理重複 CSS
- 檢查事件監聽重複問題
- 確認只有一個 Ticker
- 確認只有一個 Audio
- 完整測試 Excel 匯入
- 完整測試跨午夜
- 完整測試同時間場次
- 完整測試倒數
- 完整測試警報
- 完整測試深色／淺色模式
- 更新 `README.md`
- 建立 `CHANGELOG.md`
- 建立 V1.0 測試清單
- 準備 `v1.0.0` Release

### 驗收條件

- 無 Console Error
- 無未處理 Promise Error
- 不依賴 Node.js 或 npm
- 可使用 Live Server 執行
- 主要功能可離線使用
- Git 工作區乾淨
- 已推送到 `origin/main`

## ⛔ V1.0 暫不開發

- ⛔ TMDB API
- ⛔ 自動抓取中文片名
- ⛔ 電影海報
- ⛔ Windows 系統音量強制最大
- ⛔ SQLite
- ⛔ Node.js
- ⛔ npm
- ⛔ React、Vue、Angular
- ⛔ 雲端資料庫
- ⛔ 多使用者登入

上述功能可於 V2.0 或後續版本重新評估。

## 未來版本

## ⏳ V2.0：Windows Desktop

可考慮：

- Electron 桌面版
- Windows 通知
- 工作列圖示
- 開機啟動
- 更穩定的音效控制
- 本機設定檔
- 系統 Log

## ⏳ V3.0：Local Database

可考慮：

- SQLite
- 電影中文名稱管理
- 自訂電影資料庫
- 操作紀錄
- 場次歷史紀錄
- 設定檔匯入與匯出

## 每次 Commit 更新規則

1. 開始新功能前，先閱讀 `AGENTS.md` 與 `ROADMAP.md`。
2. 一次只處理一個 Commit。
3. 功能完成但尚未完整測試時，標示為 🧪。
4. 測試通過並提交 Git 後，才標示為 ✅。
5. 發現問題時標示為 🐛。
6. 不得刪除已完成項目的歷史紀錄。
7. 每次更新 `ROADMAP.md` 時，更新文件日期。
8. 不得因建立或更新 `ROADMAP.md` 而修改程式邏輯。
9. `ROADMAP.md` 只描述進度，不取代 `AGENTS.md` 的開發規範。
10. 使用者最新需求高於原有 Roadmap。
