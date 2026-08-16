const compactApi = globalThis.compactWindow;
const $ = selector => document.querySelector(selector);
let latestPresentation = {};
let alarmIsActive = false;
let compactResizeObserver = null;
let compactResizePending = false;
let compactResizeQueued = false;

// 依卡片實際外框高度調整 BrowserWindow，避免透明區域殘留成黑色空白。
async function requestCompactResize() {
  const card = $('#compactCard');
  if (!card) return;
  if (compactResizePending) {
    compactResizeQueued = true;
    return;
  }

  compactResizePending = true;
  try {
    compactResizeObserver?.unobserve(card);
    // 量測時暫時解除卡片與場次區的視窗高度限制，取得包含包廳、LIVE、
    // 特別場提示與停止按鈕的完整自然高度；否則 CSS 的 100vh 限制會把
    // 已裁切的高度誤當成完整高度，Main Process 便無法把實體視窗加高。
    card.style.maxHeight = '';
    card.classList.add('compact-measuring');
    const cardBounds = card.getBoundingClientRect();
    const borderHeight = Math.max(0, cardBounds.height - card.clientHeight);
    const fullCardHeight = Math.max(cardBounds.height, card.scrollHeight + borderHeight);
    card.classList.remove('compact-measuring');
    const requestedHeight = Math.ceil(fullCardHeight + 10);
    const result = await compactApi.resize(requestedHeight);
    if (Number.isFinite(result?.height)) {
      card.style.maxHeight = result.height < requestedHeight
        ? `${Math.max(150, result.height - 10)}px`
        : '';
    }
  } finally {
    card.classList.remove('compact-measuring');
    compactResizeObserver?.observe(card);
    compactResizePending = false;
    if (compactResizeQueued) {
      compactResizeQueued = false;
      requestAnimationFrame(requestCompactResize);
    }
  }
}

// 將完整星期文字縮寫為單一繁體中文字，避免小視窗日期列過長。
function formatCompactWeekday(weekday) {
  const normalized = String(weekday || '').trim();
  const weekdayMap = {
    星期日: '日', 星期一: '一', 星期二: '二', 星期三: '三',
    星期四: '四', 星期五: '五', 星期六: '六'
  };
  return weekdayMap[normalized] || normalized.replace(/^星期/, '');
}

// 建立純文字 Badge，避免將外部場次資料直接寫入 innerHTML。
function createBadge(text, extraClass = '') {
  const badge = document.createElement('span');
  badge.className = `badge ${extraClass}`.trim();
  badge.textContent = text;
  return badge;
}

function appendSessionTypeBadge(container, session) {
  const labels = { PRIVATE: '包廳', LIVE: 'LIVE', SPECIAL: '特別場' };
  const label = labels[session.manualMarker];
  if (label) container.append(createBadge(label, `session-type type-${session.manualMarker.toLowerCase()}`));
}

// SPECIAL 是規格修飾詞；在小視窗與原始視窗一致合併成單一規格 Badge。
function combineSpecialFormats(formats) {
  const normalized = [...new Set((Array.isArray(formats) ? formats : []).filter(Boolean))];
  if (!normalized.includes('SPECIAL') || normalized.length === 1) return normalized;
  const baseFormats = normalized.filter(format => format !== 'SPECIAL');
  const combinedBase = baseFormats.includes('3D') && baseFormats.includes('DIG')
    ? baseFormats.filter(format => format !== '3D' && format !== 'DIG').concat('3D / DIG').join(' / ')
    : baseFormats.join(' / ');
  return [`${combinedBase} SPECIAL`];
}

function createPrivateBookingNotice(session) {
  const labels = { PRIVATE: '包廳', LIVE: 'LIVE', SPECIAL: '特別場' };
  if (!labels[session.manualMarker] || (session.manualMarker === 'SPECIAL' && session.specialTimingMode !== 'FLEXIBLE')) return null;
  const notice = document.createElement('p');
  notice.className = `session-private-notice type-${session.manualMarker.toLowerCase()}`;
  const action = session.manualMarker === 'LIVE' ? '開演' : '開播';
  notice.textContent = `${labels[session.manualMarker]}場次需人工確認${action}${session.latestStartTime ? `，最晚開播時間為（${session.latestStartTime}）` : ''}`;
  return notice;
}

