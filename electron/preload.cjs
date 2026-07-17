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
