// MM 影城專屬 V1.0 設定；只列出實際數字廳並加入 ATMOS、CTRL 規格。
export const MM_CINEMA_CONFIG = Object.freeze({
  code: 'MM',
  version: '1.0.0',
  appDisplayName: '(MM) Movie Schedule Alarm',
  monitorTitle: 'iFG遠雄威秀影城場次監控',
  halls: ['C1', 'C2', 'C3', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10'],
  formats: ['DIG', 'ATMOS', 'CTRL', 'LIVE', 'SPECIAL'],
  hallAudioSources: {
    C1: 'assets/hall-voice/c1.mp3', C2: 'assets/hall-voice/c2.mp3', C3: 'assets/hall-voice/c3.mp3',
    C5: 'assets/hall-voice/c5.mp3', C6: 'assets/hall-voice/c6.mp3', C7: 'assets/hall-voice/c7.mp3',
    C8: 'assets/hall-voice/c8.mp3', C9: 'assets/hall-voice/c9.mp3',
    C10: 'cinemas/MM/assets/hall-voice/c10.mp3'
  },
  hallAnnouncements: {
    C1: '一廳，開播。', C2: '二廳，開播。', C3: '三廳，開播。', C5: '五廳，開播。', C6: '六廳，開播。',
    C7: '七廳，開播。', C8: '八廳，開播。', C9: '九廳，開播。', C10: '十廳，開播。'
  }
});
