import { FORMATS } from './config.js';
import { normalizeText } from './utils.js';
const LANGUAGE_MAP = { C: 'CHI', E: 'ENG', J: 'JAN' };
// 解析實際場次表的括號前綴，例如「(GC DIG E)MOANA」。
export function parseFilmTitle(value) {
  const rawTitle = normalizeText(value);
  const prefixMatch = rawTitle.match(/^\(([^)]+)\)\s*(.*)$/);
  if (!prefixMatch) return { rawTitle, title: rawTitle, displayTitle: rawTitle, format: '', language: '' };
  const tokens = prefixMatch[1].toUpperCase().split(/\s+/).filter(Boolean);
  const format = FORMATS.find(item => tokens.includes(item)) || '';
  const languageCode = tokens.find(token => LANGUAGE_MAP[token]);
  const language = languageCode ? LANGUAGE_MAP[languageCode] : '';
  const title = normalizeText(prefixMatch[2]);
  return { rawTitle, title, displayTitle: language ? `${language}｜${title}` : title, format, language };
}
// 依場次表的影廳規則，數字廳別一律轉為 C 加數字；GC 廳別維持原樣。
export function parseHall(value) {
  const screen = normalizeText(value).toUpperCase();
  return /^\d+$/.test(screen) ? `C${screen}` : screen;
}
