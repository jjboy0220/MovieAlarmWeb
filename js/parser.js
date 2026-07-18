import { FORMATS, LANGUAGE_MAP } from './config.js';
import { formatFormatsForDisplay, normalizeText } from './utils.js';

// 解析實際場次表的括號前綴，例如「(IMAX 3D J)CONAN」。
export function parseFilmTitle(value) {
  const rawTitle = normalizeText(value);
  const prefixMatch = rawTitle.match(/^\(([^)]+)\)\s*(.*)$/);

  if (!prefixMatch) {
    return { rawTitle, title: rawTitle, displayTitle: rawTitle, format: '', formatDisplay: '', primaryFormat: '', formats: [], language: '' };
  }

  const tokens = prefixMatch[1].toUpperCase().split(/\s+/).filter(Boolean);
  const detectedFormats = [...new Set(tokens.filter(token => FORMATS.includes(token)))];
  const isKnownConanSpecialError = tokens.includes('CONAN') && tokens.includes('SPECIAL') && !tokens.includes('DIG');
  const formats = isKnownConanSpecialError ? ['DIG', ...detectedFormats] : detectedFormats;
  const formatDisplay = formatFormatsForDisplay(formats);
  const primaryFormat = formats.includes('3D') ? '3D' : formats[0] || '';
  const languageCode = tokens.find(token => LANGUAGE_MAP[token]);
  const language = languageCode ? LANGUAGE_MAP[languageCode] : '';
  const title = normalizeText(prefixMatch[2]);

  return {
    rawTitle,
    title,
    displayTitle: language ? `${language}｜${title}` : title,
    format: formatDisplay,
    formatDisplay,
    primaryFormat,
    formats,
    language
  };
}

// 依影廳顯示規則標準化名稱：數字廳加 C，GC 數字廳移除前導零。
export function parseHall(value) {
  const screen = normalizeText(value).toUpperCase();
  if (/^\d+$/.test(screen)) return `C${screen}`;

  const gcHallMatch = screen.match(/^GC0*(\d+)$/);
  return gcHallMatch ? `GC${Number(gcHallMatch[1])}` : screen;
}
