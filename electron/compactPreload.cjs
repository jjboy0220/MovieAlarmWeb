const { contextBridge, ipcRenderer } = require('electron');

// 只暴露小視窗顯示、返回完整視窗與自適應高度所需的最小 IPC。
contextBridge.exposeInMainWorld('compactWindow', Object.freeze({
  showFull: () => ipcRenderer.invoke('compact-window:show-full'),
  resize: contentHeight => ipcRenderer.invoke('compact-window:resize', contentHeight),
  stopAlarm: () => ipcRenderer.invoke('compact-window:stop-alarm'),
  showContextMenu: () => ipcRenderer.invoke('compact-window:show-context-menu'),
  onPresentation: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('compact-window:presentation', listener);
    return () => ipcRenderer.removeListener('compact-window:presentation', listener);
  },
  onAlarm: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('compact-window:alarm', listener);
    return () => ipcRenderer.removeListener('compact-window:alarm', listener);
  },
  onAlarmStopped: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('compact-window:alarm-stopped', listener);
    return () => ipcRenderer.removeListener('compact-window:alarm-stopped', listener);
  }
}));
