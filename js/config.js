// 集中保留應用程式名稱、版本與可辨識的放映規格。
export const APP_NAME = 'Movie Schedule Alarm';
export const VERSION = '1.0.0';
export const FORMATS = ['DIG', 'TITAN', 'IMAX', 'ATMOS', '4DX', '3D'];
export const LANGUAGE_MAP = { C: 'CHI', E: 'ENG', J: 'JAN' };

// 可自行調整的排除片名關鍵字；符合任一關鍵字的場次不會進入應用程式資料流。
export const EXCLUDED_MOVIE_KEYWORDS = ['TEST FILM', 'TEST', 'TRAILER', 'CHECK'];