// 依小視窗待確認場次類型建立標題，LIVE 明確標示為待開演資訊。
function getOpeningConfirmationHeading(sessions, operationalDateKey) {
  const markers = new Set(sessions.map(session => session.manualMarker));
  const title = markers.size === 1 && markers.has('LIVE')
    ? 'LIVE待開演資訊'
    : markers.size === 1 && markers.has('PRIVATE')
      ? '包廳待開播資訊'
      : markers.size === 1 && markers.has('SPECIAL')
        ? '特別場待開播資訊'
        : '待確認開播／開演資訊';
  return `${title}｜${operationalDateKey.replaceAll('-', '/')}`;
}

function renderPrivateBookingMonitor(sessions = [], operationalDateKey = '') {
  const monitor = $('#compactPrivateMonitor');
  monitor.replaceChildren();
  monitor.hidden = !sessions.length;
  if (!sessions.length) return;
  const heading = document.createElement('strong');
  heading.textContent = getOpeningConfirmationHeading(sessions, operationalDateKey);
  monitor.classList.toggle('type-live', sessions.every(session => session.manualMarker === 'LIVE'));
  monitor.append(heading);
  sessions.forEach(session => {
    const item = document.createElement('div');
    item.className = `compact-private-monitor-item type-${String(session.manualMarker || 'PRIVATE').toLowerCase()}`;
    const text = document.createElement('span');
    const typeLabel = { PRIVATE: '包廳', LIVE: 'LIVE', SPECIAL: '特別場' }[session.manualMarker] || '包廳';
    text.textContent = `${typeLabel}｜${session.hallDisplay || session.hall || '—'}｜${session.title || '未命名場次'}｜原訂 ${session.start || '--:--'}${session.latestStartTime ? `｜最晚 ${session.latestStartTime}` : ''}`;
    const button = document.createElement('button');
    button.type = 'button';
    const confirmationLabel = session.manualMarker === 'LIVE' ? '確認已開演' : '確認已開播';
    button.textContent = `▶ ${confirmationLabel}`;
    button.title = `場次實際${session.manualMarker === 'LIVE' ? '開演' : '開播'}後按此確認並移除待確認提醒`;
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = '處理中…';
      try {
        await compactApi.markPrivateBookingStarted(session.id);
      } catch {
        button.disabled = false;
        button.textContent = `▶ ${confirmationLabel}`;
      }
    });
    item.append(text, button);
    monitor.append(item);
  });
}

// 以 Main Renderer 提供的唯讀顯示資料更新小視窗，不自行計算場次或倒數。
function renderPresentation(presentation = {}) {
  latestPresentation = presentation;
  document.body.classList.toggle('light', presentation.theme === 'light');
  if (alarmIsActive) return;
  $('#compactCard').classList.remove('alarm-mode');
  $('.compact-header > span').textContent = 'NEXT MOVIE';
  $('#compactAutoDismissNote').hidden = !presentation.alarmAutoDismissEnabled;
  const sessions = Array.isArray(presentation.sessions) ? presentation.sessions : [];
  $('#compactPrivateBookingNotice').hidden = true;
  $('#stopAlarmButton').hidden = true;
  const compactWeekday = formatCompactWeekday(presentation.weekday);
  $('#compactDate').textContent = presentation.date && presentation.date !== '--'
    ? `${presentation.date} ${compactWeekday ? `(${compactWeekday})` : ''}`
    : '--';
  $('#compactTime').textContent = presentation.time || '--:--';
  $('#compactCountdown').textContent = presentation.countdown || '00:00:00';
  const scheduleFileName = presentation.scheduleFileName || '尚未匯入';
  $('#compactScheduleFileName').textContent = `檔案名稱：${scheduleFileName}`;
  $('#compactScheduleFileName').title = presentation.scheduleFileName || '';
  $('#compactScheduleVersion').textContent = presentation.scheduleVersionTime
    ? `場次版本：${presentation.scheduleVersionTime}`
    : '場次版本：無法辨識';
  renderPrivateBookingMonitor(Array.isArray(presentation.privateBookings) ? presentation.privateBookings : [], presentation.operationalDateKey || '');
  const container = $('#compactSessions');
  container.classList.toggle('many-sessions', presentation.sessions?.length > 1);
  container.replaceChildren();
  if (!presentation.sessions?.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = '尚未匯入場次';
    container.append(empty);
  } else {
    presentation.sessions.forEach(session => {
      const card = document.createElement('article');
      card.className = 'session';
      card.append(createBadge(session.hallDisplay || session.hall || '—', 'hall'));
      const title = document.createElement('strong');
      title.className = 'title';
      title.textContent = session.title || '未命名場次';
      card.append(title);
      const badges = document.createElement('div');
      badges.className = 'badges';
      appendSessionTypeBadge(badges, session);
      if (session.language) badges.append(createBadge(session.language, 'language'));
      combineSpecialFormats(session.formats).forEach(format => badges.append(createBadge(format, 'format')));
      card.append(badges);
      const privateNotice = createPrivateBookingNotice(session);
      if (privateNotice) card.append(privateNotice);
      container.append(card);
    });
  }
  requestAnimationFrame(requestCompactResize);
}

