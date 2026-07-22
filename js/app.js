import { APP_DISPLAY_NAME, VERSION } from './config.js';
import { hasStoredStartupPreference, loadSettings, normalizeSettings, saveSettings } from './settings.js';
import { readExcel } from './excelReader.js';
import { readPdfSchedule } from './pdfScheduleReader.js';
import { createSessionGroupKey, getLatestUntriggeredSessionGroup, getNextMoviePresentationState, sortSessionsByStart, updateSessionStatuses } from './scheduler.js';
import { formatCountdown, getCountdownSeconds, getCountdownTickerStatus, startCountdownTicker } from './countdown.js';
import { createAlarmChannel } from './alarm.js';
import { getScheduleDebugInfo } from './debug.js';
import { applyTheme, bindAlarmControls, bindCompactWindowControls, bindDailyImportReminder, bindDcpTitleControls, bindDebugPanel, bindSettingsControls, bindThemeToggle, configureCinemaUi, hideAlarmModal, hideDailyImportReminder, showDailyImportReminder, updateAlarmModalNotice, updateAlarmNotice, updateAlarmToggle, updateCompactWindowMode, updateDcpTitleStatus, updateDebugPanel, updateFileStatus, updateHallVoiceTestStatus, updateNextMovieCard, updateSettingsForm, updateSettingsNotice, updateStatistics, setTableNotice, showAlarmModal } from './ui.js';
import { createEmptyTable, renderMovieRows } from './table.js';
import { bindSearch, matchesSearch } from './search.js';
import { bindFilters, matchesFilters, populateDateFilterOptions, populateFilterOptions } from './filter.js';
import { summarizeSessions } from './statistics.js';
import { createDailyReminderTimer, hasTodaySchedule, INITIAL_DAILY_REMINDER_DELAY_MS, SNOOZE_DAILY_REMINDER_DELAY_MS } from './dailyReminder.js';
import { applyDcpTitlesToSessions } from './dcpTitleMap.js';
import { readDcpTitleWorkbook } from './dcpTitleReader.js';
import { clearDcpTitleData, loadDcpTitleData, saveDcpTitleData } from './dcpTitleStorage.js';
import { getOperationalDateKey, getOperationalSessions, getScheduleCoverageState } from './scheduleCoverage.js';
import { loadScheduleSnapshot, saveScheduleSnapshot } from './scheduleStorage.js';

const alarmChannel = createAlarmChannel();
const desktopAlarm = globalThis.desktopAlarm || null;
const desktopStartup = globalThis.desktopStartup || null;
const desktopScheduleReminder = globalThis.desktopScheduleReminder || null;
const desktopWindow = globalThis.desktopWindow || null;
const desktopSystemVolume = globalThis.desktopSystemVolume || null;
const DAILY_REMINDER_STORAGE_KEY = 'movieScheduleAlarm.dailyReminder.v1';
const restoredDcpTitleData = loadDcpTitleData();
let desktopAlarmScheduleSignature = '';
let unsubscribeDesktopAlarm = null;
let unsubscribeDesktopAlarmStopRequest = null;
let unsubscribeDesktopScheduleReminder = null;
let unsubscribeDesktopWindowMode = null;
let desktopMonitoringSignature = '';
let compactWindowResizeObserver = null;
let systemVolumeRequestPending = false;
let systemVolumeWriteCount = 0;

