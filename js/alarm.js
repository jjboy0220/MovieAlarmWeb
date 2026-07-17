const ALARM_AUDIO_SOURCE = 'assets/alarm.wav';
let sharedAlarmChannel = null;

// 將瀏覽器拒絕播放的情況轉為可直接顯示的繁體中文提示。
function getAudioErrorMessage(error) {
  if (error?.name === 'NotAllowedError') return '瀏覽器尚未允許播放聲音，請再次點選鬧鐘切換按鈕';
  return '警報音效無法播放，請檢查 assets/alarm.wav';
}

// 取得設定中的安全音量值，確保 HTMLAudioElement 只接收 0 至 1 的數字。
function getAlarmVolume(settings) {
  const volume = Number(settings?.alarmVolume);
  return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
}

// 判斷目前是否使用靜音模式；靜音仍保留 Modal 與視覺提醒。
function isSilentMode(settings) {
  return settings?.alarmSoundMode === 'SILENT';
}

// 建立全站唯一的 Audio Alarm Channel，避免切換警報或重新匯入時重複建立音效物件。
export function createAlarmChannel() {
  if (sharedAlarmChannel) return sharedAlarmChannel;

  const runtime = {
    enabled: false,
    unlocked: false,
    active: false,
    audioLoadStatus: '載入中',
    audioPlayError: ''
  };
  const AudioConstructor = globalThis.Audio;
  const audio = typeof AudioConstructor === 'function' ? new AudioConstructor(ALARM_AUDIO_SOURCE) : null;

  if (!audio) {
    runtime.audioLoadStatus = '不支援';
    runtime.audioPlayError = '目前瀏覽器不支援警報音效播放';
  } else {
    audio.preload = 'auto';
    audio.loop = false;
    audio.volume = 1;
    audio.addEventListener('canplay', () => {
      runtime.audioLoadStatus = '可播放';
      runtime.audioPlayError = '';
    });
    audio.addEventListener('error', () => {
      runtime.enabled = false;
      runtime.unlocked = false;
      runtime.active = false;
      runtime.audioLoadStatus = '載入失敗';
      runtime.audioPlayError = '警報音效無法播放，請檢查 assets/alarm.wav';
    });
  }

  // 回傳執行快照，讓集中 state 成為 UI 唯一的資料來源。
  function getState() {
    return { ...runtime };
  }

  // 將設定套用到唯一 Audio Channel；切換靜音時不移除既有視覺警報。
  function applySettings(settings) {
    if (!audio) return;

    if (isSilentMode(settings)) {
      if (runtime.active) {
        audio.pause();
        audio.currentTime = 0;
      }
      audio.muted = true;
      audio.volume = 0;
      return;
    }

    audio.muted = false;
    audio.volume = getAlarmVolume(settings);
  }

  // 在使用者點選開關的事件中靜音播放一次，安全地取得瀏覽器音效權限而不播放正式警報。
  async function unlock(settings) {
    if (isSilentMode(settings)) {
      runtime.enabled = true;
      runtime.unlocked = false;
      runtime.audioPlayError = '';
      return { success: true, message: '' };
    }

    if (!audio || runtime.audioLoadStatus === '載入失敗') {
      runtime.enabled = false;
      runtime.unlocked = false;
      return { success: false, message: '瀏覽器尚未允許播放聲音，請再次點選鬧鐘切換按鈕' };
    }

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.loop = false;
      audio.muted = true;
      audio.volume = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = getAlarmVolume(settings);
      runtime.enabled = true;
      runtime.unlocked = true;
      runtime.audioPlayError = '';
      return { success: true, message: '' };
    } catch (error) {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = getAlarmVolume(settings);
      runtime.enabled = false;
      runtime.unlocked = false;
      runtime.audioPlayError = getAudioErrorMessage(error);
      return { success: false, message: runtime.audioPlayError };
    }
  }

  // 播放正式群組警報；靜音模式只維持正式 Modal 與視覺提醒，不呼叫播放 API。
  async function startAlarm(settings) {
    runtime.active = true;
    if (isSilentMode(settings)) return { audioStarted: false, message: '' };
    if (!audio || runtime.audioLoadStatus === '載入失敗') return { audioStarted: false, message: runtime.audioPlayError };

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.loop = true;
      audio.muted = false;
      audio.volume = getAlarmVolume(settings);
      await audio.play();
      runtime.enabled = true;
      runtime.unlocked = true;
      runtime.audioPlayError = '';
      return { audioStarted: true, message: '' };
    } catch (error) {
      runtime.audioPlayError = getAudioErrorMessage(error);
      return { audioStarted: false, message: runtime.audioPlayError };
    }
  }

  // 停止並重設正式警報音效，但不改變使用者是否已啟用警報的選擇。
  function stopAlarm(settings) {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.loop = false;
      audio.muted = false;
      audio.volume = getAlarmVolume(settings);
    }
    runtime.active = false;
  }

  // 關閉警報時沿用既有停止流程，再將唯一的 enabled 開關設為 false。
  function disableAlarm(settings) {
    stopAlarm(settings);
    runtime.enabled = false;
  }

  // 提供目前是否有正式警報播放中的唯讀查詢。
  function isAlarmActive() {
    return runtime.active;
  }

  sharedAlarmChannel = { getState, applySettings, unlock, startAlarm, stopAlarm, disableAlarm, isAlarmActive };
  return sharedAlarmChannel;
}

// 提供模組外部停止正式警報的共用入口。
export function stopAlarm(settings) {
  return createAlarmChannel().stopAlarm(settings);
}

// 提供模組外部關閉警報的共用入口。
export function disableAlarm(settings) {
  return createAlarmChannel().disableAlarm(settings);
}

// 提供模組外部查詢正式警報狀態的共用入口。
export function isAlarmActive() {
  return createAlarmChannel().isAlarmActive();
}
