# Movie Schedule Alarm V1.2 Developer Guide

本文件是 Movie Schedule Alarm 專案唯一且永久的開發規範。每次開始任何開發工作前，都必須優先完整閱讀本文件；所有新功能、修改、測試與 Commit 都必須依照本文件執行。

若未來使用者的最新明確需求與本文件衝突，以使用者最新需求為優先；完成該需求時，應同步檢查是否需要更新本文件。

## 一、Project Information

- 專案名稱：Movie Schedule Alarm
- 版本：V1.2
- 用途：影城營運場次管理工具
- 固定工作區：`D:\MovieAlarmWeb`

主要技術：

- HTML
- CSS
- Vanilla JavaScript
- SheetJS
- PDF.js
- Electron（Windows 桌面封裝）
- Node.js 與 npm（僅限開發、測試與建置）

除非使用者未來明確要求，禁止使用：

- React
- Vue
- Angular
- TypeScript
- 任何其他前端框架

網站核心必須能以本機 HTTP Server 執行；Windows 桌面版使用 Electron 封裝相同的 HTML、CSS 與 Vanilla JavaScript 模組。一般使用者不需要安裝 Node.js 或 npm。

V1.2 的電影資料處理完全離線，場次可由 Excel 或 PDF 匯入。英文片名以場次表解析結果為準；使用者可另外匯入本機 DCP 工作表建立中文片名對照。不可呼叫外部電影 metadata API、海報 API，也不可建立 Token 或背景 metadata 載入流程。

V1.2 不顯示電影海報，不可建立海報容器、海報資產、海報載入狀態、圖片錯誤處理或海報 URL 欄位。DCP 中文片名對照只能保存必要的本機映射資料，不得擴張為外部 metadata 或海報資料來源。

## 二、Workspace Rules

所有讀取、修改、測試與 Git 操作只能在：

```text
D:\MovieAlarmWeb
```

禁止：

- 建立第二份專案
- 建立 `MovieAlarmWeb_copy`
- 建立備份專案
- 建立 `C:\MovieAlarmWeb`
- 在 C 槽建立任何專案內容
- 自行搬移或重新建立專案
- 批次覆寫無關檔案
- 修改 Git Remote

只可修改完成目前需求所必要的檔案。工作區中既有或未提交的變更均視為使用者內容，不得覆蓋、還原、刪除或混入不相關功能。

## 三、AGENTS.md Rules

每次開始工作時，第一件事必須完整閱讀目前工作區的 `AGENTS.md`。

若 `AGENTS.md` 不存在、無法讀取、內容損壞或無法確認：

1. 立即停止所有修改。
2. 向使用者說明問題。
3. 不得猜測、重建或自行替代規則。

不得在其他位置建立第二份 `AGENTS.md` 作為替代規範。

## 四、Git Workflow

開始任何功能或修改之前，必須依序：

1. 執行 `git status`。
2. 檢查目前 branch。
3. 確認 Working Tree、Staging Area 與未追蹤檔案狀態。
4. 閱讀與需求相關的現有檔案及差異。

若工作區已有未提交修改：

- 必須先提醒使用者並列出相關狀態。
- 未取得使用者針對本次工作的明確指示前，不得直接開始新的程式修改。
- 不得覆蓋、捨棄或擅自整理既有修改。

遇到 README、`.gitignore`、不相關歷史、Git Remote 差異或 merge conflict 時，必須先向使用者說明再處理。

## 五、Commit Rules

- 一個 Commit 只能完成一個功能或一個明確修正。
- 不得在同一 Commit 一次完成多個大型功能。
- 不得把不相關檔案或格式化差異混入 Commit。
- 每次 Commit 前必須檢查程式碼、完整 Git diff、`git diff --check` 與 `git status`。
- 必須在相關測試完成並回報後才可準備 Commit。
- 完成功能後不得自動 Commit，必須等待使用者確認。
- Commit 完成後不得自動 Push，必須等待使用者確認。
- Push 前必須先 fetch 並確認遠端歷史。
- 維持 `.gitignore` 正確，不得忽略必要原始碼、文件或專案資產。

禁止使用 `git reset --hard`、`git checkout --`、force push 或其他可能遺失資料的操作，除非使用者明確要求並確認風險。

## 六、Coding Rules

- 優先修改既有程式，不重寫整個檔案或正常運作的模組。
- 不重新建立整個專案，不大量改名，不進行與需求無關的重構。
- 使用 ES6 語法與模組化 Vanilla JavaScript。
- 每個模組維持單一責任。
- 保持既有命名、資料模型、模組邊界與資料流。
- 變數、函式與屬性名稱使用 camelCase。
- 每個函式都必須具有繁體中文註解，說明其目的或資料規則。
- 程式碼必須可讀、可維護且可擴充。
- 避免重複邏輯；共用規則應抽取為可重用的純函式或模組。
- 所有使用者可見訊息、註解與文件說明均使用繁體中文。
- 將外部或使用者資料寫入 `innerHTML` 前，必須先進行 HTML 轉義。
- 未經明確要求，不得提前實作新功能。

