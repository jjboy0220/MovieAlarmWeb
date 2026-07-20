import { EXCLUDED_MOVIE_KEYWORDS } from './config.js';
import { parseFilmTitle, parseHall } from './parser.js';
import {
  addDaysToDate,
  createDateTime,
  formatDateKey,
  getTraditionalChineseWeekday,
  normalizeText
} from './utils.js';
import { getOperationalDateForStart } from './scheduleCoverage.js';

const REQUIRED_HEADERS = ['Screen', 'Start', 'Finish', 'Film Title'];
const TIME_HEADERS = new Set(['Start', 'Finish']);
const MONTH_INDEX = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
};

// 檢查解析後的純片名是否包含設定檔中的任一排除關鍵字。
function isExcludedMovieTitle(title) {
  const normalizedTitle = normalizeText(title).toUpperCase();

  return EXCLUDED_MOVIE_KEYWORDS.some(keyword => {
    const normalizedKeyword = normalizeText(keyword).toUpperCase();
    return normalizedKeyword && normalizedTitle.includes(normalizedKeyword);
  });
}

// 尋找同時包含必要欄位的標題列，避免依賴固定欄位或列號。
export function findScheduleHeaders(rows) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const normalizedRow = (rows[rowIndex] || []).map(value => normalizeText(value).toLowerCase());
    const columns = Object.fromEntries(
      REQUIRED_HEADERS.map(header => [header, normalizedRow.findIndex(value => value === header.toLowerCase())])
    );

    if (REQUIRED_HEADERS.every(header => columns[header] >= 0)) {
      return { rowIndex, columns, normalizedRow };
    }
  }

  throw new Error('找不到 Screen、Start、Finish、Film Title 必要欄位。');
}

// 將 Excel 顯示的時間值標準化為 HH:MM。
export function normalizeTime(value) {
  const match = normalizeText(value).match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
}

// 驗證年月日並轉為不受瀏覽器時區影響的 YYYY-MM-DD 日期鍵。
function createDateKey(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return '';
  }

  return formatDateKey(date);
}

// 將 Excel 日期序號轉為日期鍵，支援實際場次表中的日期標記儲存格。
function parseExcelSerialDate(value) {
  const serial = Number(value);

  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return '';

  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return formatDateKey(date);
}

// 解析 Excel 顯示的英文長日期，例如「Thursday, July 9, 2026」。
function parseEnglishLongDate(value) {
  const dateText = normalizeText(value)
    .replace(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday),?\s+/i, '');
  const match = dateText.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})$/i);

  if (!match) return '';

  return createDateKey(Number(match[3]), MONTH_INDEX[match[1].toLowerCase()] + 1, Number(match[2]));
}

// 解析固定年月日或英文月份日期；不接受含有報表區間文字的非日期列。
export function parseScheduleDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return createDateKey(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const dateText = normalizeText(value);
  const numericDate = dateText.match(/^\d+(?:\.\d+)?$/);

  if (numericDate) return parseExcelSerialDate(dateText);

  const isoMatch = dateText.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (isoMatch) return createDateKey(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));

  return parseEnglishLongDate(dateText);
}

// 從非場次資料列找出日期標記，日期欄位置由內容辨識而非固定欄號決定。
function findScheduleDate(row) {
  return row.map(parseScheduleDate).find(Boolean) || '';
}

// 判斷欄位值能否作為資料欄辨識依據。
function isValidFieldValue(header, value) {
  return TIME_HEADERS.has(header) ? Boolean(normalizeTime(value)) : Boolean(normalizeText(value));
}

// 在合併標題的欄位範圍內，以資料完整度找出實際資料欄。
function resolveDataColumns(rows, headerInfo) {
  const headerIndexes = headerInfo.normalizedRow.reduce(
    (indexes, value, index) => value ? [...indexes, index] : indexes,
    []
  );

  return Object.fromEntries(REQUIRED_HEADERS.map(header => {
    const start = headerInfo.columns[header];
    const end = headerIndexes.find(index => index > start) ?? headerInfo.normalizedRow.length;
    let bestColumn = start;
    let bestScore = -1;

    for (let column = start; column < end; column += 1) {
      const score = rows.slice(headerInfo.rowIndex + 1).reduce(
        (count, row) => count + Number(isValidFieldValue(header, row?.[column])),
        0
      );

      if (score > bestScore) {
        bestColumn = column;
        bestScore = score;
      }
    }

    return [header, bestColumn];
  }));
}

// 解析工作表資料列，將日期標記套用到後續同日場次並建立完整日期時間。
export function parseScheduleRows(rows) {
  const headerInfo = findScheduleHeaders(rows);
  const columns = resolveDataColumns(rows, headerInfo);
  const movies = [];
  let currentDate = '';

  for (let index = headerInfo.rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const screen = normalizeText(row[columns.Screen]);
    const start = normalizeTime(row[columns.Start]);
    const finish = normalizeTime(row[columns.Finish]);
    const filmTitle = normalizeText(row[columns['Film Title']]);

    // 日期標記列不含完整場次欄位，先更新目前日期後再繼續讀取下一列。
    if (!screen || !start || !finish || !filmTitle) {
      const scheduleDate = findScheduleDate(row);
      if (scheduleDate) currentDate = scheduleDate;
      continue;
    }

    // 每筆場次都必須跟隨一個可辨識的日期標記，避免跨日排序失去依據。
    if (!currentDate) {
      throw new Error(`第 ${index + 1} 列找不到所屬日期標記。`);
    }

    const film = parseFilmTitle(filmTitle);

    // 排除片名不建立場次物件，避免流入後續表格、統計與排程功能。
    if (isExcludedMovieTitle(film.title)) continue;

    const finishDate = finish < start ? addDaysToDate(currentDate, 1) : currentDate;
    const operationalDate = getOperationalDateForStart(currentDate, start);
    movies.push({
      id: `row-${index + 1}-${currentDate}-${screen}-${start}`,
      sourceRow: index + 1,
      screen,
      hall: parseHall(screen),
      date: currentDate,
      weekday: getTraditionalChineseWeekday(currentDate),
      operationalDate,
      operationalWeekday: getTraditionalChineseWeekday(operationalDate),
      start,
      finish,
      startDateTime: createDateTime(currentDate, start),
      finishDateTime: createDateTime(finishDate, finish),
      language: film.language,
      format: film.format,
      primaryFormat: film.primaryFormat,
      formats: film.formats,
      title: film.title,
      displayTitle: film.displayTitle,
      rawFilmTitle: film.rawTitle
    });
  }

  if (!movies.length) throw new Error('找不到有效場次資料，請確認工作表內容。');
  return movies;
}

// 讀取第一個可解析的工作表，並將結果交由 UI 顯示。
export async function readExcel(file) {
  if (!file) throw new Error('請上傳當日場次表。');
  if (!window.XLSX) throw new Error('Excel 讀取元件尚未載入，請確認網路連線後重試。');

  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  let lastError;

  for (const sheetName of workbook.SheetNames) {
    try {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        defval: '',
        raw: false
      });

      return { sheetName, movies: parseScheduleRows(rows) };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('活頁簿中找不到可解析的場次表。');
}
