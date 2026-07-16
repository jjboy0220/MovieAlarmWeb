import { parseLocalDateTime } from './utils.js';

// 為每個已解析場次建立預設 waiting 狀態，供首次渲染與後續時間判定使用。
export function createWaitingSessions(sessions) {
  return (Array.isArray(sessions) ? sessions : []).map(session => ({ ...session, status: 'waiting' }));
}

// 依完整開始日期時間回傳新的排序陣列，無效時間一律排在最後且不修改原始資料。
export function sortSessionsByStart(sessions) {
  return (Array.isArray(sessions) ? sessions : [])
    .map((session, index) => ({
      session,
      index,
      startDate: parseLocalDateTime(session.startDateTime)
    }))
    .sort((left, right) => {
      const leftTime = left.startDate ? left.startDate.getTime() : Number.POSITIVE_INFINITY;
      const rightTime = right.startDate ? right.startDate.getTime() : Number.POSITIVE_INFINITY;
      return leftTime - rightTime || left.index - right.index;
    })
    .map(({ session }) => session);
}

// 取得可安全比較的目前時間；外部傳入無效值時改用當前實際時間。
function getValidNow(now) {
  return parseLocalDateTime(now) || new Date();
}

// 將群組鍵值中的數字補零為固定兩位數。
function padGroupKeyNumber(value) {
  return String(value).padStart(2, '0');
}

// 將日期物件轉為穩定的 YYYY-MM-DDTHH:mm:ss 群組鍵值。
function formatSessionGroupKey(date) {
  return `${date.getFullYear()}-${padGroupKeyNumber(date.getMonth() + 1)}-${padGroupKeyNumber(date.getDate())}T${padGroupKeyNumber(date.getHours())}:${padGroupKeyNumber(date.getMinutes())}:${padGroupKeyNumber(date.getSeconds())}`;
}

// 由完整開始日期時間建立穩定的場次群組鍵值；無效時間回傳空字串。
export function createSessionGroupKey(startDateTime) {
  const startDate = parseLocalDateTime(startDateTime);
  return startDate ? formatSessionGroupKey(startDate) : '';
}

// 解析單一場次的開始與結束時間，結束時間早於開始時間時視為無效。
function getSessionTimeInfo(session) {
  const startDate = parseLocalDateTime(session?.startDateTime);
  const parsedFinishDate = parseLocalDateTime(session?.finishDateTime);
  const hasValidFinish = Boolean(
    startDate
    && parsedFinishDate
    && parsedFinishDate.getTime() >= startDate.getTime()
  );

  return {
    startDate,
    finishDate: hasValidFinish ? parsedFinishDate : null,
    hasValidStart: Boolean(startDate),
    hasValidFinish
  };
}

// 依共用時間規則判定單一場次，缺少結束時間時在開播後安全視為播放中且絕不標為已播完。
export function getSessionStatus(session, now = new Date()) {
  const currentDate = getValidNow(now);
  const { startDate, finishDate, hasValidStart, hasValidFinish } = getSessionTimeInfo(session);

  if (!hasValidStart) return 'invalid';
  if (currentDate.getTime() < startDate.getTime()) return 'waiting';
  if (hasValidFinish && currentDate.getTime() >= finishDate.getTime()) return 'finished';
  return 'playing';
}

// 依場次狀態計算畫面需要的剩餘秒數；無有效目標時間時回傳 null，避免顯示誤導倒數。
export function getSessionRemainingSeconds(session, now = new Date()) {
  const currentDate = getValidNow(now);
  const { startDate, finishDate, hasValidStart, hasValidFinish } = getSessionTimeInfo(session);
  const status = getSessionStatus(session, currentDate);

  if (status === 'waiting' && hasValidStart) {
    return Math.max(0, Math.ceil((startDate.getTime() - currentDate.getTime()) / 1000));
  }
  if (status === 'playing' && hasValidFinish) {
    return Math.max(0, Math.ceil((finishDate.getTime() - currentDate.getTime()) / 1000));
  }
  if (status === 'finished') return 0;
  return null;
}

// 以同一個目前時間更新集中場次的衍生狀態與剩餘秒數，回傳新陣列且不建立第二份原始資料來源。
export function updateSessionStatuses(sessions, now = new Date()) {
  const currentDate = getValidNow(now);
  return (Array.isArray(sessions) ? sessions : []).map(session => ({
    ...session,
    status: getSessionStatus(session, currentDate),
    remainingSeconds: getSessionRemainingSeconds(session, currentDate)
  }));
}

