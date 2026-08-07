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
  const marker = ['PRIVATE', 'LIVE', 'SPECIAL'].includes(session.manualMarker) ? session.manualMarker : 'NORMAL';
  const specialTimingMode = session.specialTimingMode === 'FLEXIBLE' ? 'FLEXIBLE' : 'ON_TIME';
  const requiresConfirmation = marker === 'PRIVATE' || marker === 'LIVE' || (marker === 'SPECIAL' && specialTimingMode === 'FLEXIBLE');
  const openingConfirmed = requiresConfirmation && session.openingConfirmed === true;
  const requiresLatestTime = requiresConfirmation && marker !== 'LIVE';
  const markerWidth = { NORMAL: '78px', PRIVATE: '72px', LIVE: '72px', SPECIAL: '82px' }[marker];
  const latestStartTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(session.latestStartTime || '') ? session.latestStartTime : '';
  const markerLabel = `${session.hall || '未標示影廳'} ${session.start || ''} ${session.displayTitle || session.title || ''}`.trim();
  return `<tr><td><span class="status-badge ${status.className}" data-status="${escapeHtml(session.status)}">${status.label}</span></td><td><div class="private-booking-fields"><select class="session-type-select type-${marker.toLowerCase()}" style="--session-type-width:${markerWidth}" data-session-marker data-session-id="${escapeHtml(session.id)}" aria-label="${escapeHtml(markerLabel)} 場次類型"><option value="NORMAL" hidden${marker === 'NORMAL' ? ' selected' : ''}>＋ 標記</option><option value="PRIVATE"${marker === 'PRIVATE' ? ' selected' : ''}>包廳</option><option value="LIVE"${marker === 'LIVE' ? ' selected' : ''}>LIVE</option><option value="SPECIAL"${marker === 'SPECIAL' ? ' selected' : ''}>特別場</option></select><button class="session-type-clear${marker === 'NORMAL' ? ' is-hidden' : ''}" type="button" data-clear-session-marker data-session-id="${escapeHtml(session.id)}" aria-label="清除 ${escapeHtml(markerLabel)} 的場次類型" title="恢復為一般場次">×</button><select class="special-timing-select${marker === 'SPECIAL' ? '' : ' is-hidden'}" data-special-timing-mode data-session-id="${escapeHtml(session.id)}" aria-label="${escapeHtml(markerLabel)} 特別場開播方式"><option value="ON_TIME"${specialTimingMode === 'ON_TIME' ? ' selected' : ''}>準時開播</option><option value="FLEXIBLE"${specialTimingMode === 'FLEXIBLE' ? ' selected' : ''}>非表定時間</option></select><label class="private-time-field${requiresLatestTime ? '' : ' is-hidden'}"><span>最晚開播時間</span><input class="private-latest-time" type="text" inputmode="numeric" maxlength="5" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" placeholder="HH:MM" data-private-latest-time data-session-id="${escapeHtml(session.id)}" aria-label="${escapeHtml(markerLabel)} 最晚開播時間，24 小時制" value="${escapeHtml(latestStartTime)}"${requiresLatestTime ? '' : ' disabled'}></label><label class="private-started-control${requiresConfirmation ? '' : ' is-hidden'}"><input type="checkbox" data-private-started data-session-id="${escapeHtml(session.id)}"${openingConfirmed ? ' checked' : ''}${requiresConfirmation ? '' : ' disabled'}><span>${marker === 'LIVE' ? '確認已開演' : '確認已開播'}</span></label></div></td><td>${escapeHtml(session.start)}</td><td>${escapeHtml(session.finish)}</td><td>${renderHallBadge(session.hall)}</td><td>${renderFormatBadges(session) || '—'}</td><td>${renderLanguageBadge(session.language)}</td><td class="movie-cell" title="${escapeHtml(session.originalTitle || session.title)}">${escapeHtml(session.displayTitle || session.title)}</td><td class="remaining-time">${escapeHtml(getRemainingText(session))}</td></tr>`;
}

