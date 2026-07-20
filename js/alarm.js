const ALARM_AUDIO_SOURCE = 'assets/alarm.wav';
const HALL_AUDIO_SOURCES = Object.freeze({
  C1: 'assets/hall-voice/c1.mp3', C2: 'assets/hall-voice/c2.mp3', C3: 'assets/hall-voice/c3.mp3',
  C5: 'assets/hall-voice/c5.mp3', C6: 'assets/hall-voice/c6.mp3', C7: 'assets/hall-voice/c7.mp3',
  C8: 'assets/hall-voice/c8.mp3', C9: 'assets/hall-voice/c9.mp3',
  GC1: 'assets/hall-voice/gc1.mp3', GC2: 'assets/hall-voice/gc2.mp3'
});
const HALL_ANNOUNCEMENTS = Object.freeze({
  C1: '一廳，開播。', C2: '二廳，開播。', C3: '三廳，開播。', C5: '五廳，開播。', C6: '六廳，開播。',
  C7: '七廳，開播。', C8: '八廳，開播。', C9: '九廳，開播。', GC1: 'GC 一廳，開播。', GC2: 'GC 二廳，開播。'
});
let sharedAlarmChannel = null;

// 將瀏覽器拒絕播放的情況轉為可直接顯示的繁體中文提示。
function getAudioErrorMessage(error) {
  if (globalThis.desktopAlarm) return '警報音效播放失敗，但場次已到點';
  if (error?.name === 'NotAllowedError') return '瀏覽器尚未允許播放聲音，請再次點選鬧鐘切換按鈕';
  return '警報音效無法播放，請檢查 assets/alarm.wav';
}

// 取得設定中的安全音量值，確保 HTMLAudioElement 只接收 0 至 1 的數字。
function getAlarmVolume(settings) {
  if (globalThis.desktopAlarm) return 1;
  const volume = Number(settings?.alarmVolume);
  return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
}

// 判斷目前是否使用靜音模式；靜音仍保留 Modal 與視覺提醒。
function isSilentMode(settings) {
  return settings?.alarmSoundMode === 'SILENT';
}

// 判斷是否使用 Windows 本機廳別語音播報模式。
function isHallVoiceMode(settings) {
  return settings?.alarmSoundMode === 'HALL_VOICE';
}

// 將標準化影廳轉為繁體中文開播語句；未知影廳保守保留原名稱。
function getHallAnnouncement(hall) {
  const normalizedHall = String(hall || '').trim().toUpperCase();
  return HALL_ANNOUNCEMENTS[normalizedHall] || (normalizedHall ? `${normalizedHall} 開播` : '場次開播');
}