// 將多個場次的時間有效性與狀態彙整成單一資料結果，避免 UI 各自重新判定。
export function getScheduleTimeSummary(sessions, now = new Date()) {
  const currentDate = getValidNow(now);
  const sessionDetails = (Array.isArray(sessions) ? sessions : []).map(session => {
    const timeInfo = getSessionTimeInfo(session);
    return {
      session,
      ...timeInfo,
      status: getSessionStatus(session, currentDate)
    };
  });
  const validStartDates = sessionDetails
    .filter(({ hasValidStart }) => hasValidStart)
    .map(({ startDate }) => startDate);
  const validFinishDates = sessionDetails
    .filter(({ hasValidFinish }) => hasValidFinish)
    .map(({ finishDate }) => finishDate);
  // 依共用狀態名稱計算場次數量，避免各欄位重複篩選規則。
  const countByStatus = status => sessionDetails.filter(detail => detail.status === status).length;

  return {
    totalCount: sessionDetails.length,
    validStartCount: validStartDates.length,
    invalidStartCount: sessionDetails.length - validStartDates.length,
    validFinishCount: validFinishDates.length,
    invalidFinishCount: sessionDetails.length - validFinishDates.length,
    validScheduleCount: sessionDetails.filter(({ hasValidStart, hasValidFinish }) => hasValidStart && hasValidFinish).length,
    earliestStartDate: validStartDates.length ? new Date(Math.min(...validStartDates.map(date => date.getTime()))) : null,
    latestStartDate: validStartDates.length ? new Date(Math.max(...validStartDates.map(date => date.getTime()))) : null,
    latestFinishDate: validFinishDates.length ? new Date(Math.max(...validFinishDates.map(date => date.getTime()))) : null,
    waitingCount: countByStatus('waiting'),
    playingCount: countByStatus('playing'),
    finishedCount: countByStatus('finished'),
    allValidFinishesPassed: validFinishDates.length > 0
      && validFinishDates.every(date => currentDate.getTime() >= date.getTime())
  };
}

// 依影廳自然排序同一開播時間的場次，讓 C2 排在 C10 前方。
function sortSessionsByHall(sessions) {
  return [...sessions].sort((left, right) => (
    String(left.hall || '').localeCompare(String(right.hall || ''), 'en', { numeric: true, sensitivity: 'base' })
  ));
}

// 將完整場次依有效 startDateTime 組成已排序的時間群組，供 Next Movie 與 Alarm 共用。
function getSessionTimeGroups(sessions) {
  const groups = new Map();

  (Array.isArray(sessions) ? sessions : []).forEach(session => {
    const startDate = parseLocalDateTime(session.startDateTime);
    if (!startDate) return;

    const groupKey = formatSessionGroupKey(startDate);
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        groupKey,
        startDateTime: session.startDateTime,
        startDate,
        sessions: []
      });
    }
    groups.get(groupKey).sessions.push(session);
  });

  return [...groups.values()]
    .sort((left, right) => left.startDate.getTime() - right.startDate.getTime())
    .map(group => ({
      ...group,
      sessions: sortSessionsByHall(group.sessions)
    }));
}

// 從完整場次清單取得最接近未開播的時間群組；同時開播的場次會一併回傳。
export function getNextSessionGroup(sessions, now = new Date()) {
  const currentTime = getValidNow(now).getTime();
  return getSessionTimeGroups(sessions).find(group => group.startDate.getTime() > currentTime) || null;
}

// 將集中 state 的已觸發紀錄轉為可安全查詢的 Set，並相容陣列型資料。
function getTriggeredGroupKeys(triggeredGroupKeys) {
  if (triggeredGroupKeys instanceof Set) return triggeredGroupKeys;
  return new Set(Array.isArray(triggeredGroupKeys) ? triggeredGroupKeys : []);
}

// 找出上次可見 ticker 到目前之間最近的一個未觸發群組，並回傳跨過的群組數量。
export function getLatestUntriggeredSessionGroup(sessions, previousTickAt, now = new Date(), triggeredGroupKeys = new Set()) {
  const currentDate = getValidNow(now);
  const previousDate = parseLocalDateTime(previousTickAt);
  const triggeredKeys = getTriggeredGroupKeys(triggeredGroupKeys);
  const crossedGroups = getSessionTimeGroups(sessions).filter(group => (
    group.startDate.getTime() <= currentDate.getTime()
    && (!previousDate || group.startDate.getTime() > previousDate.getTime())
    && !triggeredKeys.has(group.groupKey)
  ));

  return {
    group: crossedGroups.length ? crossedGroups[crossedGroups.length - 1] : null,
    crossedGroupCount: crossedGroups.length
  };
}

// 依匯入與共用時間摘要建立 Next Movie 的五種互斥呈現狀態。
export function getNextMoviePresentationState(sessions, isImported, now = new Date()) {
  if (!isImported) {
    return { type: 'notImported', group: null, summary: getScheduleTimeSummary([], now) };
  }

  const summary = getScheduleTimeSummary(sessions, now);
  if (!summary.validStartCount) {
    return { type: 'invalidTime', group: null, summary };
  }

  const group = getNextSessionGroup(sessions, now);
  if (group) {
    return { type: 'upcoming', group, summary };
  }

  if (summary.playingCount > 0) {
    return { type: 'playing', group: null, summary };
  }

  if (
    summary.validScheduleCount > 0
    && summary.allValidFinishesPassed
    && summary.waitingCount === 0
    && summary.playingCount === 0
  ) {
    return { type: 'completed', group: null, summary };
  }

  return { type: 'invalidTime', group: null, summary };
}

// 保留既有公開介面；真正的播放中場次顯示將由後續功能使用共用狀態函式實作。
export function getCurrentMovie() {
  return null;
}
