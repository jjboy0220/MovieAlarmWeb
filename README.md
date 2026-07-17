# Movie Schedule Alarm V1.0

Movie Schedule Alarm 是以 HTML5、CSS3 與 Vanilla JavaScript ES6 製作的影城營運場次工具。系統在瀏覽器中讀取 Excel 場次表、標準化影廳與電影資料，並以 Excel 解析出的英文片名作為唯一電影名稱來源。

## 專案結構

```text
MovieAlarmWeb/
├─ index.html                 # 頁面與 Excel 匯入入口
├─ css/
│  ├─ style.css               # 主題與全域色彩變數
│  ├─ card.css                # Next Movie 卡片樣式
│  ├─ table.css               # 場次表樣式
│  ├─ badge.css               # 狀態、語言、影廳與規格 Badge
│  ├─ debug.css               # 可收合的偵錯面板樣式
│  └─ alarm.css               # 警報 Modal 與音效控制樣式
├─ js/
│  ├─ app.js                  # 集中 state 與匯入流程協調
│  ├─ excelReader.js          # Excel 工作表與欄位讀取
│  ├─ parser.js               # 場次、日期、影廳、語言與規格解析
│  ├─ scheduler.js            # 等待中場次與 Next Movie 選取
│  ├─ search.js               # 搜尋規則
│  ├─ filter.js               # 篩選規則
│  ├─ statistics.js           # 統計規則
│  ├─ table.js                # 依 visibleSessions 顯示場次
│  ├─ ui.js                   # Next Movie、偵錯面板與一般 UI 更新
│  ├─ debug.js                # 集中狀態的偵錯資料整理
│  └─ alarm.js                # 唯一 HTMLAudioElement 警報通道
└─ assets/
   └─ logo.png
```

## 如何執行

不需要 Node.js、npm 或前端框架。建議使用 VS Code Live Server 開啟專案根目錄後載入 `index.html`，再按「上傳當日場次表」匯入 `.xlsx`、`.xls` 或 `.csv` 場次表。

Excel 解析使用專案內的 SheetJS `xlsx 0.18.5` 瀏覽器版檔案，不需要連線到外部 CDN。

## 啟動方式

雙擊 `啟動電影場次鬧鐘.bat` 即可開啟系統。

Launcher 會依序檢查 5500 至 5505，選擇第一個可用 Port 啟動本機 HTTP Server，並自動以預設瀏覽器開啟對應的 `http://127.0.0.1:實際Port/index.html`。

請先確認已安裝 Python；建議安裝時勾選 `Add Python to PATH`。不要直接雙擊 `index.html`。

## 關閉方式

雙擊 `停止電影場次鬧鐘.bat` 即可停止 Server。

停止工具只會關閉由 Launcher 建立、名為 `Movie Schedule Alarm Server` 的專屬命令視窗及其 Python Server，不會關閉其他 CMD 視窗。關閉瀏覽器分頁後，Server 可能仍在執行，請使用停止工具或在 Server 視窗按 `Ctrl + C` 完全關閉服務。
## Excel 解析方式

`excelReader.js` 會自動搜尋 `Screen`、`Start`、`Finish`、`Film Title` 標題，並依實際資料位置讀取，不會硬編碼欄位索引。Parser 會：

- 將數字影廳轉為 `C1` 至 `C9`，並將 `GC01`、`GC02` 正規化為 `GC1`、`GC2`。
- 從片名括號前綴識別 DIG、TITAN、IMAX、ATMOS、4DX 與 3D 格式。
- 將 `C`、`E`、`J` 分別轉為 `CHI`、`ENG`、`JAN`。
- 解析日期、跨午夜的 `startDateTime`／`finishDateTime`，並依完整開始時間排序。
- 略過設定在 `js/config.js` 的測試片、預告與檢查片關鍵字。

## 離線電影資料原則

V1.0 不使用 Token、外部圖片、電影翻譯服務、外部電影 metadata 服務或瀏覽器電影 metadata 快取。Excel 匯入成功後，表格、Next Movie、搜尋、篩選與統計都直接使用集中 state 中的解析結果；英文電影片名保持不變。Next Movie 只顯示日期、時間、片名、語言、格式與影廳，不顯示電影海報。



## 警報音效與開播提醒

當完整 `startDateTime` 到達時，系統會以相同開播時間的場次作為一個群組，只觸發一次音效與大型「場次開始」提醒。Next Movie 會改顯示下一個群組，而提醒 Modal 保留原到點群組，直到使用者按下「停止警報」。

