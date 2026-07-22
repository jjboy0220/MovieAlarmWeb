import { renderFormatBadges, renderHallBadge, renderLanguageBadge } from './badgeRenderer.js';
import { CINEMA_CODE, FORMATS, HALLS, MONITOR_TITLE, VERSION } from './config.js';
import { escapeHtml, formatCompactChineseDate } from './utils.js';

let renderedGroupKey = '';

// 統一查詢單一 DOM 節點，避免各 UI 函式重複撰寫選擇器。
const $ = selector => document.querySelector(selector);

// 以群組開播時間與場次識別碼建立穩定鍵值，避免每秒重建相同的場次清單。
function getSessionGroupKey(group) {
  return `${group.startDateTime}|${group.sessions.map(session => `${session.id || session.hall}-${session.displayTitle || session.title}`).join('|')}`;
}

// 將完整下一場卡片清單固定移到共用開演時間上方，且只沿用既有 DOM 節點。
function ensureNextSessionListPlacement() {
  const sessionList = $('#nextSessionList');
  const nextTime = $('.next-time');
  if (sessionList.nextElementSibling !== nextTime) {
    $('.next-hero').insertBefore(sessionList, nextTime);
  }
  return sessionList;
}

// 將單一同時開播場次渲染為 Next Movie 資訊卡，保留影廳、純片名、語言與格式 Badge。
function renderNextSession(session) {
  const languageBadge = renderLanguageBadge(session.language);
  const formatBadges = renderFormatBadges(session);
  const metadataBadges = [languageBadge, formatBadges].filter(Boolean).join('');

  return `<article class="next-session-item"><div class="next-session-hall">${renderHallBadge(session.hall) || '—'}</div><strong class="next-session-title" title="${escapeHtml(session.originalTitle || session.title)}">${escapeHtml(session.displayTitle || session.title)}</strong><div class="next-session-badges">${metadataBadges || '<span class="next-session-unlabeled">未標示語言或格式</span>'}</div></article>`;
}

// 將單一警報場次渲染為 Modal 內的資訊卡，電影名稱只顯示純 title。
function renderAlarmSession(session) {
  const languageBadge = renderLanguageBadge(session.language);
  const formatBadges = renderFormatBadges(session);
  const metadataBadges = [languageBadge, formatBadges].filter(Boolean).join('');

  return `<article class="alarm-session-item"><div class="alarm-session-hall">${renderHallBadge(session.hall) || '—'}</div><strong class="alarm-session-title" title="${escapeHtml(session.originalTitle || session.title)}">${escapeHtml(session.displayTitle || session.title)}</strong><div class="alarm-session-badges">${metadataBadges || '<span class="alarm-session-unlabeled">未標示語言或格式</span>'}</div></article>`;
}

// 渲染同一開播時間的所有場次；日期、時間與倒數由卡片上方共用區塊顯示一次。
function renderNextSessionList(group) {
  ensureNextSessionListPlacement().innerHTML = group.sessions.map(renderNextSession).join('');
}

// 呈現 Next Movie 的非 upcoming 安全訊息，避免卡片出現空白、undefined 或混合狀態。
function renderNextSessionPlaceholder(message) {
  ensureNextSessionListPlacement().innerHTML = `<p class="next-session-empty">${escapeHtml(message)}</p>`;
}

// 將五種 Next Movie 呈現狀態轉為互斥的徽章文字與說明訊息。
function getNextMovieMessage(type) {
  const messages = {
    notImported: { status: '等待中', message: '請先匯入場次表' },
    invalidTime: { status: '資料異常', message: '找不到有效的場次時間' },
    playing: { status: '播放中', message: '所有場次皆已開播，播放尚未結束' },
    completed: { status: '已播完', message: '今日場次已全部播完' }
  };
  return messages[type] || messages.invalidTime;
}

