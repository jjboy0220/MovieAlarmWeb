import assert from 'node:assert/strict';
import { parseFilmTitle, parseHall } from '../js/parser.js';
import { parseScheduleRows } from '../js/excelReader.js';
import { formatCountdown, getCountdownSeconds } from '../js/countdown.js';
import { getNextSessionGroup, getSessionStatus, updateSessionStatuses } from '../js/scheduler.js';
import { getOperationalDateForStart, getScheduleCoverageState } from '../js/scheduleCoverage.js';
import { parsePdfFilenameDateRange, repairPdfDateHeading } from '../js/pdfScheduleReader.js';
import alarmCoordinatorModule from '../electron/alarmCoordinator.cjs';

// 建立回歸測試使用的最小標準化場次，不建立正式 application state。
function session(id, startDateTime, finishDateTime, hall = 'C1') {
  return { id, startDateTime, finishDateTime, hall, title: id, language: '', format: 'DIG' };
}

const live = parseFilmTitle('(LIVE)Takarazuka Revue');
assert.deepEqual(live.formats, ['LIVE']);
assert.equal(live.title, 'Takarazuka Revue');
const special = parseFilmTitle('(CONAN SPECIAL J)DETECTIVE CONAN');
assert.equal(special.formatDisplay, 'DIG SPECIAL');
assert.equal(special.language, 'JAN');
assert.equal(parseHall('GC02'), 'GC2');
assert.equal(parseHall('9'), 'C9');

const excelSessions = parseScheduleRows([
  ['Screen', 'Start', 'Finish', 'Film Title'],
  ['2026/07/18', '', '', ''],
  ['1', '23:30', '01:30', '(DIG E)OVERNIGHT MOVIE'],
  ['GC02', '10:00', '12:00', '(TITAN J)DAY MOVIE']
]);
assert.equal(excelSessions.length, 2);
assert.equal(excelSessions[0].finishDateTime, '2026-07-19T01:30:00');
assert.equal(excelSessions[0].language, 'ENG');
assert.equal(excelSessions[1].hall, 'GC2');

assert.equal(getOperationalDateForStart('2026-07-19', '00:40'), '2026-07-18');
assert.equal(getOperationalDateForStart('2026-07-19', '10:00'), '2026-07-19');

const now = new Date('2026-07-18T15:00:00');
const simultaneous = [
  session('A', '2026-07-18T15:10:00', '2026-07-18T17:00:00', 'C2'),
  session('B', '2026-07-18T15:10:00', '2026-07-18T17:10:00', 'C1'),
  session('C', '2026-07-18T16:00:00', '2026-07-18T18:00:00', 'C3')
];
const nextGroup = getNextSessionGroup(simultaneous, now);
assert.equal(nextGroup.sessions.length, 2);
assert.deepEqual(nextGroup.sessions.map(item => item.hall), ['C1', 'C2']);
assert.equal(getSessionStatus(simultaneous[0], now), 'waiting');
assert.equal(updateSessionStatuses(simultaneous, new Date('2026-07-18T15:30:00'))[0].status, 'playing');

assert.equal(getCountdownSeconds('2026-07-18T15:01:30', now), 90);
assert.equal(formatCountdown(90), '00:01:30');
assert.equal(getScheduleCoverageState(simultaneous, new Date('2026-07-18T18:01:00')).exhausted, true);

const pdfName = 'TC 0710-0716_ProjectionSchedulebyStartTime.pdf';
assert.deepEqual(parsePdfFilenameDateRange(pdfName), { startMonth: 7, startDay: 10, endMonth: 7, endDay: 16 });
assert.equal(repairPdfDateHeading('□□□, □□ 10, 2026', pdfName), '2026-07-10');
assert.equal(repairPdfDateHeading('□□□, □□ 18, 2026', pdfName), '');

const alarmPayload = alarmCoordinatorModule.validateSchedulePayload({
  groupKey: '2026-07-18T15:10:00',
  startTimestamp: new Date('2026-07-18T15:10:00').getTime(),
  scheduleGeneration: 1,
  leadMinutes: 0,
  alarmEnabled: true,
  sessions: nextGroup.sessions
});
assert.equal(alarmPayload.sessions.length, 2);
assert.equal(alarmPayload.alarmEnabled, true);

console.log('V1.0 core regression checks passed');
