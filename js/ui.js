// 統一管理基礎 UI 更新，避免其他模組直接依賴 DOM 結構。
const $ = selector => document.querySelector(selector);

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

export function bindThemeToggle() {
  const button = $('#themeButton');
  button.addEventListener('click', () => {
    const light = document.body.classList.toggle('light');
    button.textContent = light ? '深色模式' : '淺色模式';
  });
}

export function setTableNotice(message) {
  const notice = $('#emptyState');
  notice.textContent = message;
  notice.hidden = !message;
}