// 更新 Next Movie 的下一個時間群組或其五種安全狀態；每秒只更新倒數文字，群組改變時才重建場次卡。
export function updateNextMovieCard(presentation, countdownText) {
  const status = $('#nextStatus');
  const type = presentation?.type || 'invalidTime';
  const group = presentation?.group;
  const hasUpcomingGroup = type === 'upcoming' && group?.sessions?.length;

  status.className = 'status-badge waiting';
  $('.next-countdown').hidden = !hasUpcomingGroup;
  $('#nextCountdown').textContent = hasUpcomingGroup ? (countdownText || '00:00:00') : '00:00:00';

  if (!hasUpcomingGroup) {
    const message = getNextMovieMessage(type);
    status.textContent = message.status;
    $('#nextDate').textContent = '--';
    $('#nextTime').textContent = '--:--';
    const placeholderKey = `message-${type}`;
    if (renderedGroupKey !== placeholderKey) {
      renderedGroupKey = placeholderKey;
      renderNextSessionPlaceholder(message.message);
    }
    return;
  }

  const groupKey = getSessionGroupKey(group);
  const firstSession = group.sessions[0];
  status.textContent = '等待中';
  $('#nextDate').textContent = formatCompactChineseDate(firstSession.date, firstSession.weekday);
  $('#nextTime').textContent = firstSession.start;
  if (renderedGroupKey !== groupKey) {
    renderedGroupKey = groupKey;
    renderNextSessionList(group);
  }
}

// 顯示大型場次開始 Modal，並只使用已固定的 activeAlarmGroup 資料避免被下一場覆蓋。
export function showAlarmModal(group, audioNotice = '', leadMinutes = 0) {
  const modal = $('#alarmModal');
  const firstSession = group?.sessions?.[0];
  if (!firstSession) return;

  $('#alarmModalTitle').textContent = leadMinutes > 0 ? '即將開播' : '場次開始';
  $('#alarmModalDate').textContent = formatCompactChineseDate(firstSession.date, firstSession.weekday);
  $('#alarmModalTime').textContent = firstSession.start;
  $('#alarmSessionList').innerHTML = group.sessions.map(renderAlarmSession).join('');
  modal.hidden = false;
  document.body.classList.add('alarm-active');
  $('#nextMovieCard').classList.add('alarm-active');
  updateAlarmModalNotice(audioNotice);
}

// 關閉場次開始 Modal 與警報視覺狀態；停止音效的實際行為由 app.js 集中處理。
export function hideAlarmModal() {
  $('#alarmModal').hidden = true;
  document.body.classList.remove('alarm-active');
  $('#nextMovieCard').classList.remove('alarm-active');
}

// 更新 Modal 內非阻塞音效提示；空字串時隱藏提示避免佔用版面。
export function updateAlarmModalNotice(message) {
  const notice = $('#alarmAudioNotice');
  notice.textContent = message || '';
  notice.hidden = !message;
}

// 更新頁首的非阻塞警報音效提示，供啟用與瀏覽器拒絕播放時使用。
export function updateAlarmNotice(message) {
  const notice = $('#alarmNotice');
  notice.textContent = message || '';
  notice.hidden = !message;
}

// 依唯一的 alarmEnabled 狀態更新整合後的單一鬧鐘切換按鈕。
export function updateAlarmToggle(isEnabled) {
  const button = $('#alarmToggleButton');
  const icon = $('#alarmToggleIcon');
  const text = $('#alarmToggleText');
  const label = isEnabled ? '鬧鐘已開啟' : '鬧鐘已關閉';

  button.classList.toggle('alarm-toggle--enabled', isEnabled);
  button.classList.toggle('alarm-toggle--disabled', !isEnabled);
  button.setAttribute('aria-pressed', String(isEnabled));
  button.setAttribute('aria-label', label);
  icon.textContent = isEnabled ? '🔔' : '🔕';
  text.textContent = label;
}

// 綁定單一警報切換、正式停止與 Esc 控制；Esc 僅停止目前正式警報。
export function bindAlarmControls({ onToggle, onStop }) {
  $('#alarmToggleButton').addEventListener('click', () => {
    onToggle();
  });
  $('#stopAlarmButton').addEventListener('click', () => {
    onStop();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || $('#alarmModal').hidden) return;
    event.preventDefault();
    onStop();
  });
}

