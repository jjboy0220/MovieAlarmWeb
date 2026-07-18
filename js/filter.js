import { FORMATS } from './config.js';
import { formatCompactChineseDate, getSessionFormats, getTraditionalChineseWeekday, normalizeText } from './utils.js';

const FILTER_DEFINITIONS = [
  { elementId: 'hallFilter', stateKey: 'hallFilter', allLabel: '所有影廳', field: 'hall' },
  { elementId: 'languageFilter', stateKey: 'languageFilter', allLabel: '所有語言', field: 'language' },
  { elementId: 'formatFilter', stateKey: 'formatFilter', allLabel: '所有規格', field: 'format' },
  { elementId: 'statusFilter', stateKey: 'statusFilter', staticOptions: true }
];

const statusFilterRules = {
  ACTIVE: new Set(['waiting', 'playing']),
  ALL: new Set(['waiting', 'playing', 'finished', 'invalid']),
  WAITING: new Set(['waiting']),
  PLAYING: new Set(['playing']),
  FINISHED: new Set(['finished'])
};

// 確保營運日期選單只建立一次，並放在既有影廳篩選器之前。
function ensureDateFilter() {
  const existing = document.querySelector('#dateFilter');
  if (existing) return existing;
  const select = document.createElement('select');
  select.id = 'dateFilter';
  select.setAttribute('aria-label', '營運日期篩選');
  document.querySelector('#hallFilter').before(select);
  return select;
}

// 依完整匯入資料建立營運日期選項，保留自動跟隨系統營運日的預設模式。
export function populateDateFilterOptions(sessions, selectedDate = 'AUTO') {
  const select = ensureDateFilter();
  const dateKeys = [...new Set((Array.isArray(sessions) ? sessions : [])
    .map(session => normalizeText(session?.operationalDate || session?.date))
    .filter(Boolean))].sort();
  const options = [new Option('自動（目前營運日）', 'AUTO')];
  dateKeys.forEach(dateKey => options.push(new Option(
    formatCompactChineseDate(dateKey, getTraditionalChineseWeekday(dateKey)),
    dateKey
  )));
  select.replaceChildren(...options);
  select.value = dateKeys.includes(selectedDate) ? selectedDate : 'AUTO';
  return select.value;
}

// 將篩選值統一為去除空白的大寫文字，確保比較行為一致。
function normalizeFilterValue(value) {
  return String(value ?? '').trim().toUpperCase();
}

// 取得場次資料中的不重複篩選值，並以自然排序提供選單使用。
function getFilterValues(sessions, field) {
  return [...new Set(sessions.map(session => normalizeFilterValue(session[field])).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
}

// 取得單筆場次可用於指定篩選器的值，格式可同時包含多個規格。
function getSessionFilterValues(session, field) {
  return field === 'format' ? getSessionFormats(session) : [session[field]];
}

// 重新建立單一篩選選單，保留仍可用的既有選擇，否則回到 ALL。
function populateSelect(definition, values) {
  const select = document.querySelector(`#${definition.elementId}`);
  const selectedValue = normalizeFilterValue(select.value);
  const options = [new Option(definition.allLabel, 'ALL')];
  values.forEach(value => options.push(new Option(value, value)));
  select.replaceChildren(...options);
  select.value = values.includes(selectedValue) ? selectedValue : 'ALL';
  return select.value;
}

// 匯入成功後，依場次資料更新影廳、語言與規格選項，並回傳目前有效的篩選狀態。
export function populateFilterOptions(sessions) {
  return Object.fromEntries(FILTER_DEFINITIONS.filter(definition => !definition.staticOptions).map(definition => {
    const values = definition.field === 'format' ? FORMATS : getFilterValues(sessions, definition.field);
    return [definition.stateKey, populateSelect(definition, values)];
  }));
}

// 使用既有 session.status 套用播放狀態篩選，不在篩選模組重複計算任何時間規則。
function matchesStatusFilter(session, selectedValue) {
  const allowedStatuses = statusFilterRules[selectedValue] || statusFilterRules.ACTIVE;
  return allowedStatuses.has(String(session.status || '').toLowerCase());
}

// 綁定全部篩選器；實際 state 更新由 app.js 集中負責。
export function bindFilters(onChange) {
  ensureDateFilter().addEventListener('change', event => {
    onChange('dateFilter', normalizeText(event.target.value) || 'AUTO');
  });
  FILTER_DEFINITIONS.forEach(definition => {
    const select = document.querySelector(`#${definition.elementId}`);
    select.addEventListener('change', event => {
      onChange(definition.stateKey, normalizeFilterValue(event.target.value) || 'ALL');
    });
  });
}

// 同時檢查影廳、語言、規格與播放狀態，所有條件以 AND 關係共同套用。
export function matchesFilters(session, filters) {
  return FILTER_DEFINITIONS.every(definition => {
    const selectedValue = normalizeFilterValue(filters[definition.stateKey]) || 'ALL';
    if (definition.stateKey === 'statusFilter') {
      return matchesStatusFilter(session, selectedValue);
    }
    const sessionValues = getSessionFilterValues(session, definition.field)
      .map(normalizeFilterValue);
    return selectedValue === 'ALL' || sessionValues.includes(selectedValue);
  });
}
