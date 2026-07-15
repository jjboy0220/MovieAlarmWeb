// 場次排序與狀態演算將在後續版本啟用。
export function sortSessionsByStart(sessions) { return [...sessions].sort((left,right)=>String(left.start).localeCompare(String(right.start))); }
export function getInitialScheduleState() { return { sessions: [], current: null, next: null }; }
