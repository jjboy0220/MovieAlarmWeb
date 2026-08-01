import { escapeHtml, formatCompactChineseDate } from './utils.js';
import { renderFormatBadges, renderHallBadge, renderLanguageBadge } from './badgeRenderer.js';

const statusPresentation = {
  waiting: { label: '等待中', className: 'waiting' },
  playing: { label: '播放中', className: 'playing' },
  finished: { label: '已播完', className: 'finished' },
  invalid: { label: '時間無效', className: 'invalid' }
};

// 清除既有表格列；空狀態訊息由 app.js 的集中 state 決定。
export function createEmptyTable() {
  document.querySelector('#scheduleBody').replaceChildren();
}

// 在已選定的營運日內依真實日曆日期分組，讓跨午夜打烊場顯示隔日日期標題。
function groupSessionsByDate(sessions) {
  return sessions.reduce((groups, session) => {
    const date = session.date;
    const weekday = session.weekday;
    const latestGroup = groups[groups.length - 1];
    if (!latestGroup || latestGroup.date !== date) {
      groups.push({ date, weekday, sessions: [session] });
    } else {
      latestGroup.sessions.push(session);
    }
    return groups;
  }, []);
}

// 將剩餘秒數格式化為 HH:MM:SS，供等待中與播放中場次顯示即時時間。
function formatRemainingTime(remainingSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(remainingSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

// 依場次狀態建立剩餘欄安全文字；缺少有效結束時間時不顯示虛構倒數。
function getRemainingText(session) {
  if (session.status === 'waiting' && Number.isFinite(session.remainingSeconds)) {
    return `距開播 ${formatRemainingTime(session.remainingSeconds)}`;
  }
  if (session.status === 'playing' && Number.isFinite(session.remainingSeconds)) {
    return `剩餘 ${formatRemainingTime(session.remainingSeconds)}`;
  }
  if (session.status === 'playing') return '播放中';
  if (session.status === 'invalid') return '—';
  return '00:00:00';
}

// 將單筆可見場次轉為表格資料列；狀態與剩餘時間只讀取集中 state 的衍生欄位。
function renderSessionRow(session) {
  const status = statusPresentation[session.status] || statusPresentation.invalid;
  const isPrivate = session.manualMarker === 'PRIVATE';
  const isPrivateStarted = isPrivate && session.privateBookingStarted === true;
  const latestStartTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(session.latestStartTime || '') ? session.latestStartTime : '';
  const markerLabel = `${session.hall || '未標示影廳'} ${session.start || ''} ${session.displayTitle || session.title || ''}`.trim();
  return `<tr><td><span class="status-badge ${status.className}" data-status="${escapeHtml(session.status)}">${status.label}</span></td><td><div class="private-booking-fields"><label class="private-booking-control" title="將此場標記為包廳"><input type="checkbox" data-session-marker data-session-id="${escapeHtml(session.id)}" aria-label="將 ${escapeHtml(markerLabel)} 標記為包廳"${isPrivate ? ' checked' : ''}><span>包廳</span></label><label class="private-time-field${isPrivate ? '' : ' is-hidden'}"><span>最晚開播時間</span><input class="private-latest-time" type="text" inputmode="numeric" maxlength="5" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" placeholder="HH:MM" data-private-latest-time data-session-id="${escapeHtml(session.id)}" aria-label="${escapeHtml(markerLabel)} 最晚開播時間，24 小時制" value="${escapeHtml(latestStartTime)}"${isPrivate ? '' : ' disabled'}></label><label class="private-started-control${isPrivate ? '' : ' is-hidden'}"><input type="checkbox" data-private-started data-session-id="${escapeHtml(session.id)}"${isPrivateStarted ? ' checked' : ''}${isPrivate ? '' : ' disabled'}><span>已開播</span></label></div></td><td>${escapeHtml(session.start)}</td><td>${escapeHtml(session.finish)}</td><td>${renderHallBadge(session.hall)}</td><td>${renderFormatBadges(session) || '—'}</td><td>${renderLanguageBadge(session.language)}</td><td class="movie-cell" title="${escapeHtml(session.originalTitle || session.title)}">${escapeHtml(session.displayTitle || session.title)}</td><td class="remaining-time">${escapeHtml(getRemainingText(session))}</td></tr>`;
}

// 將日期標題及其所屬場次轉為連續表格列，提供清楚的日期視覺分隔。
function renderDateGroup(group) {
  const dateTitle = escapeHtml(formatCompactChineseDate(group.date, group.weekday));
  return `<tr class="date-group-row"><td colspan="9">${dateTitle}</td></tr>${group.sessions.map(renderSessionRow).join('')}`;
}

// 將集中 state 的可見場次依日期分組後渲染到既有表格。
export function renderMovieRows(sessions) {
  const body = document.querySelector('#scheduleBody');
  const activeTimeInput = document.activeElement?.closest?.('[data-private-latest-time]');
  if (activeTimeInput && body.contains(activeTimeInput)) return;
  body.innerHTML = groupSessionsByDate(sessions).map(renderDateGroup).join('');
}

// 使用表格事件代理將單筆場次的人工標記交回集中 state，不在 UI 模組保存第二份資料。
export function bindSessionMarkerControls(onChange) {
  const body = document.querySelector('#scheduleBody');
  body.addEventListener('input', event => {
    const timeInput = event.target.closest('[data-private-latest-time]');
    if (!timeInput) return;
    const digits = timeInput.value.replace(/\D/g, '').slice(0, 4);
    timeInput.value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  });
  body.addEventListener('change', event => {
    const control = event.target.closest('[data-session-marker], [data-private-latest-time], [data-private-started]');
    if (!control) return;
    const row = control.closest('tr');
    const checkbox = row.querySelector('[data-session-marker]');
    const timeInput = row.querySelector('[data-private-latest-time]');
    const timeField = row.querySelector('.private-time-field');
    const startedInput = row.querySelector('[data-private-started]');
    const startedControl = row.querySelector('.private-started-control');
    timeInput.disabled = !checkbox.checked;
    timeField.classList.toggle('is-hidden', !checkbox.checked);
    startedInput.disabled = !checkbox.checked;
    startedControl.classList.toggle('is-hidden', !checkbox.checked);
    onChange(control.dataset.sessionId || '', checkbox.checked ? 'PRIVATE' : 'NORMAL', timeInput.value || '', checkbox.checked && startedInput.checked);
  });
}
