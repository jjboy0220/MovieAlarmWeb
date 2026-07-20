const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const WEEKDAY_ABBREVIATIONS = { 星期日: '日', 星期一: '一', 星期二: '二', 星期三: '三', 星期四: '四', 星期五: '五', 星期六: '六' };

// 將外部欄位值轉為可比較且不含多餘空白的文字。
export function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

// 將文字轉義後才能安全寫入 innerHTML。
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

// 將 UTC 日期物件轉為固定的 YYYY-MM-DD 日期鍵。
export function formatDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 依日期鍵取得繁體中文星期名稱。
export function getTraditionalChineseWeekday(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return WEEKDAY_LABELS[date.getUTCDay()] || '';
}

// 對日期鍵加上指定天數，供跨午夜場次計算結束日期。
export function addDaysToDate(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKey(date);
}

// 組合日期與 HH:MM 時間，保留不含時區的 ISO 風格字串供場次排序使用。
export function createDateTime(dateKey, time) {
  return `${dateKey}T${time}:00`;
}

// 將場次使用的本地日期時間文字轉為 Date；格式無效時回傳 null，避免倒數流程中斷。
export function parseLocalDateTime(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const normalizedValue = normalizeText(value);
  const matchedParts = normalizedValue.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (matchedParts) {
    const [, year, month, day, hour, minute, second = '0'] = matchedParts;
    const parsedDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const parsedDate = new Date(normalizedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

// 將日期鍵與星期名稱格式化為 Next Movie 與列表共用的 YYYY/MM/DD（週）標題。
export function formatCompactChineseDate(dateKey, weekday) {
  const [rawYear, rawMonth, rawDay] = normalizeText(dateKey).split('-');
  const year = String(rawYear || '').padStart(4, '0');
  const month = String(rawMonth || '').padStart(2, '0');
  const day = String(rawDay || '').padStart(2, '0');
  return `${year}/${month}/${day} (${WEEKDAY_ABBREVIATIONS[weekday] || ''})`;
}

// 取得場次的全部格式，並相容舊有僅有 format 或組合 format 顯示值的資料。
export function getSessionFormats(session) {
  const formats = Array.isArray(session?.formats) ? session.formats.filter(Boolean) : [];
  if (formats.length) return formats;

  return normalizeText(session?.format).split('/').map(normalizeText).filter(Boolean);
}

// 將格式陣列轉為穩定顯示文字；已知組合使用營運端約定的固定文字。
export function formatFormatsForDisplay(formats) {
  const normalizedFormats = [...new Set((Array.isArray(formats) ? formats : []).map(normalizeText).filter(Boolean))];
  const hasThreeDAndDig = normalizedFormats.includes('3D') && normalizedFormats.includes('DIG');
  const hasDigSpecial = normalizedFormats.includes('DIG') && normalizedFormats.includes('SPECIAL');
  const remainingFormats = normalizedFormats.filter(format => format !== '3D' && format !== 'DIG' && format !== 'SPECIAL');
  const displayFormats = hasThreeDAndDig
    ? [...remainingFormats, ...(hasDigSpecial ? ['SPECIAL'] : []), '3D / DIG']
    : hasDigSpecial ? [...remainingFormats, 'DIG SPECIAL'] : normalizedFormats;
  return displayFormats.join(' / ');
}

// 將場次格式組合成適合畫面顯示的文字，優先使用 Parser 提供的顯示值。
export function formatSessionFormats(session) {
  return normalizeText(session?.formatDisplay) || formatFormatsForDisplay(getSessionFormats(session));
}
