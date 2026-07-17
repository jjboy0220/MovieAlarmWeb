import { getNextSessionGroup, getScheduleTimeSummary } from './scheduler.js';
import { parseLocalDateTime } from './utils.js';

// 將數字補零為固定兩位數，供偵錯日期時間使用。
function padNumber(value) {
  return String(value).padStart(2, '0');
}

// 將輸入值轉為安全的日期物件，無效時回傳 null 以避免畫面出現 Invalid Date。
function getSafeDate(value) {
  return parseLocalDateTime(value);
}

// 將日期物件格式化為偵錯專用 YYYY/MM/DD HH:mm:ss，不共用精簡日期顯示函式。
export function formatDebugDateTime(value) {
  const date = getSafeDate(value);
  if (!date) return '—';

  return `${date.getFullYear()}/${padNumber(date.getMonth() + 1)}/${padNumber(date.getDate())} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}:${padNumber(date.getSeconds())}`;
}

// 取得瀏覽器提供的系統時區名稱，無法取得時顯示安全替代文字。
function getTimeZoneName() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || '未提供';
}

// 取得集中 state 中已觸發警報群組的數量，並相容 Set 與陣列型儲存方式。
function getTriggeredAlarmGroupCount(triggeredGroups) {
  if (triggeredGroups instanceof Set) return triggeredGroups.size;
  return Array.isArray(triggeredGroups) ? triggeredGroups.length : 0;
}

