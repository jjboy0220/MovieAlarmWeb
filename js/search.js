import { getSessionFormats, normalizeText } from './utils.js';

// 將搜尋文字標準化，忽略前後空白、合併多餘空白並統一英文大小寫。
export function normalizeSearchText(value) {
  return normalizeText(value).toLowerCase();
}

// 綁定搜尋輸入，將標準化後的條件交由應用程式 state 管理。
export function bindSearch(onChange) {
  const input = document.querySelector('#searchInput');
  input.addEventListener('input', event => onChange(normalizeSearchText(event.target.value)));
}

// 搜尋片名、顯示片名、影廳、語言、組合顯示格式與全部原始格式；空白條件一律通過。
export function matchesSearch(session, searchText) {
  const query = normalizeSearchText(searchText);
  if (!query) return true;

  return [session.title, session.originalTitle, session.chineseTitle, session.displayTitle, session.hall, session.language, session.formatDisplay, session.format, ...getSessionFormats(session)]
    .some(value => normalizeSearchText(value).includes(query));
}