// 單一應用程式狀態，所有清單、警報、搜尋、篩選、Next Movie 與偵錯資訊都由此處驅動。
const state = {
  sessions: [],
  visibleSessions: [],
  searchText: '',
  hallFilter: 'ALL',
  languageFilter: 'ALL',
  formatFilter: 'ALL',
  statusFilter: 'ACTIVE',
  dateFilter: 'AUTO',
  filterOptionsDateKey: '',
  importedFileName: '',
  importedAt: null,
  scheduleSourceType: '',
  operationalDateKey: '',
  coverageReminderKey: '',
  pdfImportDebug: {
    pdfFileName: '',
    pdfPageCount: 0,
    pdfTextItemCount: 0,
    pdfDetectedDateSections: 0,
    pdfRepairedDateSections: 0,
    pdfParsedRowCount: 0,
    pdfSkippedRowCount: 0,
    pdfInvalidRowCount: 0,
    pdfTruncatedTitleCount: 0,
    pdfParseErrors: []
  },
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
  desktopStartupState: {
    isDesktop: Boolean(desktopStartup),
    supported: false,
    enabled: false,
    openAtLogin: false,
    executableWillLaunchAtLogin: false,
    installationType: desktopStartup ? 'development' : 'browser'
  },
  desktopWindowState: {
    isDesktop: Boolean(desktopWindow),
    compactMode: false,
    reportedContentHeight: 0
  },
  dailyReminderDebug: {
    hasTodaySchedule: false,
    reminderTimerScheduled: false,
    lastReminderCheckAt: null,
    notificationShown: false,
    notificationError: ''
  },
  dcpTitleMap: restoredDcpTitleData.titleMap,
  dcpTitleMetadata: restoredDcpTitleData.metadata,
  dcpTitleDebug: {
    matchedSessionCount: 0,
    unmatchedSessionCount: 0,
    unmatchedTitles: []
  },
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
    audioPlayError: '',
    webContentsAudioMuted: null
  }
};

const dailyReminderTimer = createDailyReminderTimer(() => {
  void checkDailyScheduleReminder();
});

// 將 Main Process 回傳的桌面警報狀態合併到集中 state，供既有 Debug Panel 顯示。
function applyDesktopAlarmDebug(debugInfo) {
  if (!debugInfo || typeof debugInfo !== 'object') return;
  state.desktopAlarmDebug = { ...state.desktopAlarmDebug, ...debugInfo };
}

// 將集中 state 的狀態計數同步給 Main Process，僅供關閉保護，不傳送完整場次。
function syncDesktopMonitoringState() {
  if (!desktopWindow) return;
  const waitingCount = state.sessions.filter(session => session.status === 'waiting').length;
  const playingCount = state.sessions.filter(session => session.status === 'playing').length;
  const signature = `${waitingCount}|${playingCount}`;
  if (signature === desktopMonitoringSignature) return;
  desktopMonitoringSignature = signature;
  void desktopWindow.updateMonitoringState({ waitingCount, playingCount }).catch(() => {});
}

// 將 Main Process 回傳的小視窗狀態寫回唯一集中 state，再更新既有 Next Movie 畫面。
function applyDesktopWindowMode(payload = {}) {
  state.desktopWindowState.compactMode = Boolean(payload.enabled);
  updateCompactWindowMode(state.desktopWindowState.compactMode, state.desktopWindowState.isDesktop);
  if (state.desktopWindowState.compactMode) requestAnimationFrame(syncCompactWindowContentHeight);
}

// 量測 Next Movie 實際內容並通知 Main Process 自適應高度；相同高度不重複送出 IPC。
function syncCompactWindowContentHeight() {
  if (!state.desktopWindowState.compactMode || !desktopWindow?.resizeCompact) return;
  const card = document.querySelector('#nextMovieCard');
  if (!card) return;
  const contentHeight = Math.ceil(card.scrollHeight + 16);
  if (contentHeight === state.desktopWindowState.reportedContentHeight) return;
  state.desktopWindowState.reportedContentHeight = contentHeight;
  void desktopWindow.resizeCompact(contentHeight).catch(() => {});
}

// 使用內容變更觀察器回應單場或同時多場卡片高度，不新增 Timer。
function initializeCompactWindowAutoSize() {
  if (!desktopWindow?.resizeCompact || typeof ResizeObserver !== 'function') return;
  compactWindowResizeObserver = new ResizeObserver(() => {
    if (state.desktopWindowState.compactMode) requestAnimationFrame(syncCompactWindowContentHeight);
  });
  compactWindowResizeObserver.observe(document.querySelector('#nextMovieCard'));
}

