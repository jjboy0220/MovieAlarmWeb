const compactApi = globalThis.compactWindow;
const $ = selector => document.querySelector(selector);
let latestPresentation = {};
let alarmIsActive = false;

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

// 以 Main Renderer 提供的唯讀顯示資料更新小視窗，不自行計算場次或倒數。
function renderPresentation(presentation = {}) {
  latestPresentation = presentation;
  document.body.classList.toggle('light', presentation.theme === 'light');
  if (alarmIsActive) return;
  $('#compactCard').classList.remove('alarm-mode');
  $('.compact-header > span').textContent = 'NEXT MOVIE';
  $('#stopAlarmButton').hidden = true;
  const compactWeekday = formatCompactWeekday(presentation.weekday);
  $('#compactDate').textContent = presentation.date && presentation.date !== '--'
    ? `${presentation.date} ${compactWeekday ? `(${compactWeekday})` : ''}`
    : '--';
  $('#compactTime').textContent = presentation.time || '--:--';
  $('#compactCountdown').textContent = presentation.countdown || '00:00:00';
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
      card.append(createBadge(session.hall || '—', 'hall'));
      const title = document.createElement('strong');
      title.className = 'title';
      title.textContent = session.title || '未命名場次';
      card.append(title);
      const badges = document.createElement('div');
      badges.className = 'badges';
      if (session.language) badges.append(createBadge(session.language));
      (session.formats || []).filter(Boolean).forEach(format => badges.append(createBadge(format, 'format')));
      card.append(badges);
      container.append(card);
    });
  }
  requestAnimationFrame(() => compactApi.resize(Math.ceil($('#compactCard').scrollHeight + 10)));
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
  $('#stopAlarmButton').hidden = false;
  const container = $('#compactSessions');
  container.classList.toggle('many-sessions', sessions.length > 1);
  container.replaceChildren();
  sessions.forEach(session => {
    const card = document.createElement('article');
    card.className = 'session';
    card.append(createBadge(session.hall || '—', 'hall'));
    const title = document.createElement('strong');
    title.className = 'title';
    title.textContent = session.title || '未命名場次';
    card.append(title);
    const badges = document.createElement('div');
    badges.className = 'badges';
    if (session.language) badges.append(createBadge(session.language));
    const formats = session.formats?.length ? session.formats : [session.format].filter(Boolean);
    formats.forEach(format => badges.append(createBadge(format, 'format')));
    card.append(badges);
    container.append(card);
  });
  requestAnimationFrame(() => compactApi.resize(Math.ceil($('#compactCard').scrollHeight + 10)));
}

// 停止警報後直接恢復最新 Next Movie 顯示，不切回完整主視窗。
function restoreAfterAlarm() {
  alarmIsActive = false;
  renderPresentation(latestPresentation);
}

// 綁定返回完整視窗及 Main Process 顯示資料事件。
function init() {
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
