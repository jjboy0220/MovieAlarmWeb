const path = require('node:path');
const { app, BrowserWindow, Menu, Notification, Tray, dialog, ipcMain, powerMonitor, screen } = require('electron');
const { createAlarmCoordinator } = require('./alarmCoordinator.cjs');
const { createSystemVolumeBridge } = require('./systemVolumeBridge.cjs');

const packageMetadata = require('../package.json');
const CINEMA_CODE = String(packageMetadata.cinemaCode || process.argv.find(argument => argument.startsWith('--cinema='))?.split('=')[1] || 'TC').toUpperCase() === 'MM' ? 'MM' : 'TC';
const WINDOWS_APP_USER_MODEL_ID = packageMetadata.desktopAppId || (CINEMA_CODE === 'MM' ? 'com.moviealarm.schedule.mm' : 'com.moviealarm.schedule');
const DESKTOP_PRODUCT_NAME = packageMetadata.productName || 'Movie Schedule Alarm';

let mainWindow = null;
let compactWindow = null;
let alarmCoordinator = null;
let pendingTriggeredPayload = null;
let activeScheduleNotification = null;
let tray = null;
let isQuitting = false;
let closePromptOpen = false;
let monitoringSummary = { waitingCount: 0, playingCount: 0 };
let compactWindowMode = false;
let compactPresentation = null;
let compactAlwaysOnTop = true;
const systemVolumeBridge = createSystemVolumeBridge();

const COMPACT_WINDOW_BOUNDS = Object.freeze({ width: 460, height: 420 });

// 顯示關閉監控確認；只有使用者明確選擇「是」才完整結束背景程序。
async function requestApplicationQuit() {
  if (closePromptOpen) return;
  const activeCount = monitoringSummary.waitingCount + monitoringSummary.playingCount;
  if (activeCount > 0 && mainWindow && !mainWindow.isDestroyed()) {
    closePromptOpen = true;
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '關閉監控軟體',
      message: '目前仍有尚未結束的場次，是否要關閉監控軟體？',
      detail: `等待中 ${monitoringSummary.waitingCount} 場，播放中 ${monitoringSummary.playingCount} 場。關閉後將不再提供背景警報。`,
      buttons: ['否', '是'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    closePromptOpen = false;
    if (result.response !== 1) return;
  }
  isQuitting = true;
  app.quit();
}

// 依目前視窗模式更新系統匣選單，不建立第二個 Tray。
function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: compactWindowMode ? '顯示 Next Movie 小視窗' : '開啟 Movie Schedule Alarm', click: focusExistingMainWindow },
    {
      label: compactWindowMode ? '回到完整視窗' : '開啟 Next Movie 小視窗',
      click: () => setCompactWindowMode(!compactWindowMode)
    },
    { type: 'separator' },
    { label: '結束程式', click: () => void requestApplicationQuit() }
  ]));
}

// 建立唯一 Windows 系統匣圖示與受限操作選單。
function createTray() {
  if (tray) return;
  tray = new Tray(path.join(__dirname, '..', 'assets', 'app-icon.png'));
  tray.setToolTip(DESKTOP_PRODUCT_NAME);
  refreshTrayMenu();
  tray.on('double-click', focusExistingMainWindow);
}

// 依警報及小視窗狀態集中管理最上層模式，避免停止警報時取消小視窗置頂。
function refreshWindowTopmostState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const alarmIsActive = Boolean(alarmCoordinator?.getDebugState?.().alwaysOnTopActive);
  mainWindow.setAlwaysOnTop(alarmIsActive, 'screen-saver');
  if (compactWindow && !compactWindow.isDestroyed()) compactWindow.setAlwaysOnTop(compactAlwaysOnTop, 'floating');
}

