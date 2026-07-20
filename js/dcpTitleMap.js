import { normalizeText } from './utils.js';

// 判斷片尾括號是否為預告版本、語言、日期、秒數或銀幕比例附註。
function isTrailerSuffix(content) {
  const value = normalizeText(content).toUpperCase();
  if (!value) return false;
  return /(?:^|\s)(?:A|B|D|E|F\d*|G|O|CHI|ENG|JAN)(?:\s|$)/.test(value)
    || /(?:^|\s)\d{4}(?:\s|$)/.test(value)
    || /(?:^|\s)\d+S(?:\s|$)/.test(value)
    || /F:\d{4}\s*\/\s*S:\d{4}/.test(value);
}

// 只移除片名最後一組符合預告規則的括號與尾端 SCOPE／FLAT 附註，保留中間正式括號。
function removeTrailerSuffix(value) {
  const withoutRatioNote = String(value ?? '').replace(/\s*僅有\s*(?:SCOPE|FLAT)\s*$/iu, '').trim();
  const match = withoutRatioNote.match(/^(.*?)[\s]*[（(]([^()（）]+)[）)]\s*$/u);
  if (!match || !isTrailerSuffix(match[2])) return withoutRatioNote;
  return match[1].trim();
}

// 移除 DCP 英文片名尾端的電影分級或待定標記，避免 PDF 報表未顯示分級而無法匹配。
function removeClassificationSuffix(value) {
  return String(value ?? '').replace(/\s*[（(](?:P|PG\d+|R|TBC)[）)]\s*$/iu, '').trim();
}

// 將 DCP 英文片名統一為可比較鍵值，並移除最後的預告版本尾碼。
export function normalizeDcpEnglishTitle(title) {
  return removeTrailerSuffix(removeClassificationSuffix(String(title ?? '').normalize('NFKC')))
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\s*:\s*/g, ': ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// 將放映前綴中的 GC／SPECIAL 修飾移除，讓特殊廳或特別場可匹配同片的標準 DCP 紀錄。
function normalizeProjectionPrefix(title) {
  const normalizedTitle = normalizeDcpEnglishTitle(title);
  return normalizedTitle.replace(/^\(([^)]+)\)/, (match, content) => {
    const tokens = content.split(/\s+/).filter(token => token && !['GC', 'SPECIAL'].includes(token));
    return tokens.length ? `(${tokens.join(' ')})` : '';
  });
}

// 移除放映格式前綴後取得純片名鍵值，只用於候選中文名唯一時的安全回退匹配。
function getBaseEnglishTitle(title) {
  return normalizeDcpEnglishTitle(title).replace(/^\([^)]+\)\s*/, '').trim();
}

// 依原始放映片名、純片名與唯一中文候選依序尋找 DCP 對照，避免格式不同時誤套片名。
function findDcpTitleMatch(session, titleMap) {
  const rawFilmTitle = normalizeText(session?.rawFilmTitle);
  const originalTitle = normalizeText(session?.originalTitle || session?.title);
  const exactKeys = [
    normalizeDcpEnglishTitle(rawFilmTitle),
    normalizeProjectionPrefix(rawFilmTitle),
    normalizeDcpEnglishTitle(originalTitle)
  ].filter(Boolean);

  for (const key of exactKeys) {
    const chineseTitle = titleMap.get(key);
    if (chineseTitle) return { chineseTitle, status: 'matched' };
  }

  const baseTitle = getBaseEnglishTitle(originalTitle);
  const candidates = [...titleMap.entries()].filter(([englishTitle]) => {
    const candidateBase = getBaseEnglishTitle(englishTitle);
    return candidateBase === baseTitle || (baseTitle.length >= 15 && candidateBase.startsWith(baseTitle));
  });
  const uniqueChineseTitles = [...new Set(candidates.map(([, chineseTitle]) => chineseTitle))];
  if (uniqueChineseTitles.length === 1) {
    const usedPrefixMatch = candidates.some(([englishTitle]) => getBaseEnglishTitle(englishTitle) !== baseTitle);
    return { chineseTitle: uniqueChineseTitles[0], status: usedPrefixMatch ? 'matched-prefix' : 'matched-base' };
  }
  if (candidates.length > 1) return { chineseTitle: '', status: 'truncated-conflict' };
  return { chineseTitle: '', status: session?.titlePossiblyTruncated ? 'truncated-unmatched' : 'unmatched' };
}

// 清理 DCP 中文片名的片尾預告版本資訊，保留正式中文標點、副標題與中間括號。
export function normalizeDcpChineseTitle(title) {
  return removeTrailerSuffix(String(title ?? '').normalize('NFC'))
    .replace(/\s+/g, ' ')
    .trim();
}

// 動態尋找同一列中的中文片名與英文片名欄位。
export function findDcpTitleHeaders(rows) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    const normalized = row.map(normalizeText);
    const chineseColumn = normalized.findIndex(value => value === '中文片名');
    const englishColumn = normalized.findIndex(value => value === '英文片名');
    if (chineseColumn >= 0 && englishColumn >= 0) return { rowIndex, chineseColumn, englishColumn };
  }
  throw new Error('找不到「中文片名」與「英文片名」欄位，請確認是否選擇正確的現有 DCP 檔案。');
}

// 由 DCP 列建立去重對照；衝突時採最高出現次數，平手保留最先出現的中文片名。
export function createDcpTitleMap(rows) {
  const header = findDcpTitleHeaders(rows);
  const candidates = new Map();
  let validRows = 0;
  let skippedRows = 0;

  for (const row of rows.slice(header.rowIndex + 1)) {
    const englishTitle = normalizeDcpEnglishTitle(row?.[header.englishColumn]);
    const chineseTitle = normalizeDcpChineseTitle(row?.[header.chineseColumn]);
    if (!englishTitle || !chineseTitle) {
      skippedRows += 1;
      continue;
    }
    validRows += 1;
    if (!candidates.has(englishTitle)) candidates.set(englishTitle, new Map());
    const choices = candidates.get(englishTitle);
    const existing = choices.get(chineseTitle);
    choices.set(chineseTitle, { count: (existing?.count || 0) + 1, firstIndex: existing?.firstIndex ?? validRows });
  }

  const titleMap = new Map();
  const conflictTitles = [];
  for (const [englishTitle, choices] of candidates) {
    const ranked = [...choices.entries()].sort((a, b) => b[1].count - a[1].count || a[1].firstIndex - b[1].firstIndex);
    titleMap.set(englishTitle, ranked[0][0]);
    if (ranked.length > 1) conflictTitles.push(englishTitle);
  }

  return {
    titleMap,
    conflictTitles,
    stats: {
      sourceRows: Math.max(0, rows.length - header.rowIndex - 1),
      validRows,
      uniqueTitles: titleMap.size,
      duplicateRows: Math.max(0, validRows - titleMap.size),
      conflicts: conflictTitles.length,
      skippedRows
    },
    header
  };
}

// 只更新片名衍生欄位，保留原始英文、場次 id、時間與所有排程資料。
export function applyDcpTitlesToSessions(sessions, titleMap) {
  const safeMap = titleMap instanceof Map ? titleMap : new Map();
  return (Array.isArray(sessions) ? sessions : []).map(session => {
    const originalTitle = normalizeText(session?.originalTitle || session?.title);
    const match = findDcpTitleMatch(session, safeMap);
    const chineseTitle = match.chineseTitle;
    return {
      ...session,
      originalTitle,
      chineseTitle,
      displayTitle: chineseTitle || originalTitle,
      titleMatchStatus: match.status
    };
  });
}
