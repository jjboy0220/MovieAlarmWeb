import { renderFormatBadges, renderHallBadge, renderLanguageBadge } from './badgeRenderer.js';
import { escapeHtml, formatCompactChineseDate } from './utils.js';

let renderedGroupKey = '';

// 統一查詢單一 DOM 節點，避免各 UI 函式重複撰寫選擇器。
const $ = selector => document.querySelector(selector);

// 以群組開播時間與場次識別碼建立穩定鍵值，避免每秒重建相同的場次清單。
function getSessionGroupKey(group) {
  return `${group.startDateTime}|${group.sessions.map(session => session.id || `${session.hall}-${session.title}`).join('|')}`;
}

// 將單一同時開播場次渲染為 Next Movie 資訊卡，保留影廳、純片名、語言與格式 Badge。
function renderNextSession(session) {
  const languageBadge = renderLanguageBadge(session.language);
  const formatBadges = renderFormatBadges(session);
  const metadataBadges = [languageBadge, formatBadges].filter(Boolean).join('');

  return `<article class="next-session-item"><div class="next-session-hall">${renderHallBadge(session.hall) || '—'}</div><strong class="next-session-title">${escapeHtml(session.title)}</strong><div class="next-session-badges">${metadataBadges || '<span class="next-session-unlabeled">未標示語言或格式</span>'}</div></article>`;
}

// 將單一警報場次渲染為 Modal 內的資訊卡，電影名稱只顯示純 title。
function renderAlarmSession(session) {
  const languageBadge = renderLanguageBadge(session.language);
  const formatBadges = renderFormatBadges(session);
  const metadataBadges = [languageBadge, formatBadges].filter(Boolean).join('');

  return `<article class="alarm-session-item"><div class="alarm-session-hall">${renderHallBadge(session.hall) || '—'}</div><strong class="alarm-session-title">${escapeHtml(session.title)}</strong><div class="alarm-session-badges">${metadataBadges || '<span class="alarm-session-unlabeled">未標示語言或格式</span>'}</div></article>`;
}

// 渲染同一開播時間的所有場次；日期、時間與倒數由卡片上方共用區塊顯示一次。
function renderNextSessionList(group) {
  $('#nextSessionList').innerHTML = group.sessions.map(renderNextSession).join('');
}

// 呈現 Next Movie 的非 upcoming 安全訊息，避免卡片出現空白、undefined 或混合狀態。
function renderNextSessionPlaceholder(message) {
  $('#nextSessionList').innerHTML = `<p class="next-session-empty">${escapeHtml(message)}</p>`;
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
    ['解析成功場次', debugInfo.totalSessions],
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
    ['背景補償群組', debugInfo.missedAlarmGroup]
  ];
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
export function updateSettingsForm(settings) {
  $('#settingsVolume').value = String(Math.round((Number(settings?.alarmVolume) || 0) * 100));
  $('#settingsVolumeValue').textContent = `${$('#settingsVolume').value}%`;
  $('#settingsSoundMode').value = settings?.alarmSoundMode || 'DEFAULT';
  $('#settingsLeadMinutes').value = String(settings?.alarmLeadMinutes || 0);
  $('#settingsTheme').value = settings?.theme === 'light' ? 'light' : 'dark';
  $('#settingsDebugPanel').checked = Boolean(settings?.debugPanelOpen);
}

// 顯示 localStorage 寫入失敗等需要使用者留意的設定訊息。
export function updateSettingsNotice(message) {
  const notice = $('#settingsStorageNotice');
  notice.textContent = message || '';
  notice.hidden = !message;
}

// 綁定設定中心開關與控制項；所有設定變更只回傳給 app.js 更新集中 state。
export function bindSettingsControls({ onChange }) {
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
}

// 顯示或隱藏場次表格下方的空狀態與錯誤提示。
export function setTableNotice(message) {
  const notice = $('#emptyState');
  notice.textContent = message;
  notice.hidden = !message;
}
