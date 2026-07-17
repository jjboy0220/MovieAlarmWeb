const path = require('node:path');
const { app, BrowserWindow, Menu, Notification, ipcMain, powerMonitor, screen } = require('electron');
const { createAlarmCoordinator } = require('./alarmCoordinator.cjs');

const WINDOWS_APP_USER_MODEL_ID = 'com.moviealarm.schedule';

let mainWindow = null;
let alarmCoordinator = null;
let pendingTriggeredPayload = null;
let activeScheduleNotification = null;

// 將既有主視窗還原、顯示並移至最上方，供重複啟動時沿用單一執行個體。
function focusExistingMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.moveTop();
  mainWindow.focus();
}

// 判斷目前桌面執行型態，避免 Portable 或開發版建立永久 Windows 登入啟動項目。
function getDesktopInstallationType() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return 'portable';
  return app.isPackaged ? 'setup' : 'development';
}

// 讀取 Windows 實際登入啟動狀態，包含被系統或工作管理員停用的結果。
function getDesktopStartupState() {
  const installationType = getDesktopInstallationType();
  const supported = process.platform === 'win32' && installationType === 'setup';
  if (!supported) {
    return { supported: false, enabled: false, openAtLogin: false, executableWillLaunchAtLogin: false, installationType };
  }

  const loginItem = app.getLoginItemSettings({ path: process.execPath });
  return {
    supported: true,
    enabled: Boolean(loginItem.openAtLogin && loginItem.executableWillLaunchAtLogin),
    openAtLogin: Boolean(loginItem.openAtLogin),
    executableWillLaunchAtLogin: Boolean(loginItem.executableWillLaunchAtLogin),
    installationType
  };
}

// 僅接受目前主視窗送出的 IPC，避免其他 WebContents 操作桌面警報排程。
function isTrustedSender(event) {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents);
}

// 將目前 WebContents 音訊靜音狀態附加到既有桌面警報 Debug，不建立第二份警報狀態。
function includeWebContentsAudioDebug(debugInfo) {
  const webContentsAudioMuted = mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()
    ? mainWindow.webContents.isAudioMuted()
    : null;
  return { ...debugInfo, webContentsAudioMuted };
}

// 註冊最小化桌面警報 IPC，所有輸入驗證由 Main Process Coordinator 統一處理。
function bindDesktopAlarmIpc() {
  ipcMain.handle('desktop-alarm:schedule', (event, payload) => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的警報排程來源');
    return includeWebContentsAudioDebug(alarmCoordinator.schedule(payload));
  });
  ipcMain.handle('desktop-alarm:cancel', event => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的警報取消來源');
    return includeWebContentsAudioDebug(alarmCoordinator.cancel());
  });
  ipcMain.handle('desktop-alarm:acknowledge', (event, groupKey) => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的警報停止來源');
    return includeWebContentsAudioDebug(alarmCoordinator.acknowledge(groupKey));
  });
}

// 註冊受限制的 Windows 登入啟動 IPC，只接受目前主視窗與 boolean 輸入。
function bindDesktopStartupIpc() {
  ipcMain.handle('desktop-startup:get-state', event => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的開機啟動狀態來源');
    return getDesktopStartupState();
  });
  ipcMain.handle('desktop-startup:set-enabled', (event, enabled) => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的開機啟動設定來源');
    if (typeof enabled !== 'boolean') throw new TypeError('開機啟動設定必須是 boolean');
    const currentState = getDesktopStartupState();
    if (!currentState.supported) return currentState;
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
    return getDesktopStartupState();
  });
}