// 由集中 state、排程引擎與既有 ticker 執行資訊建立偵錯資料，不建立第二份場次資料。
export function getScheduleDebugInfo(state, now = new Date(), runtime = {}) {
  const currentDate = getSafeDate(now) || new Date();
  const sessions = Array.isArray(state?.sessions) ? state.sessions : [];
  const summary = getScheduleTimeSummary(sessions, currentDate);
  const nextGroup = getNextSessionGroup(sessions, currentDate);

  return {
    currentDateTime: formatDebugDateTime(currentDate),
    timezone: getTimeZoneName(),
    importedFileName: state?.importedFileName || '—',
    importedAt: formatDebugDateTime(state?.importedAt),
    totalSessions: sessions.length,
    validDateTimeSessions: summary.validStartCount,
    invalidDateTimeSessions: summary.invalidStartCount,
    invalidFinishDateTimeSessions: summary.invalidFinishCount,
    earliestSession: formatDebugDateTime(summary.earliestStartDate),
    latestStartSession: formatDebugDateTime(summary.latestStartDate),
    latestFinishSession: formatDebugDateTime(summary.latestFinishDate),
    nextGroupDateTime: nextGroup ? formatDebugDateTime(nextGroup.startDateTime) : '—',
    nextGroupCount: nextGroup ? nextGroup.sessions.length : 0,
    waitingCount: summary.waitingCount,
    playingCount: summary.playingCount,
    finishedCount: summary.finishedCount,
    tickerRunning: Boolean(runtime.tickerRunning),
    tickerIdExists: Boolean(runtime.tickerIdExists),
    lastTickAt: formatDebugDateTime(state?.lastTickerUpdatedAt),
    pageVisible: Boolean(runtime.pageVisible),
    alarmEnabled: Boolean(state?.alarmEnabled),
    alarmToggleLabel: state?.alarmEnabled ? '鬧鐘已開啟' : '鬧鐘已關閉',
    alarmStatusText: state?.alarmEnabled ? '鬧鐘已開啟' : '鬧鐘已關閉',
    alarmUnlocked: Boolean(state?.alarmUnlocked),
    alarmActive: Boolean(state?.activeAlarmGroup),
    activeAlarmGroupKey: state?.activeAlarmGroup?.groupKey || '—',
    triggeredAlarmGroupCount: getTriggeredAlarmGroupCount(state?.triggeredAlarmGroups),
    lastAlarmTriggeredAt: formatDebugDateTime(state?.lastAlarmTriggeredAt),
    audioLoadStatus: state?.audioLoadStatus || '—',
    audioPlayError: state?.audioPlayError || '—',
    missedAlarmGroup: state?.missedAlarmGroup?.groupKey || '—',
    desktopAlarmScheduled: Boolean(state?.desktopAlarmDebug?.desktopAlarmScheduled),
    scheduleReceivedAt: formatDebugDateTime(state?.desktopAlarmDebug?.scheduleReceivedAt),
    scheduledGroupKey: state?.desktopAlarmDebug?.scheduledGroupKey || '—',
    scheduledStartTimestamp: state?.desktopAlarmDebug?.scheduledStartTimestamp || '—',
    calculatedDelayMs: state?.desktopAlarmDebug?.calculatedDelayMs ?? '—',
    desktopScheduledAlarmEnabled: Boolean(state?.desktopAlarmDebug?.alarmEnabled),
    desktopTimerCreated: Boolean(state?.desktopAlarmDebug?.timerCreated),
    rendererWebContentsId: state?.desktopAlarmDebug?.rendererWebContentsId ?? '—',
    mainProcessAlarmTriggeredAt: state?.desktopAlarmDebug?.mainProcessAlarmTriggeredAt || '—',
    mainTimerFiredAt: formatDebugDateTime(state?.desktopAlarmDebug?.mainTimerFiredAt),
    mainTimerDelayMs: state?.desktopAlarmDebug?.mainTimerDelayMs ?? '—',
    windowExists: Boolean(state?.desktopAlarmDebug?.windowExists),
    windowWasMinimized: Boolean(state?.desktopAlarmDebug?.windowWasMinimized),
    windowWasVisible: Boolean(state?.desktopAlarmDebug?.windowWasVisible),
    windowWasFocused: Boolean(state?.desktopAlarmDebug?.windowWasFocused),
    rendererDestroyed: Boolean(state?.desktopAlarmDebug?.rendererDestroyed),
    windowRestored: Boolean(state?.desktopAlarmDebug?.windowRestored),
    ipcTriggerSentAt: formatDebugDateTime(state?.desktopAlarmDebug?.ipcTriggerSentAt),
    ipcTriggerSendSucceeded: Boolean(state?.desktopAlarmDebug?.ipcTriggerSendSucceeded),
    wakeSequenceCompleted: Boolean(state?.desktopAlarmDebug?.wakeSequenceCompleted),
    alwaysOnTopActive: Boolean(state?.desktopAlarmDebug?.alwaysOnTopActive),
    flashFrameActive: Boolean(state?.desktopAlarmDebug?.flashFrameActive),
    lastResumeCheckAt: state?.desktopAlarmDebug?.lastResumeCheckAt || '—',
    missedAlarmDetected: Boolean(state?.desktopAlarmDebug?.missedAlarmDetected),
    ipcScheduleError: state?.desktopAlarmDebug?.ipcScheduleError || '—',
    rendererTriggerReceivedAt: formatDebugDateTime(state?.desktopAlarmDebug?.rendererTriggerReceivedAt),
    receivedGroupKey: state?.desktopAlarmDebug?.receivedGroupKey || '—',
    documentVisibilityState: state?.desktopAlarmDebug?.documentVisibilityState || '—',
    documentHasFocus: Boolean(state?.desktopAlarmDebug?.documentHasFocus),
    rendererAudioUnlocked: Boolean(state?.desktopAlarmDebug?.audioUnlocked),
    rendererAlarmEnabled: Boolean(state?.desktopAlarmDebug?.rendererAlarmEnabled),
    modalOpenedAt: formatDebugDateTime(state?.desktopAlarmDebug?.modalOpenedAt),
    audioPlayCalledAt: formatDebugDateTime(state?.desktopAlarmDebug?.audioPlayCalledAt),
    audioPlayResolvedAt: formatDebugDateTime(state?.desktopAlarmDebug?.audioPlayResolvedAt),
    rendererAudioPlayError: state?.desktopAlarmDebug?.audioPlayError || '—'
  };
}