// 建立無標題列的小視窗；只接收 Next Movie 顯示資料，不建立 Ticker、Audio 或場次 state。
function createCompactWindow() {
  if (compactWindow && !compactWindow.isDestroyed()) return compactWindow;
  compactWindow = new BrowserWindow({
    width: COMPACT_WINDOW_BOUNDS.width,
    height: COMPACT_WINDOW_BOUNDS.height,
    minWidth: 400,
    minHeight: 300,
    frame: false,
    transparent: true,
    roundedCorners: true,
    hasShadow: false,
    resizable: false,
    show: false,
    alwaysOnTop: compactAlwaysOnTop,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'compactPreload.cjs')
    }
  });
  const workArea = screen.getPrimaryDisplay().workArea;
  compactWindow.setPosition(workArea.x + workArea.width - COMPACT_WINDOW_BOUNDS.width - 16, workArea.y + 16);
  compactWindow.setAlwaysOnTop(compactAlwaysOnTop, 'floating');
  compactWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  compactWindow.webContents.on('will-navigate', event => event.preventDefault());
  compactWindow.once('ready-to-show', () => {
    compactWindow?.show();
    if (compactPresentation) compactWindow?.webContents.send('compact-window:presentation', compactPresentation);
  });
  compactWindow.on('closed', () => { compactWindow = null; });
  void compactWindow.loadFile(path.join(__dirname, 'compact.html'));
  return compactWindow;
}

// 切換完整主視窗與純顯示小視窗，兩者共用主 Renderer 的唯一資料來源。
function setCompactWindowMode(enabled) {
  if (!mainWindow || mainWindow.isDestroyed()) return { enabled: false };
  const nextEnabled = Boolean(enabled);
  if (nextEnabled === compactWindowMode) return { enabled: compactWindowMode };

  if (nextEnabled) {
    createCompactWindow();
    mainWindow.hide();
  } else {
    compactWindow?.destroy();
    mainWindow.show();
    mainWindow.moveTop();
    mainWindow.focus();
  }

  compactWindowMode = nextEnabled;
  refreshTrayMenu();
  mainWindow.webContents.send('desktop-window:compact-mode-changed', { enabled: compactWindowMode });
  return { enabled: compactWindowMode };
}

// 依 Renderer 實際內容高度調整小視窗，並限制在目前螢幕工作區的安全範圍內。
function resizeCompactWindow(contentHeight) {
  if (!compactWindowMode || !compactWindow || compactWindow.isDestroyed()) return { enabled: compactWindowMode };
  const requestedHeight = Number(contentHeight);
  if (!Number.isFinite(requestedHeight)) throw new TypeError('小視窗內容高度必須是有限數字');
  const currentBounds = compactWindow.getBounds();
  const workArea = screen.getDisplayMatching(currentBounds).workArea;
  const maximumHeight = Math.max(300, Math.floor(workArea.height * 0.82));
  const height = Math.min(maximumHeight, Math.max(300, Math.round(requestedHeight)));
  compactWindow.setSize(COMPACT_WINDOW_BOUNDS.width, height, true);
  return { enabled: true, height };
}

// 將既有主視窗還原、顯示並移至最上方，供重複啟動時沿用單一執行個體。
function focusExistingMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (compactWindowMode && compactWindow && !compactWindow.isDestroyed()) {
    compactWindow.show();
    compactWindow.moveTop();
    compactWindow.focus();
    return;
  }
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
    // Checkbox 只反映應用程式是否已建立 Run 項目；Windows 外部停用狀態由 executableWillLaunchAtLogin 另外顯示。
    enabled: Boolean(loginItem.openAtLogin),
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
    const debug = alarmCoordinator.acknowledge(groupKey);
    refreshWindowTopmostState();
    if (compactWindow && !compactWindow.isDestroyed()) compactWindow.webContents.send('compact-window:alarm-stopped');
    return includeWebContentsAudioDebug(debug);
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

