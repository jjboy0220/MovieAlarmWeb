// TD 影城專屬 V1.0 設定；以樓層標示南紡影城兩個放映區域並使用獨立語音資產。
export const TD_CINEMA_CONFIG = Object.freeze({
  code: 'TD',
  version: '1.0.0',
  appDisplayName: '(TD) Movie Schedule Alarm',
  monitorTitle: '台南南紡威秀影城場次監控',
  allowDefaultAlarmSound: false,
  resetHallVoiceOnLaunch: true,
  includeFinalOperationalDayOvernight: true,
  halls: ['C1', 'C2', 'C3', 'C5', 'C6', 'C7', 'C8', 'C9', 'GC1', 'GC2', 'C21', 'C22', 'C23', 'C24', 'C25'],
  hallDisplayLabels: {
    C1: '(5F) C1', C2: '(5F) C2', C3: '(5F) C3', C5: '(5F) C5', C6: '(5F) C6',
    C7: '(5F) C7', C8: '(5F) C8', C9: '(5F) C9', GC1: '(5F) GC1', GC2: '(5F) GC2',
    C21: '(B1F) C21', C22: '(B1F) C22', C23: '(B1F) C23', C24: '(B1F) C24', C25: '(B1F) C25'
  },
  formats: ['DIG', 'TITAN', 'IMAX', 'ATMOS', '4DX', '3D', 'LIVE', 'SPECIAL', 'PRE'],
  hallAudioSources: {
    C1: 'cinemas/TD/assets/hall-voice/c1.mp3', C2: 'cinemas/TD/assets/hall-voice/c2.mp3',
    C3: 'cinemas/TD/assets/hall-voice/c3.mp3', C5: 'cinemas/TD/assets/hall-voice/c5.mp3',
    C6: 'cinemas/TD/assets/hall-voice/c6.mp3', C7: 'cinemas/TD/assets/hall-voice/c7.mp3',
    C8: 'cinemas/TD/assets/hall-voice/c8.mp3', C9: 'cinemas/TD/assets/hall-voice/c9.mp3',
    GC1: 'cinemas/TD/assets/hall-voice/gc1.mp3', GC2: 'cinemas/TD/assets/hall-voice/gc2.mp3',
    C21: 'cinemas/TD/assets/hall-voice/c21.mp3', C22: 'cinemas/TD/assets/hall-voice/c22.mp3',
    C23: 'cinemas/TD/assets/hall-voice/c23.mp3', C24: 'cinemas/TD/assets/hall-voice/c24.mp3',
    C25: 'cinemas/TD/assets/hall-voice/c25.mp3'
  },
  privateBookingAudioSources: {
    C1: 'cinemas/TD/assets/private-booking-voice/c1.mp3', C2: 'cinemas/TD/assets/private-booking-voice/c2.mp3',
    C3: 'cinemas/TD/assets/private-booking-voice/c3.mp3', C5: 'cinemas/TD/assets/private-booking-voice/c5.mp3',
    C6: 'cinemas/TD/assets/private-booking-voice/c6.mp3', C7: 'cinemas/TD/assets/private-booking-voice/c7.mp3',
    C8: 'cinemas/TD/assets/private-booking-voice/c8.mp3', C9: 'cinemas/TD/assets/private-booking-voice/c9.mp3',
    GC1: 'cinemas/TD/assets/private-booking-voice/gc1.mp3', GC2: 'cinemas/TD/assets/private-booking-voice/gc2.mp3',
    C21: 'cinemas/TD/assets/private-booking-voice/c21.mp3', C22: 'cinemas/TD/assets/private-booking-voice/c22.mp3',
    C23: 'cinemas/TD/assets/private-booking-voice/c23.mp3', C24: 'cinemas/TD/assets/private-booking-voice/c24.mp3',
    C25: 'cinemas/TD/assets/private-booking-voice/c25.mp3'
  },
  liveAudioSource: 'cinemas/TD/assets/live/live-reminder.mp3',
  liveAnnouncement: '直播場次提醒。',
  flexibleSpecialAudioSource: 'cinemas/TD/assets/special/flexible-start-reminder.mp3',
  flexibleSpecialAnnouncement: '特別場非表定開播提醒。',
  hallAnnouncements: {
    C1: '一廳，開播。', C2: '二廳，開播。', C3: '三廳，開播。', C5: '五廳，開播。', C6: '六廳，開播。',
    C7: '七廳，開播。', C8: '八廳，開播。', C9: '九廳，開播。', GC1: 'GC 一廳，開播。', GC2: 'GC 二廳，開播。',
    C21: '二十一廳，開播。', C22: '二十二廳，開播。', C23: '二十三廳，開播。',
    C24: '二十四廳，開播。', C25: '二十五廳，開播。'
  }
});
