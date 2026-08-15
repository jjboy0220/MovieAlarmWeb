const test = require('node:test');
const assert = require('node:assert/strict');
const { createAlarmCoordinator } = require('../electron/alarmCoordinator.cjs');

function createWindowStub() {
  return {
    isDestroyed: () => false,
    isMinimized: () => false,
    isVisible: () => true,
    isFocused: () => true,
    getBounds: () => ({ x: 0, y: 0, width: 1200, height: 800 }),
    restore() {},
    show() {},
    setAlwaysOnTop() {},
    moveTop() {},
    focus() {},
    flashFrame() {},
    webContents: {
      id: 1,
      isDestroyed: () => false,
      setAudioMuted() {}
    }
  };
}

function createPayload(groupKey, startTimestamp) {
  return {
    groupKey,
    startTimestamp,
    scheduleGeneration: 1,
    leadMinutes: 0,
    alarmEnabled: true,
    sessions: [{ hall: 'C1', title: 'Test' }]
  };
}

test('到點群組不會被 Renderer 推進的下一組排程覆蓋', () => {
  const originalNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;

  const triggered = [];
  const coordinator = createAlarmCoordinator({
    getMainWindow: createWindowStub,
    screen: {
      getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
      getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }),
      getCursorScreenPoint: () => ({ x: 0, y: 0 })
    },
    sendTriggered: payload => {
      triggered.push(payload.groupKey);
      return { sent: true, rendererDestroyed: false, rendererWebContentsId: 1 };
    }
  });

  try {
    coordinator.schedule(createPayload('2026-08-14T22:20:00', now + 1_000));
    now += 1_001;

    coordinator.schedule(createPayload('2026-08-15T00:20:00', now + 7_199_000));

    assert.deepEqual(triggered, ['2026-08-14T22:20:00']);
    assert.equal(coordinator.getDebugState().scheduledGroupKey, '2026-08-15T00:20:00');
  } finally {
    coordinator.cancel();
    Date.now = originalNow;
  }
});
