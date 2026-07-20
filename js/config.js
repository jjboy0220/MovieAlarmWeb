// 集中保留應用程式名稱、版本與可辨識的放映規格。
export const APP_NAME = 'Movie Schedule Alarm';
export const VERSION = '1.2.0';
export const FORMATS = ['DIG', 'TITAN', 'IMAX', 'ATMOS', '4DX', '3D', 'LIVE', 'SPECIAL'];
export const LANGUAGE_MAP = { C: 'CHI', E: 'ENG', J: 'JAN' };

// 可自行調整的排除片名關鍵字；符合任一關鍵字的場次不會進入應用程式資料流。
export const EXCLUDED_MOVIE_KEYWORDS = ['TEST FILM', 'TEST', 'TRAILER', 'CHECK'];

// 設定中心只保存一般使用偏好，不保存警報開關或瀏覽器音訊解鎖狀態。
export const SETTINGS_STORAGE_KEY = 'movieScheduleAlarm.settings.v1';
export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'dark',
  debugPanelOpen: false,
  alarmVolume: 1,
  alarmSoundMode: 'HALL_VOICE',
  alarmLeadMinutes: 0,
  startupEnabled: true,
  dailyImportReminderEnabled: true
});

// V1.1 僅提供本機警報聲與靜音視覺提醒，不新增外部音效資源。
export const ALARM_SOUND_MODES = Object.freeze([
  { value: 'DEFAULT', label: '預設警報聲' },
  { value: 'HALL_VOICE', label: '廳別語音播報' },
  { value: 'SILENT', label: '靜音（保留視覺提醒）' }
]);
export const ALARM_LEAD_MINUTES = Object.freeze([0, 1, 3, 5, 10, 15]);
