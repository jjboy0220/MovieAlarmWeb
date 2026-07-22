import { escapeHtml, formatSessionFormats, getSessionFormats } from './utils.js';

const FORMAT_BADGE_CLASSES = { DIG: 'dig', TITAN: 'titan', IMAX: 'imax', ATMOS: 'atmos', CTRL: 'ctrl', '4DX': 'fourdx', '3D': 'three-d', LIVE: 'live', SPECIAL: 'special' };
const LANGUAGE_BADGE_CLASSES = { CHI: 'chi', ENG: 'eng', JAN: 'jan' };

// 將標準化格式名稱對應為白名單 CSS 類別，避免外部文字成為類別名稱。
function getFormatBadgeClass(format) {
  return FORMAT_BADGE_CLASSES[format] || '';
}

// 將標準化語言名稱對應為白名單 CSS 類別，避免外部文字成為類別名稱。
function getLanguageBadgeClass(language) {
  return LANGUAGE_BADGE_CLASSES[language] || '';
}

// 依單一格式產生已轉義的識別色 Badge。
function renderSingleFormatBadge(format) {
  return `<span class="format-badge ${getFormatBadgeClass(format)}">${escapeHtml(format)}</span>`;
}

// 產生 3D 與 DIG 合併後的單一漸層識別色 Badge。
function renderThreeDDigBadge() {
  return '<span class="format-badge three-d-dig">3D / DIG</span>';
}

// 將已確認的 DIG 與 SPECIAL 組合顯示為單一營運規格 Badge。
function renderDigSpecialBadge() {
  return '<span class="format-badge dig-special">DIG SPECIAL</span>';
}

// 將場次格式渲染為 Badge；3D 與 DIG 同時存在時固定合併為單一 Badge。
export function renderFormatBadges(session) {
  const formats = getSessionFormats(session);
  if (!formats.length) return '';

  const hasThreeDAndDig = formats.includes('3D') && formats.includes('DIG');
  const hasDigSpecial = formats.includes('DIG') && formats.includes('SPECIAL');
  const individualFormats = formats.filter(format => format !== '3D' && format !== 'DIG' && format !== 'SPECIAL');
  const badges = hasThreeDAndDig
    ? [...individualFormats.map(renderSingleFormatBadge), ...(hasDigSpecial ? [renderSingleFormatBadge('SPECIAL')] : []), renderThreeDDigBadge()]
    : hasDigSpecial
      ? [...individualFormats.map(renderSingleFormatBadge), renderDigSpecialBadge()]
      : formats.map(renderSingleFormatBadge);

  return `<span class="format-badge-group" aria-label="${escapeHtml(formatSessionFormats(session))}">${badges.join('')}</span>`;
}

// 將已標準化語言轉為對應亮色 Badge；未標示語言時不建立空白 Badge。
export function renderLanguageBadge(language) {
  if (!language) return '';
  return `<span class="language-badge ${getLanguageBadgeClass(language)}">${escapeHtml(language)}</span>`;
}

// 將已標準化影廳轉為中性灰 Badge；空值維持空白。
export function renderHallBadge(hall) {
  return hall ? `<span class="hall-badge">${escapeHtml(hall)}</span>` : '';
}
