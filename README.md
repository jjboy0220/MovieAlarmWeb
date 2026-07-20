# Movie Schedule Alarm V1.2

Movie Schedule Alarm 是以 HTML5、CSS3、Vanilla JavaScript ES6 與 Electron 製作的影城營運場次工具。系統可離線讀取 Excel 或 PDF 場次表、標準化影廳與電影資料，並可匯入本機 DCP 工作表補充中文片名。

## 專案結構

```text
MovieAlarmWeb/
├─ index.html                 # 頁面與 Excel／PDF 匯入入口
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
│  ├─ pdfScheduleReader.js    # PDF 文字層與場次欄位解析
│  ├─ dcpTitleReader.js       # DCP 中文片名工作表讀取
│  ├─ dcpTitleStorage.js      # 本機 DCP 對照保存
│  ├─ scheduleStorage.js      # 最近成功場次快照保存
│  ├─ parser.js               # 場次、日期、影廳、語言與規格解析
│  ├─ scheduler.js            # 等待中場次與 Next Movie 選取
│  ├─ search.js               # 搜尋規則
│  ├─ filter.js               # 篩選規則
│  ├─ statistics.js           # 統計規則
│  ├─ table.js                # 依 visibleSessions 顯示場次
│  ├─ ui.js                   # Next Movie、偵錯面板與一般 UI 更新
│  ├─ debug.js                # 集中狀態的偵錯資料整理
│  └─ alarm.js                # 唯一 HTMLAudioElement 警報通道
├─ electron/                  # 桌面主程序、受控 preload 與精簡視窗
├─ vendor/                    # 離線 SheetJS 與 PDF.js
└─ assets/                    # 音效、廳別語音與應用程式圖示
```

## 如何執行

一般使用者執行 Windows 安裝版時不需要 Node.js、npm、Python、VS Code 或 Live Server。瀏覽器開發模式可使用本機 HTTP Server 開啟專案，再匯入 `.xlsx`、`.xls`、`.csv` 或 `.pdf` 場次表。

Excel 與 PDF 解析分別使用專案內的 SheetJS `xlsx 0.18.5` 與 PDF.js，不需要連線到外部 CDN。

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

V1.2 不使用 Token、外部圖片、電影翻譯服務或外部電影 metadata 服務。Excel／PDF 匯入成功後，表格、Next Movie、搜尋、篩選與統計都直接使用集中 state；DCP 中文片名只由使用者匯入的本機工作表建立對照。Next Movie 不顯示電影海報。



## 警報音效與開播提醒

當完整 `startDateTime` 到達時，系統會以相同開播時間的場次作為一個群組，只觸發一次音效與大型「場次開始」提醒。Next Movie 會改顯示下一個群組，而提醒 Modal 保留原到點群組，直到使用者按下「停止警報」。

警報採用唯一的 HTMLAudioElement，沒有額外 timer，並以相對路徑 `assets/alarm.wav` 載入專案內的音效檔。每次重新載入頁面後，警報預設為關閉；使用者必須手動點選「開啟警報音效」以符合瀏覽器的播放安全限制。再次點選同一按鈕即可關閉警報，並停止正在播放的正式警報。警報關閉期間到點的群組仍會記錄為已處理，但不會補播舊音效或顯示舊提醒。缺少音檔或瀏覽器阻擋播放時，系統會提供非阻塞提示。

Windows 桌面版由 Electron Main Process 依完整時間戳安排下一個警報群組。到點時會還原既有視窗、顯示提醒並閃爍工作列；停止警報後取消最上層與閃爍狀態。音效可使用預設警報、廳別語音或靜音視覺提醒；設定中心的警報音量會透過安裝檔內含的 Windows Helper 與預設播放裝置主音量雙向同步，因此調整任一側都會更新另一側。公司端不需安裝 SDK、PowerShell、Node.js 或 npm；瀏覽器版本只調整頁面內的警報音量。
## 偵錯資訊

頁面底部提供預設收合的「顯示偵錯資訊」面板。它只讀取集中 state、排程引擎與既有的單一倒數 ticker，可檢視系統時間、匯入檔案、日期時間有效性、下一個群組與場次狀態；展開與收合不會建立或停止任何額外計時器。
## Windows Desktop V1.2

Windows Desktop Preview 使用 Electron 封裝既有 HTML、CSS 與 Vanilla JavaScript，不重寫網站本體。只有建置電腦需要 Node.js 與 npm；一般使用者只需執行建置後的 EXE，不需要安裝 Node.js、npm、Python、VS Code 或 Live Server。

開發與建置指令：

```text
npm install
npm run desktop
npm run build:portable
npm run build:installer
```

`npm run desktop` 啟動 Electron 開發版；`npm run build:portable` 建立 Windows x64 免安裝版，`npm run build:installer` 建立 Windows x64 NSIS 安裝程式。

### V1.2 功能

- 最小化後仍可準時提醒。
- 背景狀態由 Electron Main Process 排程。
- 到點後自動還原、置頂及聚焦。
- 使用 Windows 工作列閃爍提醒。
- SheetJS 已本機化，可離線匯入 Excel。
- PDF.js 已本機化，可離線匯入 PDF 場次表。
- 可匯入並保存本機 DCP 中文片名對照。
- 可保存最近成功場次、顯示每日匯入提醒及場次涵蓋提醒。
- 提供系統匣、開機啟動與精簡監控視窗。
- 提供預設警報、廳別語音與靜音視覺提醒。
- 停止警報後取消強制置頂。

V1.2 的免安裝版檔名為 `Movie-Schedule-Alarm-V1.2-Portable.exe`，NSIS 安裝程式檔名為 `Movie-Schedule-Alarm-V1.2-Setup.exe`。

### SheetJS 離線支援

Excel 匯入使用 SheetJS `xlsx 0.18.5`，瀏覽器 bundle 位於 `vendor/xlsx/xlsx.full.min.js`，Electron 與網站都以相對路徑載入，不依賴 jsDelivr 或其他外部網路資源。套件用途僅為讀取與解析 `.xlsx`、`.xls`、`.csv` 場次表；Apache License 2.0 授權文字保留於 `vendor/xlsx/LICENSE`。

PDF 匯入使用 `vendor/pdfjs/` 內的 PDF.js 與 Worker，授權文字保留於 `vendor/pdfjs/LICENSE`。

### 桌面背景警報限制

- 一般桌面程式上方可自動還原並顯示提醒，但公司安全政策若禁止程式搶焦點，可能只會看到最上層視窗或工作列閃爍。
- Windows UAC 安全桌面、鎖定畫面、登入畫面及其他系統級安全畫面不能由一般 Electron 視窗覆蓋。
- Windows 睡眠或休眠期間程式不會執行；恢復或解除鎖定後會以實際時間重新檢查，並只處理目前排程中最近的未處理群組。
- 多螢幕環境會保留主視窗原本位置；只有視窗已完全離開所有有效螢幕時，才移至目前滑鼠所在螢幕中央。
