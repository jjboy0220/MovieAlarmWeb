import { escapeHtml } from './utils.js';

// 清除既有表格列；空狀態訊息由 app.js 的集中 state 決定。
export function createEmptyTable() {
  document.querySelector('#scheduleBody').replaceChildren();
}

// 將集中 state 的可見場次渲染到既有表格。
export function renderMovieRows(sessions) {
  const body = document.querySelector('#scheduleBody');
  body.innerHTML = sessions.map(session => `<tr><td><span class="status-badge neutral">已載入</span></td><td>${escapeHtml(session.start)}</td><td>${escapeHtml(session.finish)}</td><td><strong>${escapeHtml(session.hall)}</strong></td><td>${session.format ? `<span class="format-badge ${session.format.toLowerCase() === '4dx' ? 'fourdx' : session.format.toLowerCase()}">${escapeHtml(session.format)}</span>` : '—'}</td><td>${escapeHtml(session.language || '—')}</td><td class="movie-cell">${escapeHtml(session.displayTitle)}</td><td>—</td></tr>`).join('');
}