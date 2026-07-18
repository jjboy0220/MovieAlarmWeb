import { EXCLUDED_MOVIE_KEYWORDS } from './config.js';
import { parseFilmTitle, parseHall } from './parser.js';
import { addDaysToDate, createDateTime, formatDateKey, getTraditionalChineseWeekday, normalizeText } from './utils.js';
import { getOperationalDateForStart } from './scheduleCoverage.js';

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 50;
const ROW_Y_TOLERANCE = 1.5;
const REQUIRED_HEADERS = ['Screen', 'Start', 'Finish', 'Status', 'Film Title'];
const VALID_SOURCE_STATUSES = new Set(['OPEN', 'PLANNED', 'CLOSED']);
const PDF_WORKER_URL = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

// 延遲載入本機 PDF.js 並指定同版本 Worker，避免瀏覽器或 Electron 連線外部 CDN。
async function loadPdfJs() {
  const pdfjs = await import('../vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  return pdfjs;
}

// 判斷解析後的純片名是否為既有排除片名，維持 Excel 與 PDF 相同規則。
function isExcludedMovieTitle(title) {
  const normalizedTitle = normalizeText(title).toUpperCase();
  return EXCLUDED_MOVIE_KEYWORDS.some(keyword => normalizedTitle.includes(normalizeText(keyword).toUpperCase()));
}

// 將 PDF.js 文字項目依 y 座標容差合併成列，再依 x 座標由左至右排序。
export function groupTextItemsIntoRows(items, pageNumber = 1) {
  const positionedItems = (Array.isArray(items) ? items : [])
    .filter(item => normalizeText(item?.str) && Array.isArray(item?.transform))
    .map(item => ({
      str: normalizeText(item.str),
      x: Number(item.transform[4]),
      y: Number(item.transform[5]),
      width: Number(item.width) || 0
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];

  for (const item of positionedItems) {
    const row = rows.find(candidate => Math.abs(candidate.y - item.y) <= ROW_Y_TOLERANCE);
    if (row) {
      row.items.push(item);
      row.y = row.items.reduce((sum, current) => sum + current.y, 0) / row.items.length;
    } else {
      rows.push({ pageNumber, y: item.y, items: [item] });
    }
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row, rowIndex) => ({ ...row, rowNumber: rowIndex + 1, items: row.items.sort((a, b) => a.x - b.x) }));
}

// 解析 PDF 英文長日期標題並回傳固定日期鍵，不使用檔名或報表區間推測日期。
export function parsePdfDateHeading(text) {
  const match = normalizeText(text).match(/^(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/i);
  if (!match) return '';
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const date = new Date(Date.UTC(Number(match[3]), months.indexOf(match[1].toLowerCase()), Number(match[2])));
  if (date.getUTCFullYear() !== Number(match[3]) || date.getUTCDate() !== Number(match[2])) return '';
  return formatDateKey(date);
}

// 從檔名中的 MMDD-MMDD 週期取得月份與日期，只接受真實存在的月日組合。
export function parsePdfFilenameDateRange(fileName) {
  const match = normalizeText(fileName).match(/(?:^|\D)(\d{2})(\d{2})-(\d{2})(\d{2})(?:\D|$)/);
  if (!match) return null;
  const [, startMonth, startDay, endMonth, endDay] = match.map(Number);
  const isValidMonthDay = (month, day) => {
    const date = new Date(Date.UTC(2000, month - 1, day));
    return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  };
  if (!isValidMonthDay(startMonth, startDay) || !isValidMonthDay(endMonth, endDay)) return null;
  return { startMonth, startDay, endMonth, endDay };
}

// 使用檔名週期與殘存的日、年份修復損壞月份；兩者無法唯一對應時拒絕猜測。
export function repairPdfDateHeading(text, fileName) {
  const remainingDate = normalizeText(text).match(/(\d{1,2}),\s*(\d{4})(?:\s|$)/);
  const range = parsePdfFilenameDateRange(fileName);
  if (!remainingDate || !range) return '';
  const targetDay = Number(remainingDate[1]);
  const targetYear = Number(remainingDate[2]);
  const matches = new Set();

  for (const possibleStartYear of [targetYear - 1, targetYear, targetYear + 1]) {
    const startDate = new Date(Date.UTC(possibleStartYear, range.startMonth - 1, range.startDay));
    const endYear = range.endMonth < range.startMonth ? possibleStartYear + 1 : possibleStartYear;
    const endDate = new Date(Date.UTC(endYear, range.endMonth - 1, range.endDay));
    const maximumDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
    if (maximumDays < 0 || maximumDays > 31) continue;
    for (let dayOffset = 0; dayOffset <= maximumDays; dayOffset += 1) {
      const candidate = new Date(startDate.getTime() + dayOffset * 86400000);
      if (candidate.getUTCFullYear() === targetYear && candidate.getUTCDate() === targetDay) {
        matches.add(formatDateKey(candidate));
      }
    }
  }

  return matches.size === 1 ? [...matches][0] : '';
}

// 從實際表頭文字的 x 位置建立動態欄界，不依賴單一 PDF 的固定像素值。
function detectColumnLayout(row) {
  const anchors = {};
  for (const header of REQUIRED_HEADERS) {
    const item = row.items.find(candidate => candidate.str.toLowerCase() === header.toLowerCase());
    if (!item) return null;
    anchors[header] = item.x;
  }
  const ordered = REQUIRED_HEADERS.map(header => anchors[header]);
  if (ordered.some((value, index) => index && value <= ordered[index - 1])) return null;

  return {
    anchors,
    screenStartBoundary: (anchors.Screen + anchors.Start) / 2,
    startFinishBoundary: (anchors.Start + anchors.Finish) / 2,
    finishStatusBoundary: (anchors.Finish + anchors.Status) / 2,
    statusTitleBoundary: anchors.Status + ((anchors['Film Title'] - anchors.Status) * 0.3)
  };
}

// 依動態欄界將同列文字項目還原為五個欄位。
function splitRowIntoColumns(row, layout) {
  const columns = { screen: [], start: [], finish: [], status: [], filmTitle: [] };
  for (const item of row.items) {
    if (item.x < layout.screenStartBoundary) columns.screen.push(item.str);
    else if (item.x < layout.startFinishBoundary) columns.start.push(item.str);
    else if (item.x < layout.finishStatusBoundary) columns.finish.push(item.str);
    else if (item.x < layout.statusTitleBoundary) columns.status.push(item.str);
    else columns.filmTitle.push(item.str);
  }
  return Object.fromEntries(Object.entries(columns).map(([key, values]) => [key, normalizeText(values.join(' '))]));
}

// 驗證並標準化 PDF 場次時間為 HH:mm。
function normalizePdfTime(value) {
  const match = normalizeText(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

// 判斷 PDF 報表欄寬可能已裁切片名，僅供 Debug 與保守前綴匹配使用。
function isPossiblyTruncatedTitle(title) {
  return /\b(?:AND|O)$/i.test(normalizeText(title));
}

// 逐頁解析座標列，沿用上一頁日期與欄設定，建立與 Excel Reader 相容的 sessions。
export function parsePdfScheduleRows(pages, { sourceFileName = '' } = {}) {
  const movies = [];
  const parseErrors = [];
  let currentDate = '';
  let columnLayout = null;
  let detectedDateSections = 0;
  let skippedRowCount = 0;
  let invalidRowCount = 0;
  let truncatedTitleCount = 0;
  let repairedDateSectionCount = 0;

  for (const page of pages) {
    for (const row of page.rows) {
      const rowText = normalizeText(row.items.map(item => item.str).join(' '));
      const detectedLayout = detectColumnLayout(row);
      if (detectedLayout) {
        columnLayout = detectedLayout;
        skippedRowCount += 1;
        continue;
      }

      const dateHeadingText = rowText.replace(/\s+Showing Sessions with Status:.*$/i, '');
      const parsedDateKey = parsePdfDateHeading(dateHeadingText);
      const repairedDateKey = parsedDateKey ? '' : repairPdfDateHeading(dateHeadingText, sourceFileName);
      const dateKey = parsedDateKey || repairedDateKey;
      if (dateKey) {
        currentDate = dateKey;
        detectedDateSections += 1;
        if (repairedDateKey) repairedDateSectionCount += 1;
        skippedRowCount += 1;
        continue;
      }

      if (!columnLayout) {
        skippedRowCount += 1;
        continue;
      }

      const columns = splitRowIntoColumns(row, columnLayout);
      const start = normalizePdfTime(columns.start);
      const finish = normalizePdfTime(columns.finish);
      const sourceStatus = columns.status.toUpperCase();
      const validScreen = /^(?:\d+|GC0*\d+)$/i.test(columns.screen);
      const looksLikeSession = validScreen || Boolean(start || finish || VALID_SOURCE_STATUSES.has(sourceStatus));

      if (!validScreen || !start || !finish || !VALID_SOURCE_STATUSES.has(sourceStatus) || !columns.filmTitle || !currentDate) {
        if (looksLikeSession) {
          invalidRowCount += 1;
          parseErrors.push(`第 ${page.pageNumber} 頁第 ${row.rowNumber} 列欄位不完整`);
        } else {
          skippedRowCount += 1;
        }
        continue;
      }

      const film = parseFilmTitle(columns.filmTitle);
      if (!film.title || isExcludedMovieTitle(film.title)) {
        skippedRowCount += 1;
        continue;
      }
      const possiblyTruncated = isPossiblyTruncatedTitle(film.title);
      if (possiblyTruncated) truncatedTitleCount += 1;
      const finishDate = finish <= start ? addDaysToDate(currentDate, 1) : currentDate;
      const operationalDate = getOperationalDateForStart(currentDate, start);
      movies.push({
        id: `pdf-${currentDate}-${start}-${parseHall(columns.screen)}-${page.pageNumber}-${row.rowNumber}`,
        sourceType: 'pdf',
        sourcePage: page.pageNumber,
        sourceRow: row.rowNumber,
        sourceStatus: columns.status,
        screen: columns.screen,
        hall: parseHall(columns.screen),
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
        formatDisplay: film.formatDisplay,
        primaryFormat: film.primaryFormat,
        formats: film.formats,
        title: film.title,
        originalTitle: film.title,
        displayTitle: film.displayTitle,
        rawFilmTitle: film.rawTitle,
        titlePossiblyTruncated: possiblyTruncated
      });
    }
  }

  if (!columnLayout) throw new Error('找不到 Screen、Start、Finish、Status、Film Title 欄位表頭。');
  if (!detectedDateSections) throw new Error('找不到英文日期區段，無法判定場次日期。');
  if (!movies.length) throw new Error('找不到有效 PDF 場次資料，請確認 PDF 具有可讀取的文字內容。');

  return { movies, metadata: { detectedDateSections, repairedDateSectionCount, parsedRowCount: movies.length, skippedRowCount, invalidRowCount, truncatedTitleCount, parseErrors } };
}

// 使用本機 PDF.js 擷取每頁文字座標，不保存原始 PDF 或傳送網路。
export async function extractPdfPages(arrayBuffer) {
  const pdfjs = await loadPdfJs();
  let document;
  try {
    document = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  } catch (error) {
    if (error?.name === 'PasswordException') throw new Error('此 PDF 受到密碼保護，目前無法匯入。');
    throw new Error(`PDF.js 無法開啟檔案：${error?.message || '未知錯誤'}`);
  }
  if (document.numPages > MAX_PDF_PAGES) throw new Error(`PDF 超過 ${MAX_PDF_PAGES} 頁限制。`);

  const pages = [];
  let textItemCount = 0;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    textItemCount += textContent.items.length;
    pages.push({ pageNumber, rows: groupTextItemsIntoRows(textContent.items, pageNumber) });
  }
  if (!textItemCount) throw new Error('此 PDF 沒有可讀取的文字內容，目前不支援掃描圖片型 PDF。');
  return { pages, pageCount: document.numPages, textItemCount };
}

// 驗證使用者 PDF 後讀取文字層並回傳標準化場次與偵錯 metadata。
export async function readPdfSchedule(file) {
  if (!file) throw new Error('請選擇 PDF 場次表。');
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') throw new Error('檔案格式不是 PDF。');
  if (file.size > MAX_PDF_BYTES) throw new Error('PDF 超過 20 MB 大小限制。');

  const extracted = await extractPdfPages(await file.arrayBuffer());
  const parsed = parsePdfScheduleRows(extracted.pages, { sourceFileName: file.name });
  return {
    movies: parsed.movies,
    metadata: {
      pageCount: extracted.pageCount,
      textItemCount: extracted.textItemCount,
      ...parsed.metadata
    }
  };
}
