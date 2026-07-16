import { parseLocalDateTime } from './utils.js';

let countdownIntervalId = null;

// 依目標開播時間與目前實際時間計算剩餘秒數；不回傳負數。
export function getCountdownSeconds(targetDateTime, now = new Date()) {
  const targetDate = parseLocalDateTime(targetDateTime);
  const currentDate = parseLocalDateTime(now) || new Date();
  if (!targetDate) return 0;

  return Math.max(0, Math.ceil((targetDate.getTime() - currentDate.getTime()) / 1000));
}

// 將秒數格式化為固定 HH:MM:SS，供 Next Movie 卡片使用。
export function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

// 回傳唯一倒數計時器的執行資訊，供偵錯面板讀取且不暴露計時器物件。
export function getCountdownTickerStatus() {
  return {
    tickerRunning: countdownIntervalId !== null,
    tickerIdExists: countdownIntervalId !== null
  };
}

// 停止既有倒數 interval，確保全站同時間只存在一個計時器。
export function stopCountdownTicker() {
  if (countdownIntervalId !== null) {
    globalThis.clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }
}

// 啟動單一倒數 interval；每次 tick 都以新的 Date 重新計算實際時間差。
export function startCountdownTicker(onTick) {
  stopCountdownTicker();
  if (typeof onTick !== 'function') return null;

  const tick = () => onTick(new Date());
  countdownIntervalId = globalThis.setInterval(tick, 1000);
  tick();
  return countdownIntervalId;
}