// 將日期標題及其所屬場次轉為連續表格列，提供清楚的日期視覺分隔。
function renderDateGroup(group) {
  const dateTitle = escapeHtml(formatCompactChineseDate(group.date, group.weekday));
  return `<tr class="date-group-row"><td colspan="9">${dateTitle}</td></tr>${group.sessions.map(renderSessionRow).join('')}`;
}

// 將集中 state 的可見場次依日期分組後渲染到既有表格。
export function renderMovieRows(sessions) {
  const body = document.querySelector('#scheduleBody');
  const activeMarkerControl = document.activeElement?.closest?.('[data-session-marker], [data-special-timing-mode], [data-private-latest-time]');
  if (activeMarkerControl && body.contains(activeMarkerControl)) return;
  body.innerHTML = groupSessionsByDate(sessions).map(renderDateGroup).join('');
}

// 使用表格事件代理將單筆場次的人工標記交回集中 state，不在 UI 模組保存第二份資料。
export function bindSessionMarkerControls(onChange) {
  const body = document.querySelector('#scheduleBody');
  body.addEventListener('click', event => {
    const clearButton = event.target.closest('[data-clear-session-marker]');
    if (!clearButton) return;
    const markerSelect = clearButton.closest('tr').querySelector('[data-session-marker]');
    markerSelect.value = 'NORMAL';
    markerSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  body.addEventListener('input', event => {
    const timeInput = event.target.closest('[data-private-latest-time]');
    if (!timeInput) return;
    const digits = timeInput.value.replace(/\D/g, '').slice(0, 4);
    timeInput.value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  });
  body.addEventListener('change', event => {
    const control = event.target.closest('[data-session-marker], [data-special-timing-mode], [data-private-latest-time], [data-private-started]');
    if (!control) return;
    const row = control.closest('tr');
    const markerSelect = row.querySelector('[data-session-marker]');
    const specialTimingSelect = row.querySelector('[data-special-timing-mode]');
    const timeInput = row.querySelector('[data-private-latest-time]');
    const timeField = row.querySelector('.private-time-field');
    const startedInput = row.querySelector('[data-private-started]');
    const startedControl = row.querySelector('.private-started-control');
    const requiresConfirmation = markerSelect.value === 'PRIVATE' || markerSelect.value === 'LIVE'
      || (markerSelect.value === 'SPECIAL' && specialTimingSelect.value === 'FLEXIBLE');
    const requiresLatestTime = requiresConfirmation && markerSelect.value !== 'LIVE';
    const markerWidths = { NORMAL: '78px', PRIVATE: '72px', LIVE: '72px', SPECIAL: '82px' };
    markerSelect.className = `session-type-select type-${markerSelect.value.toLowerCase()}`;
    markerSelect.style.setProperty('--session-type-width', markerWidths[markerSelect.value]);
    row.querySelector('[data-clear-session-marker]').classList.toggle('is-hidden', markerSelect.value === 'NORMAL');
    specialTimingSelect.classList.toggle('is-hidden', markerSelect.value !== 'SPECIAL');
    if (markerSelect.value !== 'SPECIAL') specialTimingSelect.value = 'ON_TIME';
    timeInput.disabled = !requiresLatestTime;
    timeField.classList.toggle('is-hidden', !requiresLatestTime);
    if (!requiresLatestTime) timeInput.value = '';
    startedInput.disabled = !requiresConfirmation;
    if (!requiresConfirmation) startedInput.checked = false;
    startedControl.classList.toggle('is-hidden', !requiresConfirmation);
    startedControl.querySelector('span').textContent = markerSelect.value === 'LIVE' ? '確認已開演' : '確認已開播';
    onChange(control.dataset.sessionId || '', markerSelect.value, timeInput.value || '', requiresConfirmation && startedInput.checked, specialTimingSelect.value);
  });
}
