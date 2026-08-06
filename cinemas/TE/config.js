// TE 影城專屬 V1.0 設定；只保留台中大遠百實際廳別與場次表規格。
export const TE_CINEMA_CONFIG = Object.freeze({
  code: 'TE',
  version: '1.0.0',
  appDisplayName: '(TE) Movie Schedule Alarm',
  monitorTitle: '台中大遠百威秀影城場次監控',
  halls: ['C1', 'C2', 'C3', 'C5', 'C6', 'C7', 'C8'],
  formats: ['DIG', 'DIG FAN', 'IMAX', '3D', 'LIVE', 'SPECIAL'],
  hallAudioSources: {
    C1: 'assets/hall-voice/c1.mp3', C2: 'assets/hall-voice/c2.mp3', C3: 'assets/hall-voice/c3.mp3',
    C5: 'assets/hall-voice/c5.mp3', C6: 'assets/hall-voice/c6.mp3', C7: 'assets/hall-voice/c7.mp3',
    C8: 'assets/hall-voice/c8.mp3'
  },
  privateBookingAudioSources: {
    C1: 'assets/private-booking-voice/c1.mp3', C2: 'assets/private-booking-voice/c2.mp3', C3: 'assets/private-booking-voice/c3.mp3',
    C5: 'assets/private-booking-voice/c5.mp3', C6: 'assets/private-booking-voice/c6.mp3', C7: 'assets/private-booking-voice/c7.mp3',
    C8: 'assets/private-booking-voice/c8.mp3'
  },
  hallAnnouncements: {
    C1: '一廳，開播。', C2: '二廳，開播。', C3: '三廳，開播。', C5: '五廳，開播。',
    C6: '六廳，開播。', C7: '七廳，開播。', C8: '八廳，開播。'
  }
});
