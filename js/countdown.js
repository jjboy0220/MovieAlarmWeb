// 初始化版本只宣告倒數模組的輸出契約，不進行時間差計算。
export const COUNTDOWN_UNAVAILABLE = '尚未啟用';
export function getCountdownPresentation() { return { text: COUNTDOWN_UNAVAILABLE, active: false }; }
