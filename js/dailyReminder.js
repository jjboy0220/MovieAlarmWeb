import { normalizeText, parseLocalDateTime } from './utils.js';

export const INITIAL_DAILY_REMINDER_DELAY_MS = 5 * 1000;
export const SNOOZE_DAILY_REMINDER_DELAY_MS = 30 * 60 * 1000;

// 將目前本機日期轉為場次既有的 YYYY-MM-DD 日期鍵，不依賴檔名或匯入時間。
function getLocalDateKey(now) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 使用既有標準化日期與有效開始時間判定是否已匯入本機今天的場次。
export function hasTodaySchedule(sessions, now = new Date()) {
  const todayDateKey = getLocalDateKey(now);
  if (!todayDateKey || !Array.isArray(sessions)) return false;
  return sessions.some(session => (
    normalizeText(session?.date) === todayDateKey
    && Boolean(parseLocalDateTime(session?.startDateTime))
  ));
}

// 建立唯一可取消的單次提醒 Timer；重新安排前一定先清除上一個 Timer。
export function createDailyReminderTimer(onCheck) {
  let timerId = null;

  // 以指定延遲安排一次檢查，同時間只保留一個提醒 Timer。
  function schedule(delayMs) {
    cancel();
    const safeDelay = Number.isFinite(delayMs) ? Math.max(0, delayMs) : INITIAL_DAILY_REMINDER_DELAY_MS;
    timerId = globalThis.setTimeout(() => {
      timerId = null;
      onCheck();
    }, safeDelay);
  }

  // 取消目前提醒 Timer，匯入今日場次或關閉頁面時不再執行。
  function cancel() {
    if (timerId === null) return;
    globalThis.clearTimeout(timerId);
    timerId = null;
  }

  // 回傳 Timer 是否存在，供集中 Debug 顯示而不暴露實際 Timer 物件。
  function isScheduled() {
    return timerId !== null;
  }

  return Object.freeze({ schedule, cancel, isScheduled });
}