// 初始化桌面視窗模式並訂閱受限 IPC；瀏覽器模式維持完整頁面。
async function initializeDesktopWindowMode() {
  if (!desktopWindow?.getCompactMode) {
    updateCompactWindowMode(false, false);
    return;
  }
  try {
    applyDesktopWindowMode(await desktopWindow.getCompactMode());
  } catch {
    applyDesktopWindowMode({ enabled: false });
  }
}

// 儲存當日提醒日期與稍後提醒時間，不保存 Excel 或任何場次內容。
function saveDailyReminderState(patch) {
  try {
    const saved = globalThis.localStorage?.getItem(DAILY_REMINDER_STORAGE_KEY);
    const current = saved ? JSON.parse(saved) : {};
    globalThis.localStorage?.setItem(DAILY_REMINDER_STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    state.dailyReminderDebug.notificationError = '今日場次提醒狀態無法儲存';
  }
}

// 產生本機今天的 YYYY-MM-DD 日期鍵，只用於提醒狀態記錄。
function getLocalTodayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 更新唯一提醒 Timer 的 Debug 狀態。
function syncDailyReminderTimerDebug() {
  state.dailyReminderDebug.reminderTimerScheduled = dailyReminderTimer.isScheduled();
}

// 取消今日提醒 Timer 並關閉 Modal，供成功匯入今日場次時共用。
function completeDailyScheduleReminder() {
  dailyReminderTimer.cancel();
  syncDailyReminderTimerDebug();
  hideDailyImportReminder();
}

// 檢查集中 sessions 是否包含今日場次；缺少時顯示 Modal 並請 Main Process 顯示原生通知。
async function checkDailyScheduleReminder() {
  syncDailyReminderTimerDebug();
  if (!desktopScheduleReminder || !state.settings.dailyImportReminderEnabled) return;

  const now = new Date();
  const hasToday = hasTodaySchedule(state.sessions, now);
  Object.assign(state.dailyReminderDebug, {
    hasTodaySchedule: hasToday,
    lastReminderCheckAt: now,
    notificationShown: false,
    notificationError: ''
  });
  if (hasToday) {
    completeDailyScheduleReminder();
    updateDebugPanelFromState(now);
    return;
  }

  showDailyImportReminder();
  saveDailyReminderState({ lastScheduleReminderDate: getLocalTodayKey(now) });
  try {
    const result = await desktopScheduleReminder.notify();
    state.dailyReminderDebug.notificationShown = Boolean(result?.notificationShown);
    state.dailyReminderDebug.notificationError = result?.notificationError || '';
  } catch (error) {
    state.dailyReminderDebug.notificationError = error instanceof Error ? error.message : 'Windows 原生通知顯示失敗';
  }
  updateDebugPanelFromState(new Date());
}

// 安排唯一的今日場次提醒 Timer，停用設定或已有今日場次時不建立 Timer。
function scheduleDailyReminder(delayMs) {
  if (!desktopScheduleReminder || !state.settings.dailyImportReminderEnabled || hasTodaySchedule(state.sessions)) {
    completeDailyScheduleReminder();
    return;
  }
  dailyReminderTimer.schedule(delayMs);
  syncDailyReminderTimerDebug();
  updateDebugPanelFromState(new Date());
}

// 讀取 Setup 的實際 Windows 啟動狀態；首次遷移才套用預設開啟，避免覆蓋系統停用。
async function initializeDesktopStartup() {
  if (!desktopStartup) return;
  try {
    let startupState = await desktopStartup.getState();
    if (startupState.supported && state.settings.startupEnabled && !hasStoredStartupPreference()) {
      startupState = await desktopStartup.setEnabled(true);
      saveSettings(state.settings);
    }
    state.desktopStartupState = { ...state.desktopStartupState, ...startupState };
  } catch (error) {
    updateSettingsNotice(error instanceof Error ? error.message : '無法讀取 Windows 開機啟動狀態');
  }
  updateSettingsForm(state.settings, state.desktopStartupState);
  updateDebugPanelFromState(new Date());
}

// 由設定中心切換 Setup 登入啟動，並以 Main Process 回傳的實際 Windows 狀態更新畫面。
async function updateDesktopStartup(enabled) {
  if (!desktopStartup || typeof enabled !== 'boolean') return;
  try {
    const startupState = await desktopStartup.setEnabled(enabled);
    state.desktopStartupState = { ...state.desktopStartupState, ...startupState };
    state.settings = normalizeSettings({ ...state.settings, startupEnabled: startupState.supported ? enabled : state.settings.startupEnabled });
    const saved = saveSettings(state.settings);
    updateSettingsNotice(saved.success ? '' : saved.message);
  } catch (error) {
    updateSettingsNotice(error instanceof Error ? error.message : '無法更新 Windows 開機啟動設定');
  }
  updateSettingsForm(state.settings, state.desktopStartupState);
  updateDebugPanelFromState(new Date());
}

// 由目前 sessions 更新 DCP matched／unmatched Debug 統計，不建立第二份場次資料。
function updateDcpSessionDebug() {
  const matchedSessions = state.sessions.filter(session => session.titleMatchStatus?.startsWith('matched'));
  const unmatchedTitles = [...new Set(state.sessions
    .filter(session => !session.titleMatchStatus?.startsWith('matched'))
    .map(session => session.originalTitle)
    .filter(Boolean))];
  state.dcpTitleDebug = {
    matchedSessionCount: matchedSessions.length,
    unmatchedSessionCount: state.sessions.length - matchedSessions.length,
    unmatchedTitles: unmatchedTitles.slice(0, 10)
  };
}

// 以目前 Map、metadata 與場次匹配統計更新設定中心的單一 DCP 摘要。
function refreshDcpTitleStatus() {
  updateDcpTitleStatus({
    uniqueTitles: state.dcpTitleMap.size,
    sourceFileName: state.dcpTitleMetadata.sourceFileName,
    sourceSheetName: state.dcpTitleMetadata.sourceSheetName,
    importedAt: state.dcpTitleMetadata.importedAt,
    conflicts: state.dcpTitleMetadata.conflicts,
    unmatchedSessions: state.dcpTitleDebug.unmatchedSessionCount
  });
}

// 重新套用目前 DCP Map 的片名衍生欄位，保留場次 id、時間、狀態與警報群組鍵值。
function applyCurrentDcpTitles(now = new Date()) {
  state.sessions = applyDcpTitlesToSessions(state.sessions, state.dcpTitleMap);
  updateDcpSessionDebug();
  applyFilters(now);
  if (state.activeAlarmGroup) {
    const updatedGroup = findSessionGroupByKey(state.activeAlarmGroup.groupKey);
    if (updatedGroup) {
      state.activeAlarmGroup = updatedGroup;
      showAlarmModal(updatedGroup, getAlarmAudioNotice(), state.settings.alarmLeadMinutes);
    }
  }
}

// 匯入現有 DCP 工作表並以新 Map 完整取代舊資料；失敗時保留上一份可用對照。
async function importDcpTitles(file) {
  updateDcpTitleStatus({
    loading: `正在讀取：${file.name}`
  });
  try {
    const result = await readDcpTitleWorkbook(file);
    const metadata = {
      importedAt: new Date().toISOString(),
      sourceFileName: file.name,
      sourceSheetName: result.sheetName,
      ...result.stats,
      conflictTitles: result.conflictTitles
    };
    const saved = saveDcpTitleData(result.titleMap, metadata);
    state.dcpTitleMap = result.titleMap;
    state.dcpTitleMetadata = metadata;
    applyCurrentDcpTitles(new Date());
    refreshDcpTitleStatus();
    if (!saved.success) updateSettingsNotice(saved.message);
  } catch (error) {
    updateDcpTitleStatus({ error: `${error.message}；已保留上一份 DCP 對照資料。` });
  }
  updateDebugPanelFromState(new Date());
}

// 清除本機 DCP Map 並只將目前場次恢復英文顯示，不影響排程、倒數或警報開關。
function clearDcpTitles() {
  const result = clearDcpTitleData();
  if (!result.success) {
    updateDcpTitleStatus({ error: result.message });
    return;
  }
  state.dcpTitleMap = new Map();
  state.dcpTitleMetadata = {};
  applyCurrentDcpTitles(new Date());
  updateDcpTitleStatus();
  updateSettingsNotice('');
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
      title: session.displayTitle || session.title || '',
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
  updateSettingsForm(state.settings, state.desktopStartupState);

  const result = shouldPersist ? saveSettings(state.settings) : { success: true, message: '' };
  updateSettingsNotice(result.success ? '' : result.message);
  if (Object.prototype.hasOwnProperty.call(patch, 'dailyImportReminderEnabled')) {
    if (state.settings.dailyImportReminderEnabled) {
      scheduleDailyReminder(INITIAL_DAILY_REMINDER_DELAY_MS);
    } else {
      completeDailyScheduleReminder();
    }
  }
  void syncDesktopAlarmSchedule();
  if (Object.prototype.hasOwnProperty.call(patch, 'theme')) updateNextMovieClock(new Date());
  updateDebugPanelFromState(new Date());
}

// 將設定中心的音量變更同步至 Windows 主音量；其他設定仍沿用既有集中更新流程。
function updateSettingsFromControls(patch) {
  updateSettings(patch);
  if (!desktopSystemVolume || !Object.prototype.hasOwnProperty.call(patch, 'alarmVolume')) return;
  const volume = Math.round(state.settings.alarmVolume * 100);
  systemVolumeWriteCount += 1;
  void desktopSystemVolume.setVolume(volume).catch(error => {
    updateSettingsNotice(error instanceof Error ? error.message : '無法更新 Windows 系統音量');
  }).finally(() => {
    systemVolumeWriteCount -= 1;
    if (systemVolumeWriteCount === 0) void syncSystemVolumeFromWindows();
  });
}

// 將 Windows 回傳的主音量合併到唯一 settings state，避免系統與軟體各持有不同音量值。
function applySystemVolumeState(volumeState, shouldPersist = true) {
  if (!volumeState?.supported || !Number.isFinite(volumeState.volume)) return;
  const alarmVolume = Math.min(100, Math.max(0, Math.round(volumeState.volume))) / 100;
  if (Math.abs(state.settings.alarmVolume - alarmVolume) < 0.001) return;
  updateSettings({ alarmVolume }, shouldPersist);
}

// 共用既有每秒 Ticker 讀取 Windows 主音量，請求尚未完成時不重複送出。
async function syncSystemVolumeFromWindows(shouldPersist = true) {
  if (!desktopSystemVolume || systemVolumeRequestPending || systemVolumeWriteCount > 0) return;
  systemVolumeRequestPending = true;
  try {
    applySystemVolumeState(await desktopSystemVolume.getState(), shouldPersist);
  } catch (error) {
    updateSettingsNotice(error instanceof Error ? error.message : '無法讀取 Windows 系統音量');
  } finally {
    systemVolumeRequestPending = false;
  }
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
  const operationalSessions = getOperationalSessions(state.sessions, now);
  const operationalDateKey = getOperationalDateKey(state.sessions, now);
  const selectedSessions = state.dateFilter === 'AUTO'
    ? operationalSessions
    : state.sessions.filter(session => (session.operationalDate || session.date) === state.dateFilter);
  const filterOptionsDateKey = state.dateFilter === 'AUTO' ? operationalDateKey : state.dateFilter;
  if (state.importedFileName && state.filterOptionsDateKey !== filterOptionsDateKey) {
    Object.assign(state, populateFilterOptions(selectedSessions));
    state.filterOptionsDateKey = filterOptionsDateKey;
  }
  state.operationalDateKey = operationalDateKey;
  state.visibleSessions = selectedSessions.filter(session => (
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
  const group = presentation.group;
  const compactPresentation = {
    type: presentation.type,
    theme: state.settings.theme,
    status: presentation.type === 'upcoming' ? '等待中' : '',
    date: group?.sessions?.[0]?.date || '--',
    weekday: group?.sessions?.[0]?.weekday || '',
    time: group?.sessions?.[0]?.start || '--:--',
    countdown,
    sessions: (group?.sessions || []).map(session => ({
      hall: session.hall || '',
      title: session.displayTitle || session.title || '',
      language: session.language || '',
      formats: session.formats?.length ? session.formats : [session.formatDisplay || session.format].filter(Boolean)
    }))
  };
  void desktopWindow?.updateCompactPresentation?.(compactPresentation).catch(() => {});
}

// 使用唯一 Alarm Channel 播放一次所選警報語音，正式警報進行中則安全拒絕試聽。
async function testHallVoice(hall) {
  updateHallVoiceTestStatus('正在播放警報語音…');
  const result = await alarmChannel.previewHallAnnouncement(hall, state.settings);
  updateHallVoiceTestStatus(result.success ? `已播放：${result.message}` : result.message);
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
  const result = await alarmChannel.startAlarm(state.settings, group);
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
  syncDesktopMonitoringState();
  applyFilters(now);
  updateActiveAlarmNotice();
  void checkScheduleCoverageReminder(now);
  void syncSystemVolumeFromWindows();
}

// 集中處理 Next Movie、表格、統計與空狀態，避免各模組各自持有場次資料。
function renderFromState(now = new Date()) {
  updateNextMovieClock(now);

  if (state.visibleSessions.length) {
    renderMovieRows(state.visibleSessions);
  } else {
    createEmptyTable();
  }

  const selectedSessions = state.dateFilter === 'AUTO'
    ? getOperationalSessions(state.sessions, now)
    : state.sessions.filter(session => (session.operationalDate || session.date) === state.dateFilter);
  updateStatistics(summarizeSessions(selectedSessions, state.visibleSessions));

  if (!state.importedFileName) {
    setTableNotice('尚未匯入場次表，請選擇 Excel 或 PDF 檔案。');
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
function getImportedStatus(fileName, sourceLabel, sessionCount, importedTime) {
  return `已讀取 ${fileName}／${sourceLabel}：${sessionCount} 個場次（${importedTime}）`;
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
  state.coverageReminderKey = '';
  state.filterOptionsDateKey = '';
  syncAlarmRuntimeState();
}

// 將 Excel 與 PDF Reader 的成功結果交給唯一資料流程，取代舊 sessions 並更新所有衍生畫面與排程。
function applyImportedSessions({ sessions, sourceType, sourceFileName, sourceLabel, metadata = {} }) {
  resetAlarmStateForImport();
  const importedAt = new Date();
  state.sessions = sortSessionsByStart(updateSessionStatuses(
    applyDcpTitlesToSessions(sessions, state.dcpTitleMap),
    importedAt
  ));
  state.importedFileName = sourceFileName;
  state.importedAt = importedAt;
  state.scheduleSourceType = sourceType;
  saveScheduleSnapshot({
    sessions: state.sessions,
    importedFileName: state.importedFileName,
    importedAt: state.importedAt,
    scheduleSourceType: state.scheduleSourceType
  });
  state.lastTickerUpdatedAt = importedAt;
  state.pdfImportDebug = sourceType === 'pdf' ? {
    pdfFileName: sourceFileName,
    pdfPageCount: metadata.pageCount || 0,
    pdfTextItemCount: metadata.textItemCount || 0,
    pdfDetectedDateSections: metadata.detectedDateSections || 0,
    pdfRepairedDateSections: metadata.repairedDateSectionCount || 0,
    pdfParsedRowCount: metadata.parsedRowCount || 0,
    pdfSkippedRowCount: metadata.skippedRowCount || 0,
    pdfInvalidRowCount: metadata.invalidRowCount || 0,
    pdfTruncatedTitleCount: metadata.truncatedTitleCount || 0,
    pdfParseErrors: metadata.parseErrors || []
  } : state.pdfImportDebug;
  state.dateFilter = populateDateFilterOptions(state.sessions, state.dateFilter);
  state.filterOptionsDateKey = '';
  updateDcpSessionDebug();
  refreshDcpTitleStatus();
  applyFilters(importedAt);

  const importedTime = importedAt.toLocaleTimeString('zh-TW', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const successMessage = sourceType === 'pdf'
    ? `PDF 場次表匯入成功，共載入 ${state.sessions.length} 個場次`
    : getImportedStatus(sourceFileName, sourceLabel, state.sessions.length, importedTime);
  updateFileStatus(successMessage);
  if (hasTodaySchedule(state.sessions, importedAt)) {
    state.dailyReminderDebug.hasTodaySchedule = true;
    completeDailyScheduleReminder();
  } else if (desktopScheduleReminder && state.settings.dailyImportReminderEnabled) {
    state.dailyReminderDebug.hasTodaySchedule = false;
    updateFileStatus(`${successMessage}；此場次表不是今天的日期，請確認檔案是否正確。`);
    scheduleDailyReminder(SNOOZE_DAILY_REMINDER_DELAY_MS);
  }
  updateDebugPanelFromState(new Date());
  syncDesktopMonitoringState();
}

// 啟動時將上次成功匯入的標準化場次恢復到唯一 state.sessions，並立即重建畫面與排程。
function restoreStoredSchedule(now = new Date()) {
  const restored = loadScheduleSnapshot();
  if (!restored) return;
  state.sessions = sortSessionsByStart(updateSessionStatuses(
    applyDcpTitlesToSessions(restored.sessions, state.dcpTitleMap),
    now
  ));
  state.importedFileName = restored.importedFileName;
  state.importedAt = restored.importedAt;
  state.scheduleSourceType = restored.scheduleSourceType;
  state.lastTickerUpdatedAt = now;
  state.dateFilter = populateDateFilterOptions(state.sessions, 'AUTO');
  updateDcpSessionDebug();
  updateFileStatus(`已恢復上次場次表：${state.importedFileName || '本機場次資料'}`);
  syncDesktopMonitoringState();
}

// 在整份週場次最後一場散場後只提醒一次；沿用既有 Modal 與原生通知，不建立第二個 interval。
async function checkScheduleCoverageReminder(now = new Date()) {
  if (!state.importedFileName || !state.settings.dailyImportReminderEnabled) return;
  const coverage = getScheduleCoverageState(state.sessions, now);
  if (!coverage.exhausted || !coverage.coverageKey || state.coverageReminderKey === coverage.coverageKey) return;

  state.coverageReminderKey = coverage.coverageKey;
  const endDateKey = getLocalTodayKey(coverage.latestFinishDate);
  const displayDate = endDateKey.replaceAll('-', '/');
  showDailyImportReminder({
    title: '目前場次資料已全部結束',
    message: `已匯入的場次涵蓋至 ${displayDate}，請匯入 ${displayDate} 之後的 Excel 或 PDF 場次表。`
  });
  saveDailyReminderState({ lastCoverageReminderKey: coverage.coverageKey });

  if (!desktopScheduleReminder) return;
  try {
    const result = await desktopScheduleReminder.notify({
      kind: 'coverage-exhausted',
      body: `目前場次資料已全部結束，請匯入 ${displayDate} 之後的場次表。`
    });
    state.dailyReminderDebug.notificationShown = Boolean(result?.notificationShown);
    state.dailyReminderDebug.notificationError = result?.notificationError || '';
  } catch (error) {
    state.dailyReminderDebug.notificationError = error instanceof Error ? error.message : 'Windows 原生通知顯示失敗';
  }
}

// 讀取 Excel 後交給共用匯入流程；解析失敗時不清除既有 sessions 或警報排程。
async function importExcelSchedule(file) {
  updateFileStatus(`正在讀取 Excel：${file.name}`);
  try {
    const { sheetName, movies } = await readExcel(file);
    applyImportedSessions({ sessions: movies, sourceType: 'excel', sourceFileName: file.name, sourceLabel: sheetName });
  } catch (error) {
    updateFileStatus(`Excel 匯入失敗：${error.message}；已保留上一份資料。`);
  }
}

// 讀取 PDF 文字層後交給共用匯入流程；任何錯誤都保留上一份成功資料與排程。
async function importPdfSchedule(file) {
  updateFileStatus(`正在讀取 PDF：${file.name}`);
  try {
    const { movies, metadata } = await readPdfSchedule(file);
    applyImportedSessions({ sessions: movies, sourceType: 'pdf', sourceFileName: file.name, sourceLabel: 'PDF', metadata });
  } catch (error) {
    updateFileStatus(`PDF 匯入失敗：${error.message}；已保留上一份資料。`);
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
  document.title = `${APP_DISPLAY_NAME} V${VERSION}`;
  configureCinemaUi();
  updateSettings({}, false);
  restoreStoredSchedule();
  if (desktopAlarm) alarmChannel.enableAlarm(state.settings);
  syncAlarmRuntimeState();
  bindThemeToggle(() => {
    updateSettings({ theme: state.settings.theme === 'light' ? 'dark' : 'light' });
  });
  bindSettingsControls({ onChange: updateSettingsFromControls, onStartupChange: updateDesktopStartup, onHallVoiceTest: testHallVoice });
  bindCompactWindowControls(() => {
    void desktopWindow?.setCompactMode(false).then(applyDesktopWindowMode).catch(() => {});
  });
  bindDcpTitleControls({ onImport: importDcpTitles, onClear: clearDcpTitles });
  refreshDcpTitleStatus();
  bindDailyImportReminder({
    onUploadExcel: () => {
      hideDailyImportReminder();
      document.querySelector('#fileInput').click();
    },
    onUploadPdf: () => {
      hideDailyImportReminder();
      document.querySelector('#pdfFileInput').click();
    },
    onSnooze: () => {
      hideDailyImportReminder();
      saveDailyReminderState({ lastReminderDismissedAt: new Date().toISOString() });
      scheduleDailyReminder(SNOOZE_DAILY_REMINDER_DELAY_MS);
    }
  });
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
      await importExcelSchedule(file);
    }
    event.target.value = '';
  });
  document.querySelector('#pdfFileInput').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (file) {
      await importPdfSchedule(file);
    }
    event.target.value = '';
  });
  bindVisibilityRefresh();
  initializeCompactWindowAutoSize();
  unsubscribeDesktopAlarm = desktopAlarm?.onTriggered(handleDesktopAlarmTriggered) || null;
  unsubscribeDesktopAlarmStopRequest = desktopAlarm?.onStopRequested(stopActiveAlarm) || null;
  unsubscribeDesktopScheduleReminder = desktopScheduleReminder?.onShowRequested(payload => {
    if (payload?.kind === 'coverage-exhausted') {
      const coverage = getScheduleCoverageState(state.sessions, new Date());
      const displayDate = coverage.latestFinishDate ? getLocalTodayKey(coverage.latestFinishDate).replaceAll('-', '/') : '目前日期';
      showDailyImportReminder({
        title: '目前場次資料已全部結束',
        message: `已匯入的場次涵蓋至 ${displayDate}，請匯入 ${displayDate} 之後的 Excel 或 PDF 場次表。`
      });
      return;
    }
    showDailyImportReminder();
  }) || null;
  unsubscribeDesktopWindowMode = desktopWindow?.onCompactModeChanged(applyDesktopWindowMode) || null;
  window.addEventListener('beforeunload', () => {
    dailyReminderTimer.cancel();
    unsubscribeDesktopAlarm?.();
    unsubscribeDesktopAlarmStopRequest?.();
    unsubscribeDesktopScheduleReminder?.();
    unsubscribeDesktopWindowMode?.();
    compactWindowResizeObserver?.disconnect();
  }, { once: true });
  renderFromState();
  void initializeDesktopStartup();
  void initializeDesktopWindowMode();
  void syncSystemVolumeFromWindows(false);
  scheduleDailyReminder(INITIAL_DAILY_REMINDER_DELAY_MS);
  startCountdownTicker(handleTimeTick);
}

init();
