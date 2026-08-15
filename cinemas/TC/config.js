// TC 影城專屬版本、廳別與格式設定，保留既有 GC 廳規則。
export const TC_CINEMA_CONFIG = Object.freeze({
  code: 'TC',
  version: '2.4.0',
  appDisplayName: '(TC) Movie Schedule Alarm',
  monitorTitle: '老虎城威秀影城場次監控',
  allowDefaultAlarmSound: false,
  resetHallVoiceOnLaunch: true,
  includeFinalOperationalDayOvernight: true,
  halls: ['C1', 'C2', 'C3', 'C5', 'C6', 'C7', 'C8', 'C9', 'GC1', 'GC2'],
  formats: ['DIG', 'TITAN', 'IMAX', 'ATMOS', '4DX', '3D', 'LIVE', 'SPECIAL', 'PRE'],
  hallAudioSources: {
    C1: 'cinemas/TC/assets/hall-voice/c1.mp3', C2: 'cinemas/TC/assets/hall-voice/c2.mp3', C3: 'cinemas/TC/assets/hall-voice/c3.mp3',
    C5: 'cinemas/TC/assets/hall-voice/c5.mp3', C6: 'cinemas/TC/assets/hall-voice/c6.mp3', C7: 'cinemas/TC/assets/hall-voice/c7.mp3',
    C8: 'cinemas/TC/assets/hall-voice/c8.mp3', C9: 'cinemas/TC/assets/hall-voice/c9.mp3',
    GC1: 'cinemas/TC/assets/hall-voice/gc1.mp3', GC2: 'cinemas/TC/assets/hall-voice/gc2.mp3'
  },
  privateBookingAudioSources: {
    C1: 'cinemas/TC/assets/private-booking-voice/c1.mp3', C2: 'cinemas/TC/assets/private-booking-voice/c2.mp3', C3: 'cinemas/TC/assets/private-booking-voice/c3.mp3',
    C5: 'cinemas/TC/assets/private-booking-voice/c5.mp3', C6: 'cinemas/TC/assets/private-booking-voice/c6.mp3', C7: 'cinemas/TC/assets/private-booking-voice/c7.mp3',
    C8: 'cinemas/TC/assets/private-booking-voice/c8.mp3', C9: 'cinemas/TC/assets/private-booking-voice/c9.mp3',
    GC1: 'cinemas/TC/assets/private-booking-voice/gc1.mp3', GC2: 'cinemas/TC/assets/private-booking-voice/gc2.mp3'
  },
  liveAudioSource: 'cinemas/TC/assets/live/live-reminder.mp3',
  liveAnnouncement: '直播場次提醒。',
  flexibleSpecialAudioSource: 'cinemas/TC/assets/special/flexible-start-reminder.mp3',
  flexibleSpecialAnnouncement: '特別場非表定開播提醒。',
  hallAnnouncements: {
    C1: '一廳，開播。', C2: '二廳，開播。', C3: '三廳，開播。', C5: '五廳，開播。', C6: '六廳，開播。',
    C7: '七廳，開播。', C8: '八廳，開播。', C9: '九廳，開播。', GC1: 'GC 一廳，開播。', GC2: 'GC 二廳，開播。'
  }
});