## 七、Architecture and Single Source of Truth

固定資料流：

```text
Excel
↓
Excel Reader
↓
Parser
↓
Application State
↓
Search / Filter
↓
Statistics
↓
UI
↓
Countdown
↓
Alarm
```

模組責任：

- `excelReader.js` 負責讀取活頁簿、標題列與欄位定位。
- `parser.js` 負責片名、格式、語言與影廳標準化。
- `app.js` 負責唯一的集中 state 與資料流協調。
- `search.js`、`filter.js`、`statistics.js` 只處理純資料規則。
- `table.js` 與 `ui.js` 只根據 state 更新畫面。
- `countdown.js` 與 `alarm.js` 位於資料流末端，不可建立場次資料副本。

全專案所有狀態只能有一份，不得建立：

- 第二套 application state
- 第二份原始場次資料
- 第二套 Countdown
- 第二套 Alarm
- 第二套 Statistics

`state.sessions` 保存完整且已標準化的場次資料。`state.visibleSessions` 必須由 `state.sessions` 與目前搜尋／篩選條件推導。所有 UI 都必須由集中 state 渲染。

Excel 匯入成功後必須依序：保存 sessions、依開始時間排序、更新篩選選項、套用篩選、更新 UI 與統計。Excel 解析失敗時，不可清除上一次成功匯入的 state、表格或統計。搜尋與篩選事件必須先更新 state，再呼叫單一篩選與重新渲染流程。

## 八、Timer Rules

- 全站只能有一個 `setInterval`。
- 任何新功能不得建立第二個 Timer 或獨立的每秒 interval。
- 所有需要每秒更新的功能必須共用同一個 Ticker。
- 重新匯入、搜尋、篩選、切換頁面或重新啟用警報不得建立額外 interval。
- 頁面從背景恢復可見時，必須使用實際 `Date` 立即重新計算，不可依賴背景期間累積的 interval 次數。
- 不可在每秒 Ticker、狀態切換或偵錯更新時輸出 Console log；除非使用者明確要求，Console 應保持乾淨。

## 九、Excel Rules

Excel 必要欄位：

- `Screen`
- `Start`
- `Finish`
- `Film Title`

規則：

- `excelReader.js` 與 `parser.js` 是已驗證模組，原則上不得修改或重寫。
- 只有使用者明確要求、Excel 格式確實變更或已確認存在錯誤時，才可提出最小修改。
- Parser 必須動態偵測標題列與必要欄位。
- 不得固定欄位索引，不得固定標題列號碼，不得猜測欄位。
- 必須依必要欄位的標題文字定位。
- 必須處理合併儲存格，不可假設合併範圍左上角就是實際資料欄位。
- 必須略過空白列、報表說明列與缺少必要欄位的列。
- 必須保持目前已驗證的跨午夜日期邏輯與完整日期時間排序。

影廳標準化規則：

- 數字 `1` 至 `9` 轉為 `C1` 至 `C9`。
- `GC01`、`GC02`、`GC09` 分別轉為 `GC1`、`GC2`、`GC9`。
- `GC10` 維持 `GC10`。
- 非數字影廳名稱與不符合 GC 數字格式的值維持原值。

語言標準化規則：

- `DIG C` → `CHI`
- `DIG E` → `ENG`
- `DIG J` → `JAN`
- `TITAN E` → `ENG`
- 沒有語言代碼時，language 保留空值，不得猜測。

支援格式包含 DIG、TITAN、IMAX、ATMOS、4DX 與 3D。格式必須由片名前綴解析，搜尋、篩選與顯示使用相同的標準化值。

## 十、Next Movie and Schedule Rules

- Next Movie 永遠只依完整 `state.sessions` 判定。
- 不得受搜尋、篩選、`state.visibleSessions` 或 UI 顯示排序影響。
- 相同 `startDateTime` 的場次必須視為同一下一場時間群組。
- 群組日期、開播時間與倒數只顯示一次。
- 每個同時開播場次分別顯示影廳、純片名、語言 Badge 與格式 Badge。
- 所有判定與倒數必須使用完整 `startDateTime` 與實際 `Date` 差值，不可只比較 `HH:mm` 或依前一秒遞減。
- 倒數到零時，目前群組立即不再是 upcoming，並自動切換至下一群組。
- 沒有未來場次時必須顯示安全文字，不得出現 `undefined`、`Invalid Date` 或負數倒數。
- Next Movie 不顯示海報。
- Next Movie 與 Schedule 日期標題共用 `YYYY/MM/DD (日／一／二／三／四／五／六)` 格式化函式。
- 日期只作為 Schedule 分組標題，不加入每筆場次列，也不得影響 `startDateTime` 排序。