// 註冊受限制的 Windows 主音量 IPC，只接受目前主視窗與 0 至 100 的整數百分比。
function bindSystemVolumeIpc() {
  ipcMain.handle('system-volume:get-state', event => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的系統音量讀取來源');
    return systemVolumeBridge.getState();
  });
  ipcMain.handle('system-volume:set', (event, volume) => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的系統音量設定來源');
    if (!Number.isInteger(volume) || volume < 0 || volume > 100) throw new RangeError('系統音量必須是 0 至 100 的整數');
    return systemVolumeBridge.setVolume(volume);
  });
}

// 註冊今日場次原生通知 IPC；通知失敗只回傳 Debug 錯誤，不影響 Renderer Modal。
function bindDesktopScheduleReminderIpc() {
  ipcMain.handle('desktop-schedule-reminder:notify', (event, options = {}) => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的今日場次提醒來源');
    focusExistingMainWindow();
    try {
      if (!Notification.isSupported()) {
        return { notificationShown: false, notificationError: '目前 Windows 環境不支援原生通知' };
      }
      activeScheduleNotification?.close();
      const notificationBody = typeof options?.body === 'string' && options.body.length <= 160
        ? options.body
        : '尚未匯入今日場次表，請開啟程式並上傳當日場次。';
      const notificationKind = options?.kind === 'coverage-exhausted' ? 'coverage-exhausted' : 'daily-missing';
      const notification = new Notification({
        title: DESKTOP_PRODUCT_NAME,
        body: notificationBody
      });
      activeScheduleNotification = notification;
      notification.on('click', () => {
        focusExistingMainWindow();
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('desktop-schedule-reminder:show', { kind: notificationKind });
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

// 只接收關閉保護所需的計數摘要，不在 Main Process 建立第二份場次資料。
function bindDesktopWindowIpc() {
  ipcMain.handle('desktop-window:update-monitoring', (event, summary = {}) => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的監控摘要來源');
    monitoringSummary = {
      waitingCount: Number.isInteger(summary.waitingCount) && summary.waitingCount >= 0 ? summary.waitingCount : 0,
      playingCount: Number.isInteger(summary.playingCount) && summary.playingCount >= 0 ? summary.playingCount : 0
    };
    return monitoringSummary;
  });
  ipcMain.handle('desktop-window:get-compact-mode', event => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的視窗狀態讀取來源');
    return { enabled: compactWindowMode };
  });
  ipcMain.handle('desktop-window:set-compact-mode', (event, enabled) => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的視窗狀態設定來源');
    if (typeof enabled !== 'boolean') throw new TypeError('小視窗狀態必須是 boolean');
    return setCompactWindowMode(enabled);
  });
  ipcMain.handle('desktop-window:resize-compact', (event, contentHeight) => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的小視窗尺寸來源');
    return resizeCompactWindow(contentHeight);
  });
  ipcMain.handle('desktop-window:update-compact-presentation', (event, presentation) => {
    if (!isTrustedSender(event)) throw new Error('拒絕未授權的小視窗顯示資料來源');
    const serialized = JSON.stringify(presentation ?? {});
    if (serialized.length > 50000) throw new RangeError('小視窗顯示資料超出限制');
    compactPresentation = JSON.parse(serialized);
    if (compactWindow && !compactWindow.isDestroyed() && !compactWindow.webContents.isLoadingMainFrame()) {
      compactWindow.webContents.send('compact-window:presentation', compactPresentation);
    }
    return { updated: true };
  });
  ipcMain.handle('compact-window:show-full', event => {
    if (!compactWindow || event.sender !== compactWindow.webContents) throw new Error('拒絕未授權的小視窗操作來源');
    return setCompactWindowMode(false);
  });
  ipcMain.handle('compact-window:resize', (event, contentHeight) => {
    if (!compactWindow || event.sender !== compactWindow.webContents) throw new Error('拒絕未授權的小視窗尺寸來源');
    return resizeCompactWindow(contentHeight);
  });
  ipcMain.handle('compact-window:stop-alarm', event => {
    if (!compactWindow || event.sender !== compactWindow.webContents) throw new Error('拒絕未授權的小視窗警報操作來源');
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('desktop-alarm:stop-requested');
    }
    return { requested: true };
  });
  ipcMain.handle('compact-window:show-context-menu', event => {
    if (!compactWindow || event.sender !== compactWindow.webContents) throw new Error('拒絕未授權的小視窗選單來源');
    const menu = Menu.buildFromTemplate([
      {
        label: '顯示在最上層',
        type: 'radio',
        checked: compactAlwaysOnTop,
        click: () => {
          compactAlwaysOnTop = true;
          refreshWindowTopmostState();
        }
      },
      {
        label: '取消最上層顯示',
        type: 'radio',
        checked: !compactAlwaysOnTop,
        click: () => {
          compactAlwaysOnTop = false;
          refreshWindowTopmostState();
        }
      },
      { type: 'separator' },
      { label: '縮小視窗', click: () => compactWindow?.hide() }
    ]);
    menu.popup({ window: compactWindow });
    return { shown: true };
  });
}

