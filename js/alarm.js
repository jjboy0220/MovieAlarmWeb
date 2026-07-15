// 初始化版本保留警報模組介面，不載入音效或執行警報。
export function createAlarmChannel() { return { enabled: false, reason: 'Commit 1 尚未啟用場次警報' }; }
export function requestAlarmPermission() { return Promise.resolve({ granted: false, reason: 'Commit 1 尚未啟用場次警報' }); }
