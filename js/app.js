import { APP_NAME, VERSION } from './config.js';
import { loadSettings, normalizeSettings, saveSettings } from './settings.js';
import { readExcel } from './excelReader.js';
import { createSessionGroupKey, getLatestUntriggeredSessionGroup, getNextMoviePresentationState, sortSessionsByStart, updateSessionStatuses } from './scheduler.js';
import { formatCountdown, getCountdownSeconds, getCountdownTickerStatus, startCountdownTicker } from './countdown.js';
import { createAlarmChannel } from './alarm.js';
import { getScheduleDebugInfo } from './debug.js';
import { applyTheme, bindAlarmControls, bindDebugPanel, bindSettingsControls, bindThemeToggle, hideAlarmModal, updateAlarmModalNotice, updateAlarmNotice, updateAlarmToggle, updateDebugPanel, updateFileStatus, updateNextMovieCard, updateSettingsForm, updateSettingsNotice, updateStatistics, setTableNotice, showAlarmModal } from './ui.js';
import { createEmptyTable, renderMovieRows } from './table.js';
import { bindSearch, matchesSearch } from './search.js';
import { bindFilters, matchesFilters, populateFilterOptions } from './filter.js';
import { summarizeSessions } from './statistics.js';

const alarmChannel = createAlarmChannel();
const desktopAlarm = globalThis.desktopAlarm || null;
let desktopAlarmScheduleSignature = '';
let unsubscribeDesktopAlarm = null;

// 單一應用程式狀態，所有清單、警報、搜尋、篩選、Next Movie 與偵錯資訊都由此處驅動。
const state = {
  sessions: [],
  visibleSessions: [],
  searchText: '',
  hallFilter: 'ALL',
  languageFilter: 'ALL',
  formatFilter: 'ALL',
  statusFilter: 'ACTIVE',
  importedFileName: '',
  importedAt: null,
  settings: loadSettings(),
  lastTickerUpdatedAt: null,
  nextSessionGroup: null,
  activeAlarmGroup: null,
  triggeredAlarmGroups: new Set(),
  alarmEnabled: false,
  alarmUnlocked: false,
  lastAlarmTriggeredAt: null,
  audioLoadStatus: '載入中',
  audioPlayError: '',
  missedAlarmGroup: null,
  pageWasHidden: false,
  desktopAlarmDebug: {
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
    ipcScheduleError: '',
    rendererTriggerReceivedAt: null,
    receivedGroupKey: '',
    documentVisibilityState: '',
    documentHasFocus: false,
    audioUnlocked: false,
    rendererAlarmEnabled: false,
    modalOpenedAt: null,
    audioPlayCalledAt: null,
    audioPlayResolvedAt: null,
    audioPlayError: ''
  }
};

// 將 Main Process 回傳的桌面警報狀態合併到集中 state，供既有 Debug Panel 顯示。
function applyDesktopAlarmDebug(debugInfo) {
  if (!debugInfo || typeof debugInfo !== 'object') return;
  state.desktopAlarmDebug = { ...state.desktopAlarmDebug, ...debugInfo };
}

// 由完整 sessions 找回已驗證 groupKey 的原始群組，Main Process 不持有第二份場次 state。
function findSessionGroupByKey(groupKey) {
  const sessions = state.sessions.filter(session => createSessionGroupKey(session.startDateTime) === groupKey);
  if (!sessions.length) return null;
  return {
    groupKey,
    startDateTime: sessions[0].startDateTime,
    startDate: new Date(sessions[0].startDateTime),
    sessions
  };
}

