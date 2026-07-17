import { ALARM_LEAD_MINUTES, ALARM_SOUND_MODES, DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from './config.js';

// 將外部或舊版設定值限制在 V1.0 支援的主題、音量與選項範圍內。
export function normalizeSettings(candidate = {}) {
  const source = candidate && typeof candidate === 'object' ? candidate : {};
  const volume = Number(source.alarmVolume);
  const leadMinutes = Number(source.alarmLeadMinutes);
  const theme = source.theme === 'light' ? 'light' : DEFAULT_SETTINGS.theme;
  const soundMode = ALARM_SOUND_MODES.some(option => option.value === source.alarmSoundMode)
    ? source.alarmSoundMode
    : DEFAULT_SETTINGS.alarmSoundMode;

  return {
    theme,
    debugPanelOpen: Boolean(source.debugPanelOpen),
    alarmVolume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_SETTINGS.alarmVolume,
    alarmSoundMode: soundMode,
    alarmLeadMinutes: ALARM_LEAD_MINUTES.includes(leadMinutes) ? leadMinutes : DEFAULT_SETTINGS.alarmLeadMinutes
  };
}

// 從瀏覽器 localStorage 讀取一般設定；資料缺失或損壞時安全回退為預設值。
export function loadSettings() {
  try {
    const saved = globalThis.localStorage?.getItem(SETTINGS_STORAGE_KEY);
    return saved ? normalizeSettings(JSON.parse(saved)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// 將已正規化的一般設定寫入 localStorage，並回傳結果讓 UI 顯示必要錯誤。
export function saveSettings(settings) {
  try {
    globalThis.localStorage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
    return { success: true, message: '' };
  } catch {
    return { success: false, message: '設定無法儲存；本次瀏覽期間仍會套用目前設定。' };
  }
}
