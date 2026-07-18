import { normalizeDcpChineseTitle, normalizeDcpEnglishTitle } from './dcpTitleMap.js';

const DCP_TITLE_MAP_KEY = 'movieAlarm.dcpTitleMap';
const DCP_TITLE_METADATA_KEY = 'movieAlarm.dcpTitleMetadata';

// 從 localStorage 安全恢復清理後的必要對照；損壞資料直接忽略並回退英文片名。
export function loadDcpTitleData() {
  try {
    const entries = JSON.parse(globalThis.localStorage?.getItem(DCP_TITLE_MAP_KEY) || '[]');
    const metadata = JSON.parse(globalThis.localStorage?.getItem(DCP_TITLE_METADATA_KEY) || '{}');
    if (!Array.isArray(entries)) throw new Error('DCP 對照格式錯誤');
    const titleMap = new Map(entries.map(([english, chinese]) => [
      normalizeDcpEnglishTitle(english), normalizeDcpChineseTitle(chinese)
    ]).filter(([english, chinese]) => english && chinese));
    return { titleMap, metadata: metadata && typeof metadata === 'object' ? metadata : {} };
  } catch {
    return { titleMap: new Map(), metadata: {} };
  }
}

// 只保存清理後的英文／中文對照與匯入統計，不保存原始 XLSM 或完整列資料。
export function saveDcpTitleData(titleMap, metadata) {
  try {
    globalThis.localStorage?.setItem(DCP_TITLE_MAP_KEY, JSON.stringify([...titleMap.entries()]));
    globalThis.localStorage?.setItem(DCP_TITLE_METADATA_KEY, JSON.stringify(metadata));
    return { success: true, message: '' };
  } catch {
    return { success: false, message: 'DCP 對照無法保存；可能是本機儲存空間不足。' };
  }
}

// 清除本機 DCP 對照與中繼資料，不碰觸任何已匯入場次。
export function clearDcpTitleData() {
  try {
    globalThis.localStorage?.removeItem(DCP_TITLE_MAP_KEY);
    globalThis.localStorage?.removeItem(DCP_TITLE_METADATA_KEY);
    return { success: true, message: '' };
  } catch {
    return { success: false, message: 'DCP 對照無法從本機清除。' };
  }
}