// 建立 Main Process 唯一需要的下一群組衍生資料，不傳送完整 state.sessions。
function createDesktopAlarmPayload(group) {
  const firstSession = group?.sessions?.[0];
  const startTimestamp = group?.startDate?.getTime?.() ?? new Date(group?.startDateTime).getTime();
  if (!firstSession || !Number.isFinite(startTimestamp)) return null;
  return {
    groupKey: group.groupKey,
    startTimestamp,
    scheduleGeneration: state.importedAt?.getTime?.() || 0,
    leadMinutes: state.settings.alarmLeadMinutes,
    alarmEnabled: state.alarmEnabled,
    dateLabel: `${firstSession.date || ''} ${firstSession.weekday || ''}`.trim(),
    timeLabel: firstSession.start || '',
    sessions: group.sessions.map(session => ({
      hall: session.hall || '',
      title: session.title || '',
      language: session.language || '',
      format: session.formatDisplay || session.format || ''
    }))
  };
}

// 只在下一群組、提醒時間或鬧鐘開關改變時同步 Main Process，避免每秒重建排程。
async function syncDesktopAlarmSchedule() {
  if (!desktopAlarm) return;
  const payload = createDesktopAlarmPayload(state.nextSessionGroup);
  const signature = payload
    ? `${payload.scheduleGeneration}|${payload.groupKey}|${payload.startTimestamp}|${payload.leadMinutes}|${payload.alarmEnabled}`
    : 'cancelled';
  if (signature === desktopAlarmScheduleSignature) return;
  desktopAlarmScheduleSignature = signature;

  try {
    const debugInfo = payload ? await desktopAlarm.schedule(payload) : await desktopAlarm.cancel();
    applyDesktopAlarmDebug(debugInfo);
  } catch (error) {
    state.desktopAlarmDebug.ipcScheduleError = error instanceof Error ? error.message : '桌面警報 IPC 排程失敗';
  }
  updateDebugPanelFromState(new Date());
}

// 接收 Main Process 到點事件，使用集中 sessions 顯示既有 Modal 或只記錄關閉期間的群組。
function handleDesktopAlarmTriggered(payload) {
  applyDesktopAlarmDebug(payload?.debug);
  const groupKey = typeof payload?.groupKey === 'string' ? payload.groupKey : '';
  Object.assign(state.desktopAlarmDebug, {
    rendererTriggerReceivedAt: Date.now(),
    receivedGroupKey: groupKey,
    documentVisibilityState: document.visibilityState,
    documentHasFocus: document.hasFocus(),
    audioUnlocked: state.alarmUnlocked,
    rendererAlarmEnabled: state.alarmEnabled,
    modalOpenedAt: null,
    audioPlayCalledAt: null,
    audioPlayResolvedAt: null,
    audioPlayError: ''
  });
  const group = findSessionGroupByKey(groupKey);
  if (!group || state.triggeredAlarmGroups.has(groupKey)) {
    void desktopAlarm?.acknowledge(groupKey).then(applyDesktopAlarmDebug).catch(() => {});
    return;
  }
  if (state.activeAlarmGroup) {
    state.triggeredAlarmGroups.add(groupKey);
    state.missedAlarmGroup = group;
    void desktopAlarm?.acknowledge(groupKey).then(applyDesktopAlarmDebug).catch(() => {});
    return;
  }

  triggerAlarmGroup(group, new Date(), Boolean(payload?.missedAlarmDetected));
  if (!payload?.shouldAlert || !state.alarmEnabled) {
    void desktopAlarm?.acknowledge(groupKey).then(applyDesktopAlarmDebug).catch(() => {});
  }
  updateDebugPanelFromState(new Date());
}

// 將設定變更正規化後存入唯一 state，套用到 UI 與既有 Audio Channel，且不建立額外 Timer。
function updateSettings(patch, shouldPersist = true) {
  state.settings = normalizeSettings({ ...state.settings, ...patch });
  applyTheme(state.settings.theme);
  alarmChannel.applySettings(state.settings);
  updateSettingsForm(state.settings);

  const result = shouldPersist ? saveSettings(state.settings) : { success: true, message: '' };
  updateSettingsNotice(result.success ? '' : result.message);
  void syncDesktopAlarmSchedule();
  updateDebugPanelFromState(new Date());
}
// 將唯一 Audio Alarm Channel 的執行快照同步到集中 state，供 UI 與偵錯面板讀取。
function syncAlarmRuntimeState() {
  const alarmRuntime = alarmChannel.getState();
  state.alarmEnabled = alarmRuntime.enabled;
  state.alarmUnlocked = alarmRuntime.unlocked;
  state.audioLoadStatus = alarmRuntime.audioLoadStatus;
  state.audioPlayError = alarmRuntime.audioPlayError;
  updateAlarmToggle(state.alarmEnabled);
}

