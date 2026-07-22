# TC iPhone App

這個子專案以 Capacitor 封裝既有 TC 網頁核心，不包含 MM 設定，也不建立第二套 Parser 或 application state。

## Windows 開發流程

1. 在 Repository 根目錄完成共用網頁功能。
2. 進入 `iphone-tc` 執行 `npm install`。
3. 執行 `npm run build:web` 產生 `www`。
4. Push 後，在 GitHub Actions 手動執行 `TC iPhone Build Check`。

`www` 與 `ios` 都是建置產物，不提交 Git。macOS Runner 會重新產生它們並執行未簽章的 iPhone Simulator 編譯驗證。
Runner 也會將既有 `assets/app-icon.png` 轉成 Apple 要求的 1024×1024 App Icon，因此 TC 的品牌圖示仍由共用資產維護。

## 已知限制

- 未簽章的 Simulator `.app` 不能直接安裝到實體 iPhone。
- 實體 iPhone、TestFlight 與 App Store 需要 Apple Developer Program、唯一 Bundle ID、簽章憑證及 Provisioning Profile。
- iOS 不允許 App 任意控制系統音量，設定只會調整 App 內警報音量。
- JavaScript 警報只保證 App 在前景時運作；鎖屏與背景準時提醒需要後續加入 iOS 本機通知。
- iOS 實機匯入 Excel/PDF、音訊播放與背景恢復仍須在 iPhone 上人工測試。
