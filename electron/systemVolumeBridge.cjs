const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');

// 依開發模式或 ASAR 封裝模式取得預先編譯的 Windows 音量 Helper 路徑。
function getHelperPath() {
  const developmentPath = path.join(__dirname, 'bin', 'SystemVolumeHelper.exe');
  if (!developmentPath.includes('app.asar')) return developmentPath;
  return developmentPath.replace('app.asar', 'app.asar.unpacked');
}

// 建立單一 Windows Core Audio Helper 程序，讓讀寫請求不依賴 PowerShell 或 SDK。
function createSystemVolumeBridge() {
  let childProcess = null;
  let nextRequestId = 1;
  const pendingRequests = new Map();

  // 將 Helper 回覆配對到原始請求，並解碼安全封裝的錯誤訊息。
  function handleResponse(line) {
    const [requestIdText, status, value = ''] = line.split('|');
    const requestId = Number(requestIdText);
    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    pendingRequests.delete(requestId);
    clearTimeout(pending.timeoutId);
    if (status === 'ok' && Number.isInteger(Number(value))) {
      pending.resolve({ supported: true, volume: Number(value) });
      return;
    }
    let message = 'Windows 系統音量操作失敗';
    try {
      if (value) message = Buffer.from(value, 'base64').toString('utf8');
    } catch {}
    pending.reject(new Error(message));
  }

  // Helper 意外結束時拒絕所有等待中的請求，下一次操作會自動重建程序。
  function handleProcessExit() {
    childProcess = null;
    for (const pending of pendingRequests.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Windows 系統音量 Helper 已停止'));
    }
    pendingRequests.clear();
  }

  // 僅在 Windows 第一次需要讀寫音量時啟動隱藏且無 Shell 權限的預編譯 Helper。
  function ensureProcess() {
    if (process.platform !== 'win32') return null;
    if (childProcess && !childProcess.killed) return childProcess;
    childProcess = spawn(getHelperPath(), [], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore']
    });
    readline.createInterface({ input: childProcess.stdout }).on('line', handleResponse);
    childProcess.once('error', handleProcessExit);
    childProcess.once('exit', handleProcessExit);
    return childProcess;
  }

  // 傳送一筆有逾時保護的受限文字命令，避免系統音訊服務異常時永久等待。
  function request(command, volume) {
    const activeProcess = ensureProcess();
    if (!activeProcess) return Promise.resolve({ supported: false, volume: null });
    const requestId = nextRequestId++;
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error('Windows 系統音量操作逾時'));
      }, 3000);
      pendingRequests.set(requestId, { resolve, reject, timeoutId });
      const suffix = command === 'set' ? `|${volume}` : '';
      activeProcess.stdin.write(`${requestId}|${command}${suffix}\n`);
    });
  }

  return Object.freeze({
    // 讀取 Windows 預設多媒體播放裝置的主音量百分比。
    getState: () => request('get'),
    // 將軟體滑桿百分比寫入 Windows 預設多媒體播放裝置的主音量。
    setVolume: volume => request('set', volume),
    // 應用程式結束時關閉 Helper stdin，使其自然退出並釋放 Core Audio 物件。
    dispose: () => {
      if (childProcess && !childProcess.killed) childProcess.stdin.end();
      childProcess = null;
    }
  });
}

module.exports = { createSystemVolumeBridge };