// 取得警報 Modal 需要呈現的音效提示；音效失敗時不影響場次提醒本身。
function getAlarmAudioNotice() {
  return state.audioPlayError || '';
}

// 將目前的搜尋與全部篩選條件同時套用，並從集中 state 重新渲染畫面。
function applyFilters(now = new Date()) {
  state.visibleSessions = state.sessions.filter(session => (
    matchesSearch(session, state.searchText) && matchesFilters(session, state)
  ));
  renderFromState(now);
}

// 以完整 state.sessions 更新 Next Movie，並將下一個群組與目前警報群組保持為獨立 state。
function updateNextMovieClock(now = new Date()) {
  const presentation = getNextMoviePresentationState(state.sessions, Boolean(state.importedFileName), now);
  state.nextSessionGroup = presentation.group || null;
  const countdown = presentation.type === 'upcoming'
    ? formatCountdown(getCountdownSeconds(presentation.group.startDateTime, now))
    : formatCountdown(0);
  updateNextMovieCard(presentation, countdown);
}

// 以目前集中 state 更新警報 Modal 的音效提示，不會重建或覆蓋 activeAlarmGroup。
function updateActiveAlarmNotice() {
  if (state.activeAlarmGroup) updateAlarmModalNotice(getAlarmAudioNotice());
}

// 以現有 state 和唯一倒數 ticker 的執行資訊更新偵錯面板，展開前不寫入偵錯 DOM。
function updateDebugPanelFromState(now = new Date()) {
  syncAlarmRuntimeState();
  const debugInfo = getScheduleDebugInfo(state, now, {
    ...getCountdownTickerStatus(),
    pageVisible: !document.hidden
  });
  updateDebugPanel(debugInfo, state.settings.debugPanelOpen);
}

// 實際啟動警報音效；播放失敗時仍保留 Modal，並以非阻塞訊息提示使用者。
async function playAlarmForGroup(group) {
  state.desktopAlarmDebug.audioPlayCalledAt = Date.now();
  const result = await alarmChannel.startAlarm(state.settings);
  state.desktopAlarmDebug.audioPlayResolvedAt = Date.now();
  state.desktopAlarmDebug.audioPlayError = result.message || '';
  syncAlarmRuntimeState();

  if (state.activeAlarmGroup?.groupKey === group.groupKey) {
    updateActiveAlarmNotice();
  }
  if (result.message) updateAlarmNotice(result.message);
  updateDebugPanelFromState(new Date());
}

// 記錄到點群組；警報關閉時只標示為已處理，絕不補播音效、Modal 或視覺閃爍。
function triggerAlarmGroup(group, now, isMissed) {
  if (!group || state.activeAlarmGroup || state.triggeredAlarmGroups.has(group.groupKey)) return;

  state.triggeredAlarmGroups.add(group.groupKey);
  if (isMissed) state.missedAlarmGroup = group;
  if (!state.alarmEnabled) return;

  state.lastAlarmTriggeredAt = now;
  state.activeAlarmGroup = group;
  showAlarmModal(group, getAlarmAudioNotice(), state.settings.alarmLeadMinutes);
  state.desktopAlarmDebug.modalOpenedAt = Date.now();
  void playAlarmForGroup(group);
}

