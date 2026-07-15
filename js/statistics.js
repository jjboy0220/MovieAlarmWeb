// 建立本次提交所需的統計值；時間狀態判定將在後續提交補上。
export function createStatistics() {
  return { total: 0, visible: 0, finished: 0, remaining: 0, playing: 0 };
}

// 總場次與顯示結果分別取自集中 state 的完整清單與可見清單。
export function summarizeSessions(sessions, visibleSessions) {
  return {
    ...createStatistics(),
    total: sessions.length,
    visible: visibleSessions.length
  };
}