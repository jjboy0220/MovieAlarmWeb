# Movie Schedule Alarm V1.0 開發路線圖

- 專案名稱：Movie Schedule Alarm
- 目前版本：V1.0 開發中
- 專案位置：`D:\MovieAlarmWeb`
- 技術：HTML、CSS、Vanilla JavaScript、SheetJS
- 更新日期：2026-07-17
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

Commit 1 至 Commit 5 與 UI 主題功能已完成實際人工測試，並整合為單一 V1.0 核心功能基準 Commit。後續工作從 Commit 6 的設定中心與 Commit 7 的正式發佈準備開始。

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
- ⛔ Electron 桌面版
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