// 檢查前一次可見 ticker 與目前時間之間跨過的群組；背景恢復時只處理最近的一組。
function checkAlarmSchedule(now, previousTickAt, resumedFromBackground) {
  if (!state.importedFileName || !previousTickAt || state.activeAlarmGroup) return;

  const leadOffset = state.settings.alarmLeadMinutes * 60 * 1000;
  const reminderPreviousTickAt = new Date(previousTickAt.getTime() + leadOffset);
  const reminderNow = new Date(now.getTime() + leadOffset);
  const { group, crossedGroupCount } = getLatestUntriggeredSessionGroup(
    state.sessions,
    reminderPreviousTickAt,
    reminderNow,
    state.triggeredAlarmGroups
  );
  if (!group) return;

  triggerAlarmGroup(group, now, resumedFromBackground || crossedGroupCount > 1);
}

// 停止音效、關閉 Modal 並保留已觸發群組紀錄，避免停止後重新觸發同一場次。
function stopActiveAlarm() {
  const stoppedGroupKey = state.activeAlarmGroup?.groupKey || '';
  alarmChannel.stopAlarm(state.settings);
  state.activeAlarmGroup = null;
  syncAlarmRuntimeState();
  hideAlarmModal();
  updateNextMovieClock(new Date());
  if (desktopAlarm) {
    void desktopAlarm.acknowledge(stoppedGroupKey).then(applyDesktopAlarmDebug).catch(() => {});
  }
  updateDebugPanelFromState(new Date());
}

// 在使用者點選單一開關時解鎖音效；成功只更新狀態 Badge，失敗才顯示非阻塞錯誤提示。
async function enableAlarmSound() {
  const result = await alarmChannel.unlock(state.settings);
  syncAlarmRuntimeState();
  updateAlarmNotice(result.success ? '' : result.message);
  updateActiveAlarmNotice();
  void syncDesktopAlarmSchedule();
  updateDebugPanelFromState(new Date());
  return result;
}

// 關閉警報沿用既有正式停止流程，再關閉唯一 enabled 開關且保留已觸發群組。
function disableAlarmSound() {
  stopActiveAlarm();
  alarmChannel.disableAlarm(state.settings);
  syncAlarmRuntimeState();
  updateAlarmNotice('');
  void syncDesktopAlarmSchedule();
  updateDebugPanelFromState(new Date());
}

// 以唯一的 state.alarmEnabled 決定單一控制按鈕要啟用或關閉警報。
function toggleAlarmSound() {
  if (state.alarmEnabled) {
    disableAlarmSound();
    return;
  }
  void enableAlarmSound();
}
// 集中處理唯一 ticker 的每秒更新，讓 Alarm、Next Movie 與展開的偵錯面板共用同一個時間來源。
function handleTimeTick(now = new Date(), resumedFromBackground = false) {
  if (document.hidden && !desktopAlarm) return;

  const previousTickAt = state.lastTickerUpdatedAt;
  if (!desktopAlarm) checkAlarmSchedule(now, previousTickAt, resumedFromBackground || state.pageWasHidden);
  state.lastTickerUpdatedAt = now;
  state.pageWasHidden = false;
  syncAlarmRuntimeState();
  state.sessions = updateSessionStatuses(state.sessions, now);
  applyFilters(now);
  updateActiveAlarmNotice();
}

// 集中處理 Next Movie、表格、統計與空狀態，避免各模組各自持有場次資料。
function renderFromState(now = new Date()) {
  updateNextMovieClock(now);

  if (state.visibleSessions.length) {
    renderMovieRows(state.visibleSessions);
  } else {
    createEmptyTable();
  }

  updateStatistics(summarizeSessions(state.sessions, state.visibleSessions));

  if (!state.importedFileName) {
    setTableNotice('尚未匯入 Excel，請選擇場次表檔案。');
  } else if (!state.visibleSessions.length) {
    setTableNotice(getEmptyScheduleMessage());
  } else {
    setTableNotice('');
  }

  updateDebugPanelFromState(now);
  void syncDesktopAlarmSchedule();
}

