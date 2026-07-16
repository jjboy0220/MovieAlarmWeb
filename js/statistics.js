// 建立場次統計的安全預設值，尚未匯入資料時維持全部為零。
export function createStatistics() {
  return { total: 0, visible: 0, finished: 0, remaining: 0, playing: 0 };
}

// 依集中 state 的完整場次計算全域時間統計，只有顯示結果數量受搜尋與篩選影響。
export function summarizeSessions(sessions, visibleSessions) {
  const allSessions = Array.isArray(sessions) ? sessions : [];
  const displayedSessions = Array.isArray(visibleSessions) ? visibleSessions : [];
  const statusCounts = allSessions.reduce((counts, session) => ({
    ...counts,
    [session.status]: (counts[session.status] || 0) + 1
  }), {});

  return {
    ...createStatistics(),
    total: allSessions.length,
    visible: displayedSessions.length,
    finished: statusCounts.finished || 0,
    remaining: statusCounts.waiting || 0,
    playing: statusCounts.playing || 0
  };
}
