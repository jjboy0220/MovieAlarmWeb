// 綁定規格選單，統一以大寫格式值交由應用程式 state 管理。
export function bindFormatFilter(onChange) {
  const select = document.querySelector('#formatFilter');
  select.addEventListener('change', event => onChange(String(event.target.value).trim().toUpperCase()));
}

// ALL 代表不限制規格；其餘值與場次格式進行不分大小寫比較。
export function matchesFormat(session, formatFilter) {
  const selectedFormat = String(formatFilter ?? 'ALL').trim().toUpperCase();
  return selectedFormat === 'ALL' || String(session.format ?? '').toUpperCase() === selectedFormat;
}