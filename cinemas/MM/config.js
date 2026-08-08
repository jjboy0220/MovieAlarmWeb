// MM 影城專屬 V2.2 設定；只列出實際數字廳並加入 ATMOS、CTRL 規格。
export const MM_CINEMA_CONFIG = Object.freeze({
  code: 'MM',
  version: '2.2.0',
  appDisplayName: '(MM) Movie Schedule Alarm',
  allowDefaultAlarmSound: false,
  resetHallVoiceOnLaunch: true,
  includeFinalOperationalDayOvernight: true,
  monitorTitle: 'iFG遠雄威秀影城場次監控',
  halls: ['C1', 'C2', 'C3', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10'],
  formats: ['DIG', 'DIG FAN', 'FAN', 'ATMOS', 'CTRL', 'LIVE', 'SPECIAL', 'PRE'],
  hallAudioSources: {
    C1: 'cinemas/MM/assets/hall-voice/c1.mp3', C2: 'cinemas/MM/assets/hall-voice/c2.mp3', C3: 'cinemas/MM/assets/hall-voice/c3.mp3',
    C5: 'cinemas/MM/assets/hall-voice/c5.mp3', C6: 'cinemas/MM/assets/hall-voice/c6.mp3', C7: 'cinemas/MM/assets/hall-voice/c7.mp3',
    C8: 'cinemas/MM/assets/hall-voice/c8.mp3', C9: 'cinemas/MM/assets/hall-voice/c9.mp3',
    C10: 'cinemas/MM/assets/hall-voice/c10.mp3'
  },
  privateBookingAudioSources: {
    C1: 'cinemas/MM/assets/private-booking-voice/c1.mp3', C2: 'cinemas/MM/assets/private-booking-voice/c2.mp3', C3: 'cinemas/MM/assets/private-booking-voice/c3.mp3',
    C5: 'cinemas/MM/assets/private-booking-voice/c5.mp3', C6: 'cinemas/MM/assets/private-booking-voice/c6.mp3', C7: 'cinemas/MM/assets/private-booking-voice/c7.mp3',
    C8: 'cinemas/MM/assets/private-booking-voice/c8.mp3', C9: 'cinemas/MM/assets/private-booking-voice/c9.mp3',
    C10: 'cinemas/MM/assets/private-booking-voice/c10.mp3'
  },
  liveAudioSource: 'cinemas/MM/assets/live/live-reminder.mp3',
  liveAnnouncement: '直播場次提醒。',
  flexibleSpecialAudioSource: 'cinemas/MM/assets/special/flexible-start-reminder.mp3',
  flexibleSpecialAnnouncement: '特別場非表定開播提醒。',
  hallAnnouncements: {
    C1: '一廳，開播。', C2: '二廳，開播。', C3: '三廳，開播。', C5: '五廳，開播。', C6: '六廳，開播。',
    C7: '七廳，開播。', C8: '八廳，開播。', C9: '九廳，開播。', C10: '十廳，開播。'
  }
});
