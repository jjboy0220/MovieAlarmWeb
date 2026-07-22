const requestedCinemaCode = new URLSearchParams(globalThis.location?.search || '').get('cinema')?.toUpperCase() || 'TC';
const isMmCinema = requestedCinemaCode === 'MM';
const selectedCinemaModule = isMmCinema
  ? await import('../cinemas/MM/config.js')
  : await import('../cinemas/TC/config.js');

// 只載入 Electron 傳入或瀏覽器查詢參數指定的館別設定，未知代號安全回到 TC。
export const CINEMA_CONFIG = isMmCinema ? selectedCinemaModule.MM_CINEMA_CONFIG : selectedCinemaModule.TC_CINEMA_CONFIG;

// 集中保留應用程式名稱、館別版本、廳別與可辨識的放映規格。
export const APP_NAME = 'Movie Schedule Alarm';
export const APP_DISPLAY_NAME = CINEMA_CONFIG.appDisplayName;
export const CINEMA_CODE = CINEMA_CONFIG.code;
export const MONITOR_TITLE = CINEMA_CONFIG.monitorTitle;
export const VERSION = CINEMA_CONFIG.version;
export const HALLS = CINEMA_CONFIG.halls;
export const FORMATS = CINEMA_CONFIG.formats;
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