## 十一、Schedule Status and Debug Rules

- waiting：目前時間早於 `startDateTime`。
- playing：已開播但尚未到有效 `finishDateTime`。
- finished：已達有效 `finishDateTime`。
- Schedule 預設只顯示 waiting 與 playing，集中 state 的 `statusFilter` 預設值必須是 `ACTIVE`。
- 已播完場次只可從 `state.visibleSessions` 隱藏，不得從完整 `state.sessions` 刪除。
- 播放狀態篩選只影響 `state.visibleSessions`；Next Movie、Alarm、Debug 全域資訊與全域統計不得受其影響。
- 狀態篩選必須直接使用既有 `session.status`，不得在篩選模組重複計算時間。
- 唯一 Ticker 更新場次狀態後必須重新套用單一篩選流程，不得建立第二個 `setInterval`。
- 缺少或無效 `finishDateTime` 的場次在開播後不可標為 finished。
- 只有至少一個具有有效開始與結束時間的場次、所有有效結束時間均已過，且 waiting 與 playing 都為零時，才可顯示「今日場次已全部播完」。
- Next Movie 的未匯入、下一個場次群組、全部開播但仍播放中、已全部播完與無有效時間五種狀態必須互斥。
- 偵錯面板預設收合，不得使用阻擋場次列表的固定覆蓋層。
- 偵錯面板只能讀取集中 state、排程引擎與既有 Ticker 資訊，不得建立資料副本或 interval。
- 偵錯資料由單一 `getScheduleDebugInfo(state, now)` 類型的純函式建立。

## 十二、Alarm Rules

- 相同 `startDateTime` 的場次視為同一警報 Group。
- 每個穩定 `groupKey` 在同一次成功匯入中只能觸發一次。
- Alarm 判定只能使用完整 `state.sessions` 與完整日期時間，不得受搜尋、篩選或 `HH:mm` 文字影響。
- 使用集中 state 中的 `activeAlarmGroup` 與 `triggeredAlarmGroups`。
- `activeAlarmGroup` 與 `nextSessionGroup` 必須分開保存；Next Movie 切換不得覆蓋正在顯示的警報 Modal。
- `triggeredAlarmGroups` 只可在重新匯入成功後清除；停止警報、切換篩選、切換分頁或重新啟用警報都不可清除。
- 警報關閉時到點的 Group 仍須記錄為已處理，不得在重新啟用後補響。
- 全站只能建立一個 `HTMLAudioElement` Alarm Channel，不得建立第二個 Audio、重複事件監聽或重複播放。
- 使用者必須透過唯一的鬧鐘切換按鈕完成音訊解鎖。
- 頁首不得分開顯示警報開關與狀態指示器；只能使用一個整合圓點、鈴鐺圖示與狀態文字的切換按鈕。
- 警報切換按鈕文字只能是「鬧鐘已開啟」或「鬧鐘已關閉」；開啟使用綠色系，關閉使用紅色系。
- 不可加入測試警報或停止測試音效功能。
- `alarmEnabled` 是警報切換 UI 的唯一來源；`alarmUnlocked` 與 `activeAlarmGroup` 僅為輔助執行狀態。
- 關閉警報必須暫停並重設音效、關閉 Modal 與移除警示視覺，但不得清除已觸發紀錄。
- `assets/alarm.wav` 缺少、載入失敗或播放失敗時，Modal 與視覺提醒仍須正常運作，並以非阻塞訊息說明音效錯誤。
- 網頁重新載入後警報預設關閉；設定中心僅可使用 localStorage 保存一般設定，絕不可保存警報開關或音訊解鎖狀態。
- 網頁只可設定 HTMLAudioElement 音量，不得聲稱能控制 Windows 系統音量。
- 背景分頁恢復時只可補處理最後一個未觸發 Group，不得連續播放多個過期警報。

## 十三、UI Design Rules

- 全站採簡潔、現代、接近 Apple Style 的視覺方向。
- 主色固定為白色與藍色由淺至深。
- 淺色模式使用白色、淺藍灰與中藍。
- 深色模式使用深藍黑、藍灰與亮藍。
- 禁止恢復綠色全站主題；成功、系統就緒與等待狀態也優先使用藍色系。
- 維持深藍黑影城營運風格、高對比與響應式設計。
- 保持既有色彩、間距、元件與互動一致性。
- 尚未匯入 Excel 時顯示明確提示。
- 搜尋或篩選無結果時顯示「沒有符合條件的場次」。
- 動態錯誤與空狀態由既有 UI 模組集中更新。

