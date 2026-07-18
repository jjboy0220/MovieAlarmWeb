const STORAGE_KEY = 'movieScheduleAlarm.schedule.v1';
const MAX_STORED_SESSIONS = 5000;

// 保存解析後的標準化場次與來源摘要，不保存使用者原始 Excel 或 PDF 檔案。
export function saveScheduleSnapshot(snapshot) {
  try {
    const sessions = Array.isArray(snapshot?.sessions) ? snapshot.sessions.slice(0, MAX_STORED_SESSIONS) : [];
    if (!sessions.length) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      sessions,
      importedFileName: String(snapshot.importedFileName || ''),
      importedAt: snapshot.importedAt instanceof Date ? snapshot.importedAt.toISOString() : snapshot.importedAt,
      scheduleSourceType: String(snapshot.scheduleSourceType || '')
    }));
    return true;
  } catch {
    return false;
  }
}

// 安全恢復上次成功場次；內容損壞或日期無效時回傳 null，不影響程式啟動。
export function loadScheduleSnapshot() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (parsed?.version !== 1 || !Array.isArray(parsed.sessions) || !parsed.sessions.length || parsed.sessions.length > MAX_STORED_SESSIONS) return null;
    const sessions = parsed.sessions.map(session => ({
      ...session,
      startDateTime: new Date(session.startDateTime),
      finishDateTime: new Date(session.finishDateTime)
    }));
    if (sessions.some(session => Number.isNaN(session.startDateTime.getTime()) || Number.isNaN(session.finishDateTime.getTime()))) return null;
    const importedAt = new Date(parsed.importedAt);
    return {
      sessions,
      importedFileName: String(parsed.importedFileName || ''),
      importedAt: Number.isNaN(importedAt.getTime()) ? null : importedAt,
      scheduleSourceType: String(parsed.scheduleSourceType || '')
    };
  } catch {
    return null;
  }
}
