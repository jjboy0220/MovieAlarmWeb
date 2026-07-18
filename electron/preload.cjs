const { contextBridge, ipcRenderer } = require('electron');

// 僅暴露桌面警報所需的四個窄介面，不提供完整 ipcRenderer 或任何 Node.js API。
contextBridge.exposeInMainWorld('desktopAlarm', Object.freeze({
  schedule: payload => ipcRenderer.invoke('desktop-alarm:schedule', payload),
  cancel: () => ipcRenderer.invoke('desktop-alarm:cancel'),
  acknowledge: groupKey => ipcRenderer.invoke('desktop-alarm:acknowledge', groupKey),
  onTriggered: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop-alarm:triggered', listener);
    return () => ipcRenderer.removeListener('desktop-alarm:triggered', listener);
  }
}));

// 僅暴露 Windows 登入啟動狀態的讀取與布林切換，不提供路徑或任意 IPC 能力。
contextBridge.exposeInMainWorld('desktopStartup', Object.freeze({
  getState: () => ipcRenderer.invoke('desktop-startup:get-state'),
  setEnabled: enabled => ipcRenderer.invoke('desktop-startup:set-enabled', enabled)
}));

// 僅暴露今日場次原生通知與點擊回呼，不提供 Notification 或視窗控制權。
contextBridge.exposeInMainWorld('desktopScheduleReminder', Object.freeze({
  notify: options => ipcRenderer.invoke('desktop-schedule-reminder:notify', options),
  onShowRequested: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop-schedule-reminder:show', listener);
    return () => ipcRenderer.removeListener('desktop-schedule-reminder:show', listener);
  }
}));

// 僅允許 Renderer 傳送等待中／播放中數量，供關閉監控確認使用。
contextBridge.exposeInMainWorld('desktopWindow', Object.freeze({
  updateMonitoringState: summary => ipcRenderer.invoke('desktop-window:update-monitoring', summary)
}));