// 將 Main Process 到點資料顯示於同一個小視窗，並提供停止目前警報的唯一按鈕。
function renderAlarm(payload = {}) {
  alarmIsActive = true;
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  $('#compactCard').classList.add('alarm-mode');
  $('.compact-header > span').textContent = '場次開始';
  $('#compactDate').textContent = payload.dateLabel || '--';
  $('#compactTime').textContent = payload.timeLabel || '--:--';
  $('#compactCountdown').textContent = '00:00:00';
  $('#compactAutoDismissNote').hidden = !latestPresentation.alarmAutoDismissEnabled;
  $('#compactPrivateBookingNotice').hidden = true;
  $('#stopAlarmButton').hidden = false;
  const container = $('#compactSessions');
  container.classList.toggle('many-sessions', sessions.length > 1);
  container.replaceChildren();
  sessions.forEach(session => {
    const card = document.createElement('article');
    card.className = 'session';
    card.append(createBadge(session.hallDisplay || session.hall || '—', 'hall'));
    const title = document.createElement('strong');
    title.className = 'title';
    title.textContent = session.title || '未命名場次';
    card.append(title);
    const badges = document.createElement('div');
    badges.className = 'badges';
    appendSessionTypeBadge(badges, session);
    if (session.language) badges.append(createBadge(session.language, 'language'));
    const formats = session.formats?.length ? session.formats : [session.format].filter(Boolean);
    combineSpecialFormats(formats).forEach(format => badges.append(createBadge(format, 'format')));
    card.append(badges);
    const privateNotice = createPrivateBookingNotice(session);
    if (privateNotice) card.append(privateNotice);
    container.append(card);
  });
  requestAnimationFrame(requestCompactResize);
}

// 停止警報後直接恢復最新 Next Movie 顯示，不切回完整主視窗。
function restoreAfterAlarm() {
  alarmIsActive = false;
  renderPresentation(latestPresentation);
}

// 綁定返回完整視窗及 Main Process 顯示資料事件。
function init() {
  const compactCard = $('#compactCard');
  if (compactCard && typeof ResizeObserver === 'function') {
    compactResizeObserver = new ResizeObserver(() => requestCompactResize());
    compactResizeObserver.observe(compactCard);
  }
  $('#showFullButton').addEventListener('click', () => compactApi.showFull());
  $('#stopAlarmButton').addEventListener('click', () => compactApi.stopAlarm());
  document.addEventListener('contextmenu', event => {
    event.preventDefault();
    compactApi.showContextMenu();
  });
  compactApi.onPresentation(renderPresentation);
  compactApi.onAlarm(renderAlarm);
  compactApi.onAlarmStopped(restoreAfterAlarm);
}

init();
