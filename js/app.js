import { APP_NAME, VERSION } from './config.js';
import { readExcel } from './excelReader.js';
import { sortSessionsByStart } from './scheduler.js';
import { bindThemeToggle, updateFileStatus, updateStatistics, setTableNotice } from './ui.js';
import { createEmptyTable, renderMovieRows } from './table.js';
import { bindSearch, matchesSearch } from './search.js';
import { bindFormatFilter, matchesFormat } from './filter.js';
import { summarizeSessions } from './statistics.js';

// 單一應用程式狀態，所有清單、搜尋、篩選與統計都由此處驅動。
const state = {
  sessions: [],
  visibleSessions: [],
  searchText: '',
  formatFilter: 'ALL',
  importedFileName: '',
  lastImportedAt: null
};

// 依目前搜尋文字與規格篩選更新可見場次，再由同一份狀態重新渲染畫面。
function applyFilters() {
  state.visibleSessions = state.sessions.filter(session => (
    matchesSearch(session, state.searchText) && matchesFormat(session, state.formatFilter)
  ));
  renderFromState();
}

// 集中處理表格、統計與空狀態，避免各模組各自持有場次資料。
function renderFromState() {
  if (state.visibleSessions.length) {
    renderMovieRows(state.visibleSessions);
  } else {
    createEmptyTable();
  }

  updateStatistics(summarizeSessions(state.sessions, state.visibleSessions));

  if (!state.importedFileName) {
    setTableNotice('尚未匯入 Excel，請選擇場次表檔案。');
  } else if (!state.visibleSessions.length) {
    setTableNotice('沒有符合條件的場次');
  } else {
    setTableNotice('');
  }
}

// 只在匯入成功後取代既有資料；失敗時保留上一份成功匯入的 state。
async function importSchedule(file) {
  updateFileStatus(`正在讀取：${file.name}`);

  try {
    const { sheetName, movies } = await readExcel(file);
    state.sessions = sortSessionsByStart(movies);
    state.importedFileName = file.name;
    state.lastImportedAt = new Date();
    applyFilters();

    const importedTime = state.lastImportedAt.toLocaleTimeString('zh-TW', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    updateFileStatus(`已讀取 ${file.name}／${sheetName}：${state.sessions.length} 個場次（${importedTime}）`);
  } catch (error) {
    updateFileStatus(`匯入失敗：${error.message}；已保留上一份資料。`);
  }
}

// 初始化事件綁定，讓所有使用者操作先更新 state，再套用篩選與渲染。
function init() {
  document.title = `${APP_NAME} V${VERSION}`;
  bindThemeToggle();
  bindSearch(searchText => {
    state.searchText = searchText;
    applyFilters();
  });
  bindFormatFilter(formatFilter => {
    state.formatFilter = formatFilter;
    applyFilters();
  });
  document.querySelector('#fileInput').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (file) await importSchedule(file);
    event.target.value = '';
  });
  renderFromState();
}

init();