// 將偵錯欄位值轉為可安全呈現的繁體中文文字。
function formatDebugValue(value) {
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

// 產生單一偵錯欄位的 HTML，所有動態值都先轉義後再寫入畫面。
function renderDebugItem(label, value) {
  return `<article class="debug-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatDebugValue(value))}</strong></article>`;
}

// 依固定欄位順序整理偵錯資料，讓面板僅負責顯示而不自行推導場次資訊。
function getDebugEntries(debugInfo) {
  return [
    ['目前系統日期時間', debugInfo.currentDateTime],
    ['目前系統時區', debugInfo.timezone],
    ['匯入檔案名稱', debugInfo.importedFileName],
    ['匯入時間', debugInfo.importedAt],
    ['場次來源類型', debugInfo.scheduleSourceType],
    ['PDF 檔案名稱', debugInfo.pdfFileName],
    ['PDF 頁數', debugInfo.pdfPageCount],
    ['PDF 文字項目數', debugInfo.pdfTextItemCount],
    ['PDF 日期區段數', debugInfo.pdfDetectedDateSections],
    ['PDF 檔名週期修復日期數', debugInfo.pdfRepairedDateSections],
    ['PDF 解析成功列數', debugInfo.pdfParsedRowCount],
    ['PDF 略過列數', debugInfo.pdfSkippedRowCount],
    ['PDF 無效列數', debugInfo.pdfInvalidRowCount],
    ['PDF 疑似截斷片名數', debugInfo.pdfTruncatedTitleCount],
    ['PDF 解析錯誤', debugInfo.pdfParseErrors],
    ['解析成功場次', debugInfo.totalSessions],
    ['目前營運日', debugInfo.operationalDateKey],
    ['場次列表日期選擇', debugInfo.selectedOperationalDate],
    ['目前營運日顯示場次數', debugInfo.operationalSessionCount],
    ['場次涵蓋到期提醒鍵值', debugInfo.coverageReminderKey],
    ['有效 startDateTime 場次', debugInfo.validDateTimeSessions],
    ['無效 startDateTime 場次', debugInfo.invalidDateTimeSessions],
    ['無效 finishDateTime 場次', debugInfo.invalidFinishDateTimeSessions],
    ['最早場次時間', debugInfo.earliestSession],
    ['最晚場次開始時間', debugInfo.latestStartSession],
    ['最晚場次結束時間', debugInfo.latestFinishSession],
    ['下一個場次群組時間', debugInfo.nextGroupDateTime],
    ['下一個場次群組數量', debugInfo.nextGroupCount],
    ['未來待開播場次', debugInfo.waitingCount],
    ['播放中場次', debugInfo.playingCount],
    ['已播完場次', debugInfo.finishedCount],
    ['Ticker 執行中', debugInfo.tickerRunning],
    ['Ticker ID 已建立', debugInfo.tickerIdExists],
    ['最後一次 ticker 更新', debugInfo.lastTickAt],
    ['頁面可見', debugInfo.pageVisible],
    ['Windows 開機啟動支援', debugInfo.startupSupported],
    ['Windows 開機啟動已啟用', debugInfo.startupEnabled],
    ['登入時實際會啟動', debugInfo.startupExecutableWillLaunch],
    ['Desktop 執行型態', debugInfo.desktopInstallationType],
    ['已匯入今日場次', debugInfo.hasTodaySchedule],
    ['今日提醒 Timer 已建立', debugInfo.dailyReminderTimerScheduled],
    ['最後今日提醒檢查時間', debugInfo.lastDailyReminderCheckAt],
    ['今日原生通知已顯示', debugInfo.dailyNotificationShown],
    ['今日原生通知錯誤', debugInfo.dailyNotificationError],
    ['DCP 片名對照已載入', debugInfo.dcpTitleMapLoaded],
    ['DCP 來源檔案', debugInfo.dcpTitleSourceFile],
    ['DCP 來源工作表', debugInfo.dcpTitleSourceSheet],
    ['DCP 匯入時間', debugInfo.dcpTitleImportedAt],
    ['DCP 來源資料列', debugInfo.dcpTitleSourceRows],
    ['DCP 有效資料列', debugInfo.dcpTitleValidRows],
    ['DCP 唯一片名數', debugInfo.dcpTitleUniqueCount],
    ['DCP 重複資料列', debugInfo.dcpTitleDuplicateCount],
    ['DCP 衝突片名數', debugInfo.dcpTitleConflictCount],
    ['中文片名匹配場次', debugInfo.matchedSessionCount],
    ['中文片名未匹配場次', debugInfo.unmatchedSessionCount],
    ['前 10 個未匹配英文片名', debugInfo.unmatchedSessionTitles],
    ['警報音效已啟用', debugInfo.alarmEnabled],
    ['警報切換按鈕文字', debugInfo.alarmToggleLabel],
    ['警報狀態文字', debugInfo.alarmStatusText],
    ['警報音效已解鎖', debugInfo.alarmUnlocked],
    ['警報進行中', debugInfo.alarmActive],
    ['目前警報群組鍵值', debugInfo.activeAlarmGroupKey],
    ['已觸發警報群組數', debugInfo.triggeredAlarmGroupCount],
    ['最後警報觸發時間', debugInfo.lastAlarmTriggeredAt],
    ['音效載入狀態', debugInfo.audioLoadStatus],
    ['音效播放錯誤', debugInfo.audioPlayError],
    ['背景補償群組', debugInfo.missedAlarmGroup],
    ['Desktop Alarm 已排程', debugInfo.desktopAlarmScheduled],
    ['Main 收到排程時間', debugInfo.scheduleReceivedAt],
    ['Desktop 排程群組鍵值', debugInfo.scheduledGroupKey],
    ['Desktop 排程開始時間戳', debugInfo.scheduledStartTimestamp],
    ['排程計算延遲毫秒', debugInfo.calculatedDelayMs],
    ['排程時警報已啟用', debugInfo.desktopScheduledAlarmEnabled],
    ['Main 單次 Timer 已建立', debugInfo.desktopTimerCreated],
    ['Renderer WebContents ID', debugInfo.rendererWebContentsId],
    ['Main Process 警報觸發時間戳', debugInfo.mainProcessAlarmTriggeredAt],
    ['Main Timer 實際觸發時間', debugInfo.mainTimerFiredAt],
    ['Main Timer 誤差毫秒', debugInfo.mainTimerDelayMs],
    ['觸發時主視窗存在', debugInfo.windowExists],
    ['觸發時視窗已最小化', debugInfo.windowWasMinimized],
    ['觸發時視窗可見', debugInfo.windowWasVisible],
    ['觸發時視窗有焦點', debugInfo.windowWasFocused],
    ['觸發時 Renderer 已銷毀', debugInfo.rendererDestroyed],
    ['觸發時已還原視窗', debugInfo.windowRestored],
    ['IPC Trigger 送出時間', debugInfo.ipcTriggerSentAt],
    ['IPC Trigger 送出成功', debugInfo.ipcTriggerSendSucceeded],
    ['視窗喚醒流程完成', debugInfo.wakeSequenceCompleted],
    ['最上層模式啟用', debugInfo.alwaysOnTopActive],
    ['工作列閃爍啟用', debugInfo.flashFrameActive],
    ['最近睡眠恢復檢查時間戳', debugInfo.lastResumeCheckAt],
    ['偵測到錯過警報', debugInfo.missedAlarmDetected],
    ['Desktop IPC 排程錯誤', debugInfo.ipcScheduleError],
    ['Renderer 收到 Trigger 時間', debugInfo.rendererTriggerReceivedAt],
    ['Renderer 收到群組鍵值', debugInfo.receivedGroupKey],
    ['收到時頁面可見狀態', debugInfo.documentVisibilityState],
    ['收到時頁面有焦點', debugInfo.documentHasFocus],
    ['收到時音效已解鎖', debugInfo.rendererAudioUnlocked],
    ['收到時警報已啟用', debugInfo.rendererAlarmEnabled],
    ['Modal 開啟時間', debugInfo.modalOpenedAt],
    ['audio.play() 呼叫時間', debugInfo.audioPlayCalledAt],
    ['audio.play() 完成時間', debugInfo.audioPlayResolvedAt],
    ['audio.play() 錯誤', debugInfo.rendererAudioPlayError],
    ['WebContents 音訊靜音', debugInfo.webContentsAudioMuted]
  ];
}

// 依 Main Process 的唯一小視窗狀態切換版面，瀏覽器模式不顯示桌面專用控制項。
export function updateCompactWindowMode(isCompact, isDesktop = false) {
  document.body.classList.toggle('compact-window-mode', Boolean(isCompact));
  const exitButton = $('#compactWindowExitButton');
  exitButton.hidden = !isDesktop || !isCompact;
}

// 綁定小視窗返回按鈕；實際尺寸與最上層設定只交由 Main Process 處理。
export function bindCompactWindowControls(onExit) {
  $('#compactWindowExitButton').addEventListener('click', () => onExit());
}

// 顯示今日場次匯入提醒並將鍵盤焦點移至主要上傳按鈕。
export function showDailyImportReminder({ title = '尚未匯入今日場次表', message = '請上傳當日場次表，以啟用場次監控、倒數與鬧鐘提醒。' } = {}) {
  $('#dailyImportReminderTitle').textContent = title;
  $('#dailyImportReminderMessage').textContent = message;
  $('#dailyImportReminderModal').hidden = false;
  $('#uploadTodayExcelScheduleButton').focus();
}

// 關閉今日場次匯入提醒，不影響程式與既有場次資料。
export function hideDailyImportReminder() {
  $('#dailyImportReminderModal').hidden = true;
}

// 綁定提醒 Modal 的 Excel、PDF 與稍後提醒按鈕，沿用頁首既有的兩個檔案輸入元件。
export function bindDailyImportReminder({ onUploadExcel, onUploadPdf, onSnooze }) {
  $('#uploadTodayExcelScheduleButton').addEventListener('click', onUploadExcel);
  $('#uploadTodayPdfScheduleButton').addEventListener('click', onUploadPdf);
  $('#snoozeTodayScheduleButton').addEventListener('click', onSnooze);
}

// 綁定偵錯面板切換按鈕，僅回傳使用者意圖，開關狀態仍保存在集中 state。
export function bindDebugPanel(onToggle) {
  const button = $('#debugToggle');
  button.addEventListener('click', () => {
    const isOpen = button.getAttribute('aria-expanded') !== 'true';
    onToggle(isOpen);
  });
}

// 更新偵錯面板；收合時不寫入欄位 DOM，但不影響既有 ticker 與其他畫面更新。
export function updateDebugPanel(debugInfo, isOpen) {
  const panel = $('#debugPanel');
  const button = $('#debugToggle');
  panel.hidden = !isOpen;
  button.textContent = isOpen ? '隱藏偵錯資訊' : '顯示偵錯資訊';
  button.setAttribute('aria-expanded', String(isOpen));
  if (!isOpen) return;

  $('#debugContent').innerHTML = getDebugEntries(debugInfo).map(([label, value]) => renderDebugItem(label, value)).join('');
}

// 更新匯入檔案的狀態文字。
export function updateFileStatus(message) {
  $('#fileStatus').textContent = message;
}

// 集中更新統計卡；時間狀態欄位在本次提交固定顯示 0。
export function updateStatistics(statistics) {
  $('#totalStat').textContent = statistics.total;
  $('#visibleStat').textContent = statistics.visible;
  $('#finishedStat').textContent = statistics.finished;
  $('#remainingStat').textContent = statistics.remaining;
  $('#playingStat').textContent = statistics.playing;
}

// 將集中 state 的主題值套用到頁面，並同步既有頁首切換按鈕文字。
export function applyTheme(theme) {
  const isLight = theme === 'light';
  document.body.classList.toggle('light', isLight);
  $('#themeButton').textContent = isLight ? '深色模式' : '淺色模式';
}

// 綁定深淺色主題切換按鈕，實際設定更新仍交由 app.js 的集中 state 處理。
export function bindThemeToggle(onToggle) {
  $('#themeButton').addEventListener('click', () => onToggle());
}

// 開啟設定中心並將鍵盤焦點移至關閉按鈕，避免焦點停留在背景頁面。
function openSettingsModal() {
  $('#settingsModal').hidden = false;
  document.body.classList.add('settings-open');
  $('#settingsCloseButton').focus();
}

// 關閉設定中心並移除鎖定背景捲動的頁面狀態。
function closeSettingsModal() {
  $('#settingsModal').hidden = true;
  document.body.classList.remove('settings-open');
  $('#settingsButton').focus();
}

// 依集中 state 更新設定中心所有控制項，避免表單另行保存設定副本。
export function updateSettingsForm(settings, desktopStartupState = {}) {
  $('#settingsVolume').value = String(Math.round((Number(settings?.alarmVolume) || 0) * 100));
  $('#settingsVolumeValue').textContent = `${$('#settingsVolume').value}%`;
  $('#settingsSoundMode').value = settings?.alarmSoundMode || 'DEFAULT';
  $('#settingsLeadMinutes').value = String(settings?.alarmLeadMinutes || 0);
  $('#settingsTheme').value = settings?.theme === 'light' ? 'light' : 'dark';
  $('#settingsDebugPanel').checked = Boolean(settings?.debugPanelOpen);
  $('#settingsDailyImportReminder').checked = Boolean(settings?.dailyImportReminderEnabled);

  const desktopGroup = $('#desktopSettingsGroup');
  const isDesktop = Boolean(desktopStartupState.isDesktop);
  desktopGroup.hidden = !isDesktop;
  if (!isDesktop) return;

  const startupCheckbox = $('#settingsStartupEnabled');
  const startupSupported = Boolean(desktopStartupState.supported);
  startupCheckbox.disabled = !startupSupported;
  startupCheckbox.checked = startupSupported
    ? Boolean(desktopStartupState.enabled)
    : Boolean(settings?.startupEnabled);

  // Windows 尚未建立 StartupApproved 紀錄時，Electron 也可能回傳 false；Run 項目存在才是此開關的可靠來源。
  if (startupSupported) {
    $('#settingsStartupStatus').textContent = desktopStartupState.enabled ? '已啟用' : '已關閉';
  } else if (desktopStartupState.installationType === 'portable') {
    $('#settingsStartupStatus').textContent = 'Portable 不建立永久啟動項目；請使用 Setup 安裝版。';
  } else {
    $('#settingsStartupStatus').textContent = '僅 Windows Setup 安裝版支援；開發模式不會建立啟動項目。';
  }
}

// 顯示 localStorage 寫入失敗等需要使用者留意的設定訊息。
export function updateSettingsNotice(message) {
  const notice = $('#settingsStorageNotice');
  notice.textContent = message || '';
  notice.hidden = !message;
}

// 依目前館別設定建立規格篩選與語音測試選項，避免 MM 顯示 TC 的 GC 廳資訊。
export function configureCinemaUi() {
  const formatFilter = $('#formatFilter');
  formatFilter.replaceChildren(new Option('所有規格', 'ALL'), ...FORMATS.map(format => new Option(format, format)));
  const hallVoiceSelect = $('#hallVoiceTestSelect');
  hallVoiceSelect.replaceChildren(new Option('預設警報聲', 'DEFAULT_ALARM'), ...HALLS.map(hall => new Option(hall, hall)));
  document.documentElement.dataset.cinema = CINEMA_CODE;
  const brandVersion = document.querySelector('.brand small');
  if (brandVersion) brandVersion.textContent = `${CINEMA_CODE} V${VERSION.replace(/\.0$/, '')}`;
  const monitorTitle = $('#monitorTitle');
  if (monitorTitle) monitorTitle.textContent = MONITOR_TITLE;
}

// 綁定設定中心開關與控制項；所有設定變更只回傳給 app.js 更新集中 state。
export function bindSettingsControls({ onChange, onStartupChange, onHallVoiceTest }) {
  $('#settingsButton').addEventListener('click', openSettingsModal);
  $('#settingsCloseButton').addEventListener('click', closeSettingsModal);
  $('[data-settings-close]').addEventListener('click', closeSettingsModal);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#settingsModal').hidden) {
      event.preventDefault();
      closeSettingsModal();
    }
  });

  $('#settingsVolume').addEventListener('input', event => onChange({ alarmVolume: Number(event.target.value) / 100 }));
  $('#settingsSoundMode').addEventListener('change', event => onChange({ alarmSoundMode: event.target.value }));
  $('#settingsLeadMinutes').addEventListener('change', event => onChange({ alarmLeadMinutes: Number(event.target.value) }));
  $('#settingsTheme').addEventListener('change', event => onChange({ theme: event.target.value }));
  $('#settingsDebugPanel').addEventListener('change', event => onChange({ debugPanelOpen: event.target.checked }));
  $('#settingsDailyImportReminder').addEventListener('change', event => onChange({ dailyImportReminderEnabled: event.target.checked }));
  $('#settingsStartupEnabled').addEventListener('change', event => onStartupChange(event.target.checked));
  $('#playHallVoiceTestButton').addEventListener('click', () => onHallVoiceTest($('#hallVoiceTestSelect').value));
}