// 取得專案內已確認的影廳錄音；未知影廳沒有錄音時由 Windows 中文語音安全備援。
function getHallAudioSource(hall) {
  return HALL_AUDIO_SOURCES[String(hall || '').trim().toUpperCase()] || '';
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
  const speechSynthesis = globalThis.speechSynthesis || null;
  const SpeechUtterance = globalThis.SpeechSynthesisUtterance || null;
  let speechGeneration = 0;

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

  // 優先選擇台灣中文與本機自然語音，避免使用第一個中文語音造成口音或清晰度不一致。
  function getPreferredChineseVoice() {
    if (!speechSynthesis) return null;
    const naturalVoicePattern = /hsiao|hanhan|yating|曉|小|怡|雅婷|zhiyu/i;
    return [...speechSynthesis.getVoices()]
      .filter(voice => /^zh(?:-|_)/i.test(voice.lang))
      .sort((left, right) => {
        const score = voice => {
          const language = String(voice.lang || '').replace('_', '-').toLowerCase();
          return (language === 'zh-tw' ? 100 : language === 'zh-hk' ? 60 : 30)
            + (voice.localService ? 20 : 0)
            + (naturalVoicePattern.test(voice.name) ? 30 : 0)
            + (voice.default ? 5 : 0);
        };
        return score(right) - score(left);
      })[0] || null;
  }

  // 建立使用 Windows 中文語音與目前安全音量的單句 utterance。
  function createVoiceUtterance(message, settings) {
    const utterance = new SpeechUtterance(message);
    utterance.lang = 'zh-TW';
    utterance.rate = 0.82;
    utterance.pitch = 0.96;
    utterance.volume = getAlarmVolume(settings);
    const chineseVoice = getPreferredChineseVoice();
    if (chineseVoice) utterance.voice = chineseVoice;
    return utterance;
  }

  // 將唯一 Audio Channel 切換至指定音源，避免建立第二個 Audio 物件。
  function prepareAudioSource(source, settings) {
    if (!audio) return;
    audio.pause();
    audio.onended = null;
    audio.currentTime = 0;
    if (audio.getAttribute('src') !== source) audio.src = source;
    audio.loop = false;
    audio.muted = false;
    audio.volume = getAlarmVolume(settings);
  }

  // 在設定中心播放一次所選影廳語音；正式警報中不允許試聽以避免重疊。
  function previewHallAnnouncement(hall, settings) {
    const isDefaultAlarmPreview = hall === 'DEFAULT_ALARM';
    const message = isDefaultAlarmPreview ? '預設警報聲' : getHallAnnouncement(hall);
    if (runtime.active) return Promise.resolve({ success: false, message: '正式警報播放中，請先停止警報再測試語音' });
    const recordedSource = isDefaultAlarmPreview ? ALARM_AUDIO_SOURCE : getHallAudioSource(hall);
    if (recordedSource && audio) {
      speechGeneration += 1;
      speechSynthesis?.cancel();
      prepareAudioSource(recordedSource, settings);
      return new Promise(resolve => {
        audio.onended = () => {
          audio.onended = null;
          resolve({ success: true, message });
        };
        audio.play().catch(() => resolve({ success: false, message: '影廳語音錄音播放失敗，請檢查本機音效檔' }));
      });
    }
    if (!speechSynthesis || typeof SpeechUtterance !== 'function') {
      return Promise.resolve({ success: false, message: '目前 Windows 環境不支援廳別語音播報' });
    }
    speechGeneration += 1;
    speechSynthesis.cancel();
    return new Promise(resolve => {
      const utterance = createVoiceUtterance(message, settings);
      utterance.onend = () => resolve({ success: true, message });
      utterance.onerror = () => resolve({ success: false, message: '語音播放失敗，請確認 Windows 已安裝中文語音' });
      speechSynthesis.speak(utterance);
    });
  }

  // 將設定套用到唯一 Audio Channel；切換靜音時不移除既有視覺警報。
  function applySettings(settings) {
    if (!audio) return;

    if (isSilentMode(settings) || isHallVoiceMode(settings)) {
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

  // 僅將既有唯一警報狀態設為啟用，不播放聲音；供 Desktop 每次啟動建立預設狀態。
  function enableAlarm(settings) {
    runtime.enabled = true;
    runtime.audioPlayError = '';
    applySettings(settings);
  }

  // 在使用者點選開關的事件中靜音播放一次，安全地取得瀏覽器音效權限而不播放正式警報。
  async function unlock(settings) {
    if (isSilentMode(settings) || isHallVoiceMode(settings)) {
      runtime.enabled = true;
      runtime.unlocked = isHallVoiceMode(settings);
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
  async function startAlarm(settings, group = null) {
    runtime.active = true;
    if (isSilentMode(settings)) return { audioStarted: false, message: '' };
    if (isHallVoiceMode(settings)) {
      if (!audio && (!speechSynthesis || typeof SpeechUtterance !== 'function')) {
        runtime.audioPlayError = '目前 Windows 環境不支援廳別語音播報';
        return { audioStarted: false, message: runtime.audioPlayError };
      }
      const announcements = (group?.sessions || []).map(session => ({
        message: getHallAnnouncement(session.hall),
        source: getHallAudioSource(session.hall)
      }));
      if (!announcements.length) announcements.push({ message: '場次開播', source: '' });
      const generation = ++speechGeneration;
      speechSynthesis?.cancel();

      // 利用錄音或 utterance 結束事件依序循環，不建立額外 interval 或 timeout。
      const speakNext = index => {
        if (!runtime.active || generation !== speechGeneration) return;
        const announcement = announcements[index];
        const nextIndex = (index + 1) % announcements.length;
        if (announcement.source && audio) {
          prepareAudioSource(announcement.source, settings);
          audio.onended = () => speakNext(nextIndex);
          audio.play().catch(() => {
            runtime.audioPlayError = '影廳語音錄音播放失敗，已改用 Windows 中文語音';
            if (!speechSynthesis || typeof SpeechUtterance !== 'function') return;
            const fallback = createVoiceUtterance(announcement.message, settings);
            fallback.onend = () => speakNext(nextIndex);
            speechSynthesis.speak(fallback);
          });
          return;
        }
        if (!speechSynthesis || typeof SpeechUtterance !== 'function') {
          runtime.audioPlayError = '缺少此影廳錄音，且 Windows 中文語音無法使用';
          return;
        }
        const utterance = createVoiceUtterance(announcement.message, settings);
        utterance.onend = () => speakNext(nextIndex);
        utterance.onerror = () => {
          runtime.audioPlayError = '廳別語音播報失敗，請確認 Windows 已安裝中文語音';
        };
        speechSynthesis.speak(utterance);
      };

      speakNext(0);
      runtime.enabled = true;
      runtime.unlocked = true;
      runtime.audioPlayError = '';
      return { audioStarted: true, message: '' };
    }
    if (!audio || runtime.audioLoadStatus === '載入失敗') return { audioStarted: false, message: runtime.audioPlayError };

    try {
      prepareAudioSource(ALARM_AUDIO_SOURCE, settings);
      audio.loop = true;
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
    speechGeneration += 1;
    speechSynthesis?.cancel();
    if (audio) {
      audio.pause();
      audio.onended = null;
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

  sharedAlarmChannel = { getState, applySettings, enableAlarm, unlock, previewHallAnnouncement, startAlarm, stopAlarm, disableAlarm, isAlarmActive };
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
