const MAX_TIMEOUT_DELAY = 2_147_000_000;
const MAX_SESSION_COUNT = 100;

// 將 IPC 文字欄位限制為安全且有長度上限的純文字。
function normalizeText(value, maxLength = 300) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

// 驗證 Renderer 提供的下一場衍生資料，不接受路徑、URL、命令或完整場次 state。
function validateSchedulePayload(candidate) {
  if (!candidate || typeof candidate !== 'object') throw new Error('警報排程資料格式無效');

  const groupKey = normalizeText(candidate.groupKey, 120);
  const startTimestamp = Number(candidate.startTimestamp);
  const scheduleGeneration = Number(candidate.scheduleGeneration);
  const leadMinutes = Number(candidate.leadMinutes);
  if (!groupKey) throw new Error('警報群組鍵值不可為空');
  if (!Number.isFinite(startTimestamp)) throw new Error('警報開始時間必須是有限數字');
  if (!Array.isArray(candidate.sessions)) throw new Error('警報場次必須是陣列');
  if (candidate.sessions.length > MAX_SESSION_COUNT) throw new Error('警報場次數量超出限制');

  return {
    groupKey,
    startTimestamp,
    scheduleGeneration: Number.isFinite(scheduleGeneration) ? scheduleGeneration : 0,
    leadMinutes: Number.isFinite(leadMinutes) ? Math.min(1440, Math.max(0, leadMinutes)) : 0,
    alarmEnabled: Boolean(candidate.alarmEnabled),
    dateLabel: normalizeText(candidate.dateLabel, 80),
    timeLabel: normalizeText(candidate.timeLabel, 20),
    sessions: candidate.sessions.map(session => ({
      hall: normalizeText(session?.hall, 80),
      title: normalizeText(session?.title, 300),
      language: normalizeText(session?.language, 40),
      format: normalizeText(session?.format, 80)
    }))
  };
}

