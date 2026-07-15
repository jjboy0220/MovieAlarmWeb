import { parseFilmTitle, parseHall } from './parser.js';
import { normalizeText } from './utils.js';

const REQUIRED_HEADERS = ['Screen', 'Start', 'Finish', 'Film Title'];
const TIME_HEADERS = new Set(['Start', 'Finish']);

// 在二維列資料中尋找實際標題列，不依賴工作表的固定列號或欄位位置。
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

  throw new Error('找不到 Screen、Start、Finish、Film Title 欄位。');
}

// 將 Excel 顯示時間標準化成 HH:MM 格式。
export function normalizeTime(value) {
  const match = normalizeText(value).match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
}

// 驗證儲存格值是否能作為該欄位的有效場次資料。
function isValidFieldValue(header, value) {
  return TIME_HEADERS.has(header) ? Boolean(normalizeTime(value)) : Boolean(normalizeText(value));
}

// 解析合併標題欄位：在標題至下一標題的區段中尋找有效資料最多的欄位。
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

// 將實際工作表的列資料轉換為可供 UI 使用的標準化電影物件。
export function parseScheduleRows(rows) {
  const headerInfo = findScheduleHeaders(rows);
  const columns = resolveDataColumns(rows, headerInfo);
  const movies = [];

  for (let index = headerInfo.rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const screen = normalizeText(row[columns.Screen]);
    const start = normalizeTime(row[columns.Start]);
    const finish = normalizeTime(row[columns.Finish]);
    const filmTitle = normalizeText(row[columns['Film Title']]);

    // 報表中的空白列、說明列與非完整資料列不會產生電影物件。
    if (!screen || !start || !finish || !filmTitle) continue;

    const film = parseFilmTitle(filmTitle);
    movies.push({
      id: `row-${index + 1}-${screen}-${start}`,
      sourceRow: index + 1,
      screen,
      hall: parseHall(screen),
      start,
      finish,
      language: film.language,
      format: film.format,
      title: film.title,
      displayTitle: film.displayTitle,
      rawFilmTitle: film.rawTitle
    });
  }

  if (!movies.length) throw new Error('找到欄位標題，但沒有可用的場次資料。');
  return movies;
}

// 讀取上傳活頁簿並回傳第一張符合場次欄位契約的工作表與電影物件。
export async function readExcel(file) {
  if (!file) throw new Error('請先選擇 Excel 檔案。');
  if (!window.XLSX) throw new Error('Excel 讀取元件未載入，請確認網路連線後重新整理。');

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

  throw lastError || new Error('活頁簿中沒有符合的場次工作表。');
}