// 依目前播放狀態篩選建立空結果文案；另有搜尋或其他篩選時統一使用一般提示。
function getEmptyScheduleMessage() {
  const hasOtherConditions = Boolean(state.searchText.trim())
    || state.hallFilter !== 'ALL'
    || state.languageFilter !== 'ALL'
    || state.formatFilter !== 'ALL';
  if (hasOtherConditions) return '沒有符合條件的場次';

  const statusMessages = {
    ACTIVE: '目前沒有等待中或播放中的場次',
    WAITING: '目前沒有等待中的場次',
    PLAYING: '目前沒有播放中的場次',
    FINISHED: '目前沒有已播完的場次',
    ALL: '沒有符合條件的場次'
  };
  return statusMessages[state.statusFilter] || statusMessages.ALL;
}

// 建立匯入成功後共用的檔案狀態文字。
function getImportedStatus(fileName, sheetName, sessionCount, importedTime) {
  return `已讀取 ${fileName}／${sheetName}：${sessionCount} 個場次（${importedTime}）`;
}

// 在新的場次表成功匯入前停止舊警報並清除舊群組觸發紀錄，保留唯一 Audio Channel。
function resetAlarmStateForImport() {
  desktopAlarmScheduleSignature = '';
  if (desktopAlarm) void desktopAlarm.cancel().then(applyDesktopAlarmDebug).catch(() => {});
  stopActiveAlarm();
  state.triggeredAlarmGroups = new Set();
  state.activeAlarmGroup = null;
  state.nextSessionGroup = null;
  state.lastAlarmTriggeredAt = null;
  state.missedAlarmGroup = null;
  syncAlarmRuntimeState();
}

// 只在匯入成功後取代既有資料；失敗時保留上一份成功匯入的 state、警報紀錄與畫面。
async function importSchedule(file) {
  updateFileStatus(`正在讀取：${file.name}`);

  try {
    const { sheetName, movies } = await readExcel(file);
    resetAlarmStateForImport();
    const importedAt = new Date();
    state.sessions = sortSessionsByStart(updateSessionStatuses(movies, importedAt));
    state.importedFileName = file.name;
    state.importedAt = importedAt;
    state.lastTickerUpdatedAt = importedAt;
    Object.assign(state, populateFilterOptions(state.sessions));
    applyFilters(importedAt);

    const importedTime = state.importedAt.toLocaleTimeString('zh-TW', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    updateFileStatus(getImportedStatus(file.name, sheetName, state.sessions.length, importedTime));
  } catch (error) {
    updateFileStatus(`匯入失敗：${error.message}；已保留上一份資料。`);
  }
}

// 在頁面背景期間暫停警報判定，恢復可見時以最後一次可見 ticker 時間保守補檢最近群組。
function bindVisibilityRefresh() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.pageWasHidden = true;
      return;
    }
    handleTimeTick(new Date(), true);
  });
}

// 初始化事件與唯一倒數計時器，重新匯入、搜尋、篩選與警報控制皆不會建立額外 interval。
function init() {
  document.title = `${APP_NAME} V${VERSION}`;
  updateSettings({}, false);
  syncAlarmRuntimeState();
  bindThemeToggle(() => {
    updateSettings({ theme: state.settings.theme === 'light' ? 'dark' : 'light' });
  });
  bindSettingsControls({ onChange: updateSettings });
  bindAlarmControls({
    onToggle: toggleAlarmSound,
    onStop: stopActiveAlarm
  });
  bindDebugPanel(isOpen => updateSettings({ debugPanelOpen: isOpen }));
  bindSearch(searchText => {
    state.searchText = searchText;
    applyFilters();
  });
  bindFilters((filterName, filterValue) => {
    state[filterName] = filterValue;
    applyFilters();
  });
  document.querySelector('#fileInput').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (file) {
      await importSchedule(file);
    }
    event.target.value = '';
  });
  bindVisibilityRefresh();
  unsubscribeDesktopAlarm = desktopAlarm?.onTriggered(handleDesktopAlarmTriggered) || null;
  window.addEventListener('beforeunload', () => unsubscribeDesktopAlarm?.(), { once: true });
  renderFromState();
  startCountdownTicker(handleTimeTick);
}

init();