Badge 必須保留目前識別色：

- DIG：橘色
- TITAN：紫色
- IMAX：紅色
- ATMOS：琥珀色
- 4DX：綠色
- 3D：粉紅色
- CHI：綠色
- ENG：藍色
- JAN：琥珀亮色

Badge 色彩是格式與語言識別的限定例外，不得延伸為全站主題。未標示語言時不可建立空白 Badge。

同時包含 3D 與 DIG 時，Parser 的 `format` 與 `formatDisplay` 統一為 `3D / DIG`，UI 只顯示一個組合漸層 Badge；`formats` 陣列仍保存個別標準化格式，且搜尋與篩選必須同時符合 3D 與 DIG。

片名欄與 Next Movie 只顯示純 title，語言與片名分開顯示。所有格式 Badge 使用圓角膠囊、柔和 Hover 與高對比文字，不使用厚重陰影或玻璃反射。

## 十四、Dark Mode

- 所有新功能與新元件必須同時支援 Light Mode 與 Dark Mode。
- 不得只完成其中一種模式。
- 兩種模式都必須檢查文字、背景、邊框、Focus、Hover、Disabled、錯誤與空狀態的對比。
- 淺色模式使用淺色背景、深色文字與細邊框。
- 深色模式使用低透明度背景與對應亮色文字。

## 十五、Accessibility

所有新增按鈕、控制項、Modal 與互動元件必須：

- 可使用鍵盤操作。
- 具備清楚可見的 Focus 狀態。
- 使用正確的語意元素與 ARIA 屬性。
- 提供繁體中文可見標籤或 `aria-label`。
- 維持足夠文字與背景對比。
- 不可只依顏色傳達狀態。

## 十六、Development Workflow

固定流程不得跳過：

1. 完整閱讀 `AGENTS.md`。
2. 執行 `git status` 並檢查 branch。
3. 確認工作區、未提交修改及本次允許範圍。
4. 閱讀相關現有檔案後，以最小範圍開始修改。
5. Review 完整 Diff，確認未碰觸無關檔案。
6. 執行 `git diff --check` 與適當的技術檢查。
7. 提供人工測試方法，等待使用者實際測試。
8. 等待使用者確認結果與是否 Commit。
9. 取得明確確認後才 Commit。
10. 再次取得明確確認後才 Push。

每次程式修改後至少應檢查：

1. 實際場次表匯入與開始時間排序。
2. 搜尋、全部篩選條件與無結果狀態。
3. 匯入失敗時保留上一次成功資料。
4. 瀏覽器 Console 沒有錯誤或非預期輸出。
5. 桌面與窄螢幕顯示。
6. Light Mode 與 Dark Mode。
7. 鍵盤操作、Focus 與 ARIA。
8. 涉及時間功能時，檢查跨午夜、背景恢復、Next Movie、共用 Ticker 與 Alarm Group。

不可聲稱未實際執行的測試已通過。若受環境限制無法測試，必須明確列為尚未執行。

## 十七、Response Rules

每次完成工作後，固定提供：

1. 修改檔案。
2. 修改原因。
3. 主要邏輯、資料流或架構影響。
4. 人工測試方法，以及已執行與尚未執行的測試。
5. Git Commit 建議。

必要時另列已知限制、風險與後續建議。不得直接 Commit，也不得直接 Push。

## 十八、Safety Rules

不得自行：

- 刪除專案或大量檔案
- 刪除或重建 `.git`
- 修改 Git Remote
- 搬移專案
- 建立專案副本或備份專案
- 升級或更換框架
- 加入 TypeScript、其他前端框架或未經確認的新桌面技術
- 還原、覆蓋或刪除使用者未提交修改

任何可能遺失資料、擴大技術範圍或改變專案架構的操作，都必須先取得使用者明確確認。

## 十九、Future Rules

- V1.2 維持離線優先架構；瀏覽器核心與 Electron 桌面版共用 Parser、集中 state 與 UI 模組。
- Electron 的 Node API 必須透過受控 preload 層提供，Renderer 不得直接取得完整 Node.js 或 `ipcRenderer` 權限。
- Node.js 與 npm 僅用於開發、測試與建置，不得讓一般使用者安裝額外執行環境。
- 若未來加入 SQLite，資料庫存取必須與前端資料模型分層，UI 不得直接操作資料庫。
- DCP 中文片名對照必須維持獨立 Reader、Storage 與 Map 模組，且不得變更 Excel Parser 的欄位偵測邏輯。
- 若未來需求與本文件衝突，以使用者最新明確需求為優先；不得自行擴張解讀。

# End of AGENTS.md