// 註冊今日場次原生通知 IPC；通知失敗只回傳 Debug 錯誤，不影響 Renderer Modal。
function bindDesktopScheduleReminderIpc() {
  ipcMain.handle('desktop-schedule-reminder:notify', event => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的今日場次提醒來源');
    focusExistingMainWindow();
    try {
      if (!Notification.isSupported()) {
        return { notificationShown: false, notificationError: '目前 Windows 環境不支援原生通知' };
      }
      activeScheduleNotification?.close();
      const notification = new Notification({
        title: 'Movie Schedule Alarm',
        body: '尚未匯入今日場次表，請開啟程式並上傳當日場次。'
      });
      activeScheduleNotification = notification;
      notification.on('click', () => {
        focusExistingMainWindow();
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('desktop-schedule-reminder:show');
        }
      });
      notification.on('close', () => {
        if (activeScheduleNotification === notification) activeScheduleNotification = null;
      });
      notification.show();
      return { notificationShown: true, notificationError: '' };
    } catch (error) {
      return {
        notificationShown: false,
        notificationError: error instanceof Error ? error.message : 'Windows 原生通知顯示失敗'
      };
    }
  });
}

// 建立唯一桌面視窗，並以安全的相對路徑載入既有網站入口。
function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: 'Movie Schedule Alarm V1.0',
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    center: true,
    autoHideMenuBar: true,
    backgroundColor: '#07111f',
    icon: path.join(__dirname, '..', 'assets', 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.webContents.setAudioMuted(false);

  Menu.setApplicationMenu(null);

  // 視窗內容完成初次繪製後才顯示，降低啟動時的白色閃爍。
  mainWindow.once('ready-to-show', () => {
    mainWindow?.center();
    mainWindow?.show();
  });

  // 禁止網頁建立新視窗或將外部頁面交由桌面殼層開啟。
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // 僅允許目前載入的本機頁面內導覽，避免桌面視窗被導向遠端網站。
  mainWindow.webContents.on('will-navigate', event => {
    event.preventDefault();
  });

  // Renderer 尚未完成載入時保留最後一個到點 Trigger，載入完成後只補送一次。
  mainWindow.webContents.on('did-finish-load', () => {
    if (!pendingTriggeredPayload || !mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
    const payload = pendingTriggeredPayload;
    pendingTriggeredPayload = null;
    const sentAt = Date.now();
    const debug = alarmCoordinator.recordIpcSend({
      sentAt,
      succeeded: true,
      rendererDestroyed: false,
      rendererWebContentsId: mainWindow.webContents.id
    });
    try {
      mainWindow.webContents.send('desktop-alarm:triggered', { ...payload, debug });
    } catch {
      alarmCoordinator.recordIpcSend({
        sentAt,
        succeeded: false,
        rendererDestroyed: mainWindow.webContents.isDestroyed(),
        rendererWebContentsId: mainWindow.webContents.id
      });
    }
  });

  // 視窗關閉後移除參照，讓 Windows 全視窗關閉流程完整結束應用程式。
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  void mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID);

  // 重複啟動時不建立第二個執行個體，只喚回既有主視窗。
  app.on('second-instance', () => {
    focusExistingMainWindow();
  });

  // Electron 完成初始化後才建立 BrowserWindow。
  app.whenReady().then(() => {
    alarmCoordinator = createAlarmCoordinator({
      getMainWindow: () => mainWindow,
      screen,
      sendTriggered: payload => {
        if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
          return { sent: false, rendererDestroyed: true, rendererWebContentsId: null };
        }
        if (mainWindow.webContents.isLoadingMainFrame()) {
          pendingTriggeredPayload = payload;
          return { sent: false, rendererDestroyed: false, rendererWebContentsId: mainWindow.webContents.id };
        }
        try {
          mainWindow.webContents.send('desktop-alarm:triggered', payload);
          return { sent: true, rendererDestroyed: false, rendererWebContentsId: mainWindow.webContents.id };
        } catch {
          return {
            sent: false,
            rendererDestroyed: mainWindow.webContents.isDestroyed(),
            rendererWebContentsId: mainWindow.webContents.id
          };
        }
      }
    });
    bindDesktopAlarmIpc();
    bindDesktopStartupIpc();
    bindDesktopScheduleReminderIpc();
    powerMonitor.on('resume', () => alarmCoordinator.checkAfterResume());
    powerMonitor.on('unlock-screen', () => alarmCoordinator.checkAfterResume());
    createMainWindow();

    // macOS 重新啟用應用程式且沒有視窗時，沿用同一建立流程。
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

// Windows 關閉全部視窗後完整結束 Electron 程序，不保留背景程序。
app.on('window-all-closed', () => {
  app.quit();
});
