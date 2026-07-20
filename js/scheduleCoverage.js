import { addDaysToDate, normalizeText, parseLocalDateTime } from './utils.js';

export const OPERATIONAL_DAY_START_HOUR = 6;

// 將本機日期轉為 YYYY-MM-DD，供營運日顯示與場次涵蓋範圍判定共用。
export function getLocalDateKey(value = new Date()) {
  const date = parseLocalDateTime(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 依 06:00 營運日分界將凌晨場次歸入前一營運日，但不改變實際日期時間。
export function getOperationalDateForStart(dateKey, startTime) {
  const normalizedDateKey = normalizeText(dateKey);
  const hour = Number.parseInt(normalizeText(startTime).split(':')[0], 10);
  if (!normalizedDateKey || !Number.isInteger(hour)) return normalizedDateKey;
  return hour < OPERATIONAL_DAY_START_HOUR ? addDaysToDate(normalizedDateKey, -1) : normalizedDateKey;
}

// 依 06:00 分界取得目前營運日，讓凌晨打烊場在系統日期跨日後仍留在前一日。
export function getOperationalDateKey(sessions, now = new Date()) {
  const currentDate = parseLocalDateTime(now);
  const todayKey = getLocalDateKey(currentDate);
  if (!currentDate || !todayKey) return '';
  return currentDate.getHours() < OPERATIONAL_DAY_START_HOUR ? addDaysToDate(todayKey, -1) : todayKey;
}

// 從完整 sessions 衍生目前營運日清單，不建立第二份可變場次狀態。
export function getOperationalSessions(sessions, now = new Date()) {
  const operationalDateKey = getOperationalDateKey(sessions, now);
  return (Array.isArray(sessions) ? sessions : []).filter(session => (
    normalizeText(session?.operationalDate || session?.date) === operationalDateKey
  ));
}

// 判定整份匯入資料是否已無任何未來或播放中場次，供最後一場結束後提醒更新資料。
export function getScheduleCoverageState(sessions, now = new Date()) {
  const currentDate = parseLocalDateTime(now);
  const validSessions = (Array.isArray(sessions) ? sessions : []).map(session => ({
    startDate: parseLocalDateTime(session?.startDateTime),
    finishDate: parseLocalDateTime(session?.finishDateTime)
  })).filter(session => session.startDate && session.finishDate);

  if (!currentDate || !validSessions.length) {
    return { exhausted: false, latestFinishDate: null, coverageKey: '' };
  }

  const latestFinishDate = new Date(Math.max(...validSessions.map(session => session.finishDate.getTime())));
  return {
    exhausted: currentDate.getTime() >= latestFinishDate.getTime(),
    latestFinishDate,
    coverageKey: latestFinishDate.toISOString()
  };
}
