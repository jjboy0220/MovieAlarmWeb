# Movie Schedule Alarm V1.0

Movie Schedule Alarm 是以 HTML、CSS 與 Vanilla JavaScript 製作的影城營運場次工具。此專案目前完成 **Commit 2：Excel Reader**，可將場次表匯入瀏覽器並轉換為標準化電影物件。

## 專案架構

```text
MovieAlarmWeb/
├─ index.html                 # 頁面與 Excel 匯入入口
├─ css/                       # 深色主題、表格、卡片與標籤樣式
├─ js/
│  ├─ app.js                  # 匯入流程與既有 UI 整合
│  ├─ excelReader.js          # 工作表讀取、標題定位、列資料轉換
│  ├─ parser.js               # 電影片名、語言、格式、影廳解析
│  ├─ table.js                # 電影物件表格渲染
│  ├─ ui.js                   # 頁面狀態更新
│  └─ 其餘模組                 # 後續監控、倒數與警報擴充點
└─ assets/                    # 圖示與本機資產
```

## 如何執行

不需要 Node.js、npm 或前端框架。

1. 使用 VS Code Live Server 開啟專案根目錄，或直接以瀏覽器開啟 `index.html`。
2. 按「選擇 Excel」，選取 `.xlsx`、`.xls` 或 `.csv` 場次檔。
3. 瀏覽器會讀取工作表並顯示已標準化的場次表格。

Excel 讀取使用瀏覽器版 SheetJS CDN，因此首次載入需要網路連線。

## 實際 Excel 解析規則

`excelReader.js` 已根據提供的 `場次表.xlsx` 結構設計：

- 自動逐列尋找 `Screen`、`Start`、`Finish`、`Film Title` 標題，不固定第 7 列或任何欄位索引。
- 參考檔中 `Start` 是合併標題 `F7:H7`，實際時間值在同區段的 G 欄。程式會統計每個標題區段下方的有效值，自動找出實際資料欄，避免把合併標題左上角誤當資料欄。
- 所有空白列、報表說明列、缺少必要欄位的列會自動略過。
- 數字影廳轉換為 `C1` 至 `C9`；`GC01` 與 `GC02` 等名稱保留。
- `C`、`E`、`J` 語言代碼轉換為 `CHI`、`ENG`、`JAN`。
- 支援 `DIG`、`TITAN`、`IMAX`、`ATMOS`、`4DX` 格式。

## 回傳物件

`parseScheduleRows(rows)` 會回傳電影物件陣列；`readExcel(file)` 會回傳工作表名稱與該陣列。

```js
{
  id: 'row-12-8-10:00',
  sourceRow: 12,
  screen: '8',
  hall: 'C8',
  start: '10:00',
  finish: '12:06',
  language: 'CHI',
  format: 'DIG',
  title: 'MOANA (LIVE ACTION)',
  displayTitle: 'CHI｜MOANA (LIVE ACTION)',
  rawFilmTitle: '(DIG C)MOANA (LIVE ACTION)'
}
```

## 後續 Electron 遷移

現有解析器與 UI 模組均為瀏覽器端純函式。日後遷移至 Electron 時，可讓主程序負責原生檔案選擇與系統通知，並透過 preload 提供受控 API；`js/` 下的解析與顯示邏輯可直接保留。