警報採用唯一的 HTMLAudioElement，沒有額外 timer，並以相對路徑 `assets/alarm.wav` 載入專案內的音效檔。每次重新載入頁面後，警報預設為關閉；使用者必須手動點選「開啟警報音效」以符合瀏覽器的播放安全限制。再次點選同一按鈕即可關閉警報，並停止正在播放的正式警報。警報關閉期間到點的群組仍會記錄為已處理，但不會補播舊音效或顯示舊提醒。缺少音檔或瀏覽器阻擋播放時，系統會提供非阻塞提示。

Windows Desktop Preview 另由 Electron Main Process 依完整時間戳安排下一個警報群組。到點時會還原既有主視窗、暫時設為最上層並閃爍工作列，再由原有 Alarm Modal 與唯一 Audio Channel 提醒；停止警報後會取消最上層與閃爍狀態。桌面版實際播放時程式內音量固定為 100%，最終響度仍由 Windows 主音量、音訊輸出裝置及應用程式音量混音器控制，程式不會修改 Windows 系統音量。
## 偵錯資訊

頁面底部提供預設收合的「顯示偵錯資訊」面板。它只讀取集中 state、排程引擎與既有的單一倒數 ticker，可檢視系統時間、匯入檔案、日期時間有效性、下一個群組與場次狀態；展開與收合不會建立或停止任何額外計時器。
## 未來本機電影資料庫

日後若需要中文片名或其他補充資訊，可在獨立功能提交中新增本機 `movies.json` 及對應的純資料 Repository 模組。該模組應以標準化英文片名查詢本機資料後，再透過 `app.js` 更新集中 state；不得使 UI、搜尋、篩選或 Excel Parser 各自持有另一份場次資料。

## 未來 Electron 遷移

目前 V1 是純前端 Web 工具。遷移至 Electron 時，Parser、集中 state 與 UI 模組可直接保留；若日後加入本機 `movies.json` 或 SQLite，資料存取必須維持在獨立資料層，避免 UI 直接讀寫檔案或資料庫。

## Windows Desktop Preview

Windows Desktop Preview 使用 Electron 封裝既有 HTML、CSS 與 Vanilla JavaScript，不重寫網站本體。只有建置電腦需要 Node.js 與 npm；一般使用者只需執行建置後的 EXE，不需要安裝 Node.js、npm、Python、VS Code 或 Live Server。

開發與建置指令：

```text
npm install
npm run desktop
npm run build:portable
npm run build:installer
```

`npm run desktop` 啟動 Electron 開發版；`npm run build:portable` 建立 Windows x64 免安裝版，`npm run build:installer` 建立 Windows x64 NSIS 安裝程式。

### Preview 2 修正內容

- 最小化後仍可準時提醒。
- 背景狀態由 Electron Main Process 排程。
- 到點後自動還原、置頂及聚焦。
- 使用 Windows 工作列閃爍提醒。
- SheetJS 已本機化，可離線匯入 Excel。
- 停止警報後取消強制置頂。

Preview 2 的免安裝版檔名為 `Movie-Schedule-Alarm-V1.0-Preview.2-Portable.exe`，NSIS 安裝程式檔名為 `Movie-Schedule-Alarm-V1.0-Preview.2-Setup.exe`。

### SheetJS 離線支援

Excel 匯入使用 SheetJS `xlsx 0.18.5`，瀏覽器 bundle 位於 `vendor/xlsx/xlsx.full.min.js`，Electron 與網站都以相對路徑載入，不依賴 jsDelivr 或其他外部網路資源。套件用途僅為讀取與解析 `.xlsx`、`.xls`、`.csv` 場次表；Apache License 2.0 授權文字保留於 `vendor/xlsx/LICENSE`。

### 桌面背景警報限制

- 一般桌面程式上方可自動還原並顯示提醒，但公司安全政策若禁止程式搶焦點，可能只會看到最上層視窗或工作列閃爍。
- Windows UAC 安全桌面、鎖定畫面、登入畫面及其他系統級安全畫面不能由一般 Electron 視窗覆蓋。
- Windows 睡眠或休眠期間程式不會執行；恢復或解除鎖定後會以實際時間重新檢查，並只處理目前排程中最近的未處理群組。
- 多螢幕環境會保留主視窗原本位置；只有視窗已完全離開所有有效螢幕時，才移至目前滑鼠所在螢幕中央。