// 更新警報語音試聽的非阻塞結果，不影響正式警報 Modal 或設定保存訊息。
export function updateHallVoiceTestStatus(message) {
  $('#hallVoiceTestStatus').textContent = message || '';
}

// 將 DCP 匯入時間格式化為本機 YYYY/MM/DD HH:mm，無效值安全省略。
function formatDcpImportedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')];
  const time = [String(date.getHours()).padStart(2, '0'), String(date.getMinutes()).padStart(2, '0')].join(':');
  return `${parts.join('/')} ${time}`;
}

// 更新 DCP 匯入摘要；錯誤以同一非阻塞狀態區顯示，不覆蓋上一份有效對照。
export function updateDcpTitleStatus({ uniqueTitles = 0, sourceFileName = '', sourceSheetName = '', importedAt = '', conflicts = 0, unmatchedSessions = 0, loading = '', error = '' } = {}) {
  const status = $('#dcpTitleStatus');
  if (loading) {
    status.textContent = loading;
    return;
  }
  if (error) {
    status.textContent = error;
    return;
  }
  if (uniqueTitles <= 0) {
    status.textContent = '尚未匯入 DCP 中文片名資料';
    return;
  }
  status.textContent = [
    '已更新 DCP 中文片名資料',
    `來源：${sourceFileName || '—'}`,
    `工作表：${sourceSheetName || '—'}`,
    `更新時間：${formatDcpImportedAt(importedAt) || '—'}`,
    `片名對照：${uniqueTitles} 組`,
    `衝突：${Number(conflicts) || 0} 組`,
    `未匹配場次：${Number(unmatchedSessions) || 0} 部`
  ].join('\n');
}

// 綁定 DCP 檔案匯入及內嵌清除確認，不建立第二個檔案輸入或使用 alert。
export function bindDcpTitleControls({ onImport, onClear }) {
  const input = $('#dcpTitleFileInput');
  const confirmation = $('#clearDcpConfirm');
  $('#importDcpTitleButton').addEventListener('click', () => input.click());
  input.addEventListener('change', async event => {
    const file = event.target.files[0];
    if (file) await onImport(file);
    event.target.value = '';
  });
  $('#clearDcpTitleButton').addEventListener('click', () => {
    confirmation.hidden = false;
    $('#confirmClearDcpButton').focus();
  });
  $('#confirmClearDcpButton').addEventListener('click', () => {
    confirmation.hidden = true;
    onClear();
  });
  $('#cancelClearDcpButton').addEventListener('click', () => {
    confirmation.hidden = true;
    $('#clearDcpTitleButton').focus();
  });
}

// 顯示或隱藏場次表格下方的空狀態與錯誤提示。
export function setTableNotice(message) {
  const notice = $('#emptyState');
  notice.textContent = message;
  notice.hidden = !message;
}
