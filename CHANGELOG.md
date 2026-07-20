# Changelog

本專案的重大功能、修正與發佈變更記錄於此。正式版本採用語意化版本編號。

## [Unreleased]

### 準備中

- 完成 V1.0 Release Candidate 全面回歸測試。
- 評估 Electron 安全版本升級、程式碼簽章與 SmartScreen 發布者信任。

## [1.0.0] - 2026-07-18

### Released

- 完成 Excel／PDF 離線匯入、整週營運日、跨午夜、DCP 中文片名、Next Movie、倒數及背景警報。
- 完成 Windows Portable、NSIS Setup、正式圖示、系統匣常駐、登入啟動、場次恢復與週期結束提醒。
- 完成核心自動回歸、實際整週 PDF、Windows Desktop 與正式 EXE 人工驗收。

## [1.0.0-preview.4] - 2026-07-18

### Added

- 新增完全離線的 PDF 場次表匯入與損壞日期標題受控修復。
- 新增整週營運日切換、跨午夜實際日期分組及週期結束提醒。
- 新增 DCP 中文片名對照、每週完整取代、失敗保留與本機恢復。
- 新增 Windows 系統匣背景常駐、最小化隱藏、雙擊還原與關閉監控確認。
- 新增場次週期本機恢復，啟動後重新計算狀態及後續警報。
- 新增正式 Windows 圖示與應用程式作者 metadata。
- 新增 LIVE、SPECIAL 與錯誤 CONAN SPECIAL 自動修復為 DIG SPECIAL。

### Changed

- 改善 Next Movie、Alarm Modal、影廳、片名、語言、規格與倒數的資訊層級。
- Windows Desktop 每次啟動預設開啟鬧鐘；瀏覽器仍維持手動音訊解鎖。
- Portable 與 Setup 完整封裝 SheetJS、PDF.js 與 alarm.wav。

### Security

- Electron 已由 `37.10.3` 升級至 `43.1.1`，並完成核心回歸與 npm 安全稽核。

- Electron Renderer 維持 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`。
- Preload 只暴露固定警報、啟動、提醒與監控摘要 IPC，不暴露 Node.js API 或完整 ipcRenderer。

### Known limitations

- 尚未實作 Windows 系統主音量雙向同步。
- 尚未完成正式程式碼簽章與 SmartScreen 發布者信任。
- Electron 主版本安全升級仍需獨立相容性驗證。

## [1.0.0-preview.3] - 2026-07-17

- 新增 Windows 登入自動啟動、當日場次提醒、固定 AppUserModelID 與單一實例行為。

## [1.0.0-preview.2] - 2026-07-17

- 新增 Electron Main Process 背景警報、最小化還原置頂、安全 preload IPC 與離線 SheetJS。
# V1.2.0 - 2026-07-20

- 新增無標題列、圓角、最上層的 Next Movie 小視窗。
- 小視窗支援深色與淺色模式、右鍵選單及小視窗警報提醒。
- 新增依同時場次順序循環的廳別語音播報。
- 設定中心新增廳別語音單次測試。
- 優先使用 Windows 台灣中文本機語音並改善語速與句間停頓。