// 建立 Main Process 唯一警報協調器，以絕對時間排程且不保存完整場次資料。
function createAlarmCoordinator({ getMainWindow, screen, sendTriggered }) {
  let scheduledAlarm = null;
  let scheduledTimer = null;
  let currentGeneration = null;
  const handledGroupKeys = new Set();
  const debugState = {
    desktopAlarmScheduled: false,
    scheduleReceivedAt: null,
    scheduledGroupKey: '',
    scheduledStartTimestamp: null,
    calculatedDelayMs: null,
    alarmEnabled: false,
    timerCreated: false,
    rendererWebContentsId: null,
    mainProcessAlarmTriggeredAt: null,
    mainTimerFiredAt: null,
    mainTimerDelayMs: null,
    windowExists: false,
    windowWasMinimized: false,
    windowWasVisible: false,
    windowWasFocused: false,
    rendererDestroyed: true,
    windowRestored: false,
    ipcTriggerSentAt: null,
    ipcTriggerSendSucceeded: false,
    wakeSequenceCompleted: false,
    alwaysOnTopActive: false,
    flashFrameActive: false,
    lastResumeCheckAt: null,
    missedAlarmDetected: false,
    ipcScheduleError: ''
  };

  // 回傳不含 Timer 與 Electron 物件的安全偵錯快照。
  function getDebugState() {
    return { ...debugState };
  }

  // 清除目前 Main Process 單次計時器，但保留已處理群組紀錄。
  function clearScheduledTimer() {
    if (scheduledTimer !== null) clearTimeout(scheduledTimer);
    scheduledTimer = null;
    debugState.timerCreated = false;
  }

  // 判斷視窗矩形是否仍與任一有效螢幕工作區相交。
  function isWindowOnValidDisplay(windowBounds) {
    return screen.getAllDisplays().some(display => {
      const bounds = display.workArea;
      return windowBounds.x < bounds.x + bounds.width
        && windowBounds.x + windowBounds.width > bounds.x
        && windowBounds.y < bounds.y + bounds.height
        && windowBounds.y + windowBounds.height > bounds.y;
    });
  }

  // 僅在既有視窗完全離開有效螢幕時，移至滑鼠所在螢幕中央。
  function ensureWindowOnValidDisplay(window) {
    if (isWindowOnValidDisplay(window.getBounds())) return;
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const bounds = window.getBounds();
    window.setPosition(
      Math.round(display.workArea.x + (display.workArea.width - bounds.width) / 2),
      Math.round(display.workArea.y + (display.workArea.height - bounds.height) / 2)
    );
  }

  // 還原並喚醒既有主視窗，不建立第二個 BrowserWindow。
  function wakeMainWindow() {
    const window = getMainWindow();
    debugState.windowExists = Boolean(window && !window.isDestroyed());
    if (!debugState.windowExists) return false;

    debugState.windowWasMinimized = window.isMinimized();
    debugState.windowWasVisible = window.isVisible();
    debugState.windowWasFocused = window.isFocused();
    debugState.rendererDestroyed = window.webContents.isDestroyed();
    debugState.windowRestored = false;
    debugState.wakeSequenceCompleted = false;
    if (debugState.rendererDestroyed) return false;
    if (window.isMinimized()) {
      window.restore();
      debugState.windowRestored = true;
    }
    window.webContents.setAudioMuted(false);
    ensureWindowOnValidDisplay(window);
    window.show();
    window.setAlwaysOnTop(true, 'screen-saver');
    window.moveTop();
    window.focus();
    window.flashFrame(true);
    debugState.alwaysOnTopActive = true;
    debugState.flashFrameActive = true;
    debugState.wakeSequenceCompleted = true;
    return true;
  }

  // 到達絕對時間時只處理單一群組；關閉鬧鐘時只記錄、不搶焦點。
  function triggerScheduledAlarm(missedAlarmDetected = false) {
    const alarm = scheduledAlarm;
    if (!alarm || handledGroupKeys.has(alarm.groupKey)) return;

    clearScheduledTimer();
    scheduledAlarm = null;
    handledGroupKeys.add(alarm.groupKey);
    debugState.desktopAlarmScheduled = false;
    debugState.mainProcessAlarmTriggeredAt = Date.now();
    debugState.mainTimerFiredAt = debugState.mainProcessAlarmTriggeredAt;
    const triggerTimestamp = alarm.startTimestamp - alarm.leadMinutes * 60_000;
    debugState.mainTimerDelayMs = debugState.mainTimerFiredAt - triggerTimestamp;
    debugState.missedAlarmDetected = Boolean(missedAlarmDetected);

    const windowWoken = alarm.alarmEnabled ? wakeMainWindow() : false;
    debugState.ipcTriggerSentAt = Date.now();
    debugState.ipcTriggerSendSucceeded = Boolean(windowWoken);
    try {
      const sendResult = sendTriggered({
        ...alarm,
        shouldAlert: Boolean(alarm.alarmEnabled && windowWoken),
        missedAlarmDetected: Boolean(missedAlarmDetected),
        debug: getDebugState()
      });
      debugState.ipcTriggerSendSucceeded = Boolean(sendResult?.sent);
      debugState.rendererDestroyed = Boolean(sendResult?.rendererDestroyed);
      debugState.rendererWebContentsId = sendResult?.rendererWebContentsId ?? debugState.rendererWebContentsId;
    } catch {
      debugState.ipcTriggerSendSucceeded = false;
      debugState.ipcScheduleError = '警報 Trigger 無法送至 Renderer';
    }
  }

  // 依 startTimestamp 與提前分鐘重新計算實際差值，長延遲也不以每秒遞減。
  function armScheduledAlarm() {
    clearScheduledTimer();
    if (!scheduledAlarm || handledGroupKeys.has(scheduledAlarm.groupKey)) return;

    const triggerTimestamp = scheduledAlarm.startTimestamp - scheduledAlarm.leadMinutes * 60_000;
    const remainingMilliseconds = triggerTimestamp - Date.now();
    if (remainingMilliseconds <= 0) {
      triggerScheduledAlarm(true);
      return;
    }
    scheduledTimer = setTimeout(
      remainingMilliseconds > MAX_TIMEOUT_DELAY ? armScheduledAlarm : () => triggerScheduledAlarm(false),
      Math.min(remainingMilliseconds, MAX_TIMEOUT_DELAY)
    );
    debugState.timerCreated = true;
  }

  // 安排或更新下一群組；相同時間群組只更新啟用狀態，不重複建立計時器。
  function schedule(candidate) {
    try {
      const payload = validateSchedulePayload(candidate);
      debugState.ipcScheduleError = '';
      debugState.scheduleReceivedAt = Date.now();
      debugState.alarmEnabled = payload.alarmEnabled;
      const window = getMainWindow();
      debugState.rendererWebContentsId = window && !window.isDestroyed() && !window.webContents.isDestroyed()
        ? window.webContents.id
        : null;

      if (currentGeneration !== payload.scheduleGeneration) {
        handledGroupKeys.clear();
        currentGeneration = payload.scheduleGeneration;
      }
      if (handledGroupKeys.has(payload.groupKey)) return getDebugState();

      const existingTarget = scheduledAlarm
        ? scheduledAlarm.startTimestamp - scheduledAlarm.leadMinutes * 60_000
        : null;
      const nextTarget = payload.startTimestamp - payload.leadMinutes * 60_000;
      const sameSchedule = scheduledAlarm?.groupKey === payload.groupKey && existingTarget === nextTarget;
      scheduledAlarm = payload;
      debugState.desktopAlarmScheduled = true;
      debugState.scheduledGroupKey = payload.groupKey;
      debugState.scheduledStartTimestamp = payload.startTimestamp;
      debugState.calculatedDelayMs = nextTarget - debugState.scheduleReceivedAt;
      debugState.missedAlarmDetected = false;
      if (!sameSchedule) armScheduledAlarm();
      return getDebugState();
    } catch (error) {
      debugState.ipcScheduleError = error instanceof Error ? error.message : '警報排程資料無法處理';
      throw error;
    }
  }

  // 取消尚未到點的單一排程，已處理群組仍保留以避免補響。
  function cancel() {
    clearScheduledTimer();
    scheduledAlarm = null;
    debugState.desktopAlarmScheduled = false;
    debugState.scheduledGroupKey = '';
    debugState.scheduledStartTimestamp = null;
    return getDebugState();
  }

  // 停止工作列閃爍與最上層狀態，並保留已處理的 groupKey。
  function acknowledge(groupKey) {
    const normalizedGroupKey = normalizeText(groupKey, 120);
    if (normalizedGroupKey) handledGroupKeys.add(normalizedGroupKey);
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.flashFrame(false);
      window.setAlwaysOnTop(false);
    }
    debugState.alwaysOnTopActive = false;
    debugState.flashFrameActive = false;
    return getDebugState();
  }

  // 睡眠恢復或解鎖後立即用 Date.now 重新檢查，只觸發目前最近的單一排程。
  function checkAfterResume() {
    debugState.lastResumeCheckAt = Date.now();
    if (!scheduledAlarm) return getDebugState();
    const triggerTimestamp = scheduledAlarm.startTimestamp - scheduledAlarm.leadMinutes * 60_000;
    if (Date.now() >= triggerTimestamp) triggerScheduledAlarm(true);
    else armScheduledAlarm();
    return getDebugState();
  }

  // Renderer 完成載入後補送 pending Trigger 時，回寫同一份 Main Process 診斷狀態。
  function recordIpcSend({ sentAt, succeeded, rendererDestroyed, rendererWebContentsId }) {
    debugState.ipcTriggerSentAt = Number.isFinite(sentAt) ? sentAt : debugState.ipcTriggerSentAt;
    debugState.ipcTriggerSendSucceeded = Boolean(succeeded);
    debugState.rendererDestroyed = Boolean(rendererDestroyed);
    debugState.rendererWebContentsId = rendererWebContentsId ?? debugState.rendererWebContentsId;
    return getDebugState();
  }

  return { schedule, cancel, acknowledge, checkAfterResume, recordIpcSend, getDebugState };
}

module.exports = { createAlarmCoordinator, validateSchedulePayload };
