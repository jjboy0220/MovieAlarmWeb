// TC 影城專屬版本、廳別與格式設定，保留既有 GC 廳規則。
export const TC_CINEMA_CONFIG = Object.freeze({
  code: 'TC',
  version: '1.0.0',
  appDisplayName: '(TC) Movie Schedule Alarm',
  monitorTitle: '老虎城威秀影城場次監控',
  halls: ['C1', 'C2', 'C3', 'C5', 'C6', 'C7', 'C8', 'C9', 'GC1', 'GC2'],
  formats: ['DIG', 'TITAN', 'IMAX', 'ATMOS', '4DX', '3D', 'LIVE', 'SPECIAL'],
  hallAudioSources: {
    C1: 'assets/hall-voice/c1.mp3', C2: 'assets/hall-voice/c2.mp3', C3: 'assets/hall-voice/c3.mp3',
    C5: 'assets/hall-voice/c5.mp3', C6: 'assets/hall-voice/c6.mp3', C7: 'assets/hall-voice/c7.mp3',
    C8: 'assets/hall-voice/c8.mp3', C9: 'assets/hall-voice/c9.mp3',
    GC1: 'assets/hall-voice/gc1.mp3', GC2: 'assets/hall-voice/gc2.mp3'
  },
  hallAnnouncements: {
    C1: '一廳，開播。', C2: '二廳，開播。', C3: '三廳，開播。', C5: '五廳，開播。', C6: '六廳，開播。',
    C7: '七廳，開播。', C8: '八廳，開播。', C9: '九廳，開播。', GC1: 'GC 一廳，開播。', GC2: 'GC 二廳，開播。'
  }
});