// 建立唯一桌面視窗，並以安全的相對路徑載入既有網站入口。
function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: `${DESKTOP_PRODUCT_NAME} V${app.getVersion()}`,
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    center: true,
    autoHideMenuBar: true,
    backgroundColor: '#07111f',
    icon: path.join(__dirname, '..', 'assets', 'app-icon.png'),
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
    const openedAtLogin = app.isPackaged && Boolean(app.getLoginItemSettings().wasOpenedAtLogin);
    if (!openedAtLogin) mainWindow?.show();
  });

  // 最小化時隱藏到系統匣，背景排程與警報程序持續運作。
  mainWindow.on('minimize', event => {
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('close', event => {
    if (isQuitting) return;
    event.preventDefault();
    void requestApplicationQuit();
  });

  // 禁止網頁建立新視窗或將外部頁面交由桌面殼層開啟。
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // 完整主視窗使用原生右鍵選單切換小視窗或縮小至系統匣，不暴露 Electron API 給頁面。
  mainWindow.webContents.on('context-menu', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    Menu.buildFromTemplate([
      { label: '切換小視窗模式', click: () => setCompactWindowMode(true) },
      { type: 'separator' },
      { label: '縮小視窗', click: () => mainWindow?.hide() }
    ]).popup({ window: mainWindow });
  });

  // 僅允許目前載入的本機頁面內導覽，避免桌面視窗被導向遠端網站。
  mainWindow.webContents.on('will-navigate', event => {
    event.preventDefault();
  });

  // Renderer 尚未完成載入時保留最後一個到點 Trigger，載入完成後只補送一次。
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('desktop-window:compact-mode-changed', { enabled: compactWindowMode });
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

  void mainWindow.loadFile(path.join(__dirname, '..', 'index.html'), { query: { cinema: CINEMA_CODE } });
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
      getMainWindow: () => compactWindowMode && compactWindow && !compactWindow.isDestroyed() ? compactWindow : mainWindow,
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
          if (compactWindowMode && compactWindow && !compactWindow.isDestroyed()) {
            compactWindow.webContents.send('compact-window:alarm', payload);
          }
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
    bindSystemVolumeIpc();
    bindDesktopScheduleReminderIpc();
    bindDesktopWindowIpc();
    powerMonitor.on('resume', () => alarmCoordinator.checkAfterResume());
    powerMonitor.on('unlock-screen', () => alarmCoordinator.checkAfterResume());
    createTray();
    createMainWindow();

    // macOS 重新啟用應用程式且沒有視窗時，沿用同一建立流程。
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

// Windows 關閉全部視窗後完整結束 Electron 程序，不保留背景程序。
app.on('window-all-closed', () => {
  if (isQuitting) app.quit();
});

// Electron 結束前釋放唯一的 Windows Core Audio 橋接程序。
app.on('will-quit', () => systemVolumeBridge.dispose());
