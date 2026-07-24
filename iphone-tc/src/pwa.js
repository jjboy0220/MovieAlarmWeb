const INSTALL_GUIDE_DISMISSED_KEY = 'tcPwa.installGuideDismissed.v1';

// 建立 TC 手機版專用的 PDF 匯入摘要，不改動共用桌面版標記。
function createPdfImportSummary() {
  const pdfInput = document.querySelector('#pdfFileInput');
  const pdfButton = pdfInput?.closest('.file-button');
  if (!pdfButton) return;

  document.body.classList.add('tc-mobile-pwa');
  pdfButton.querySelector('span').textContent = '上傳 PDF 場次表';
  pdfButton.setAttribute('aria-label', '上傳 PDF 場次表');
  pdfButton.setAttribute('title', '上傳 PDF 場次表');

  const excelInput = document.querySelector('#fileInput');
  excelInput?.closest('.file-button')?.classList.add('tc-mobile-hidden');

  const summary = document.createElement('section');
  summary.className = 'mobile-import-summary';
  summary.setAttribute('aria-label', 'PDF 場次表資訊');

  const details = document.createElement('div');
  details.className = 'mobile-import-details';

  const label = document.createElement('span');
  label.className = 'mobile-import-label';
  label.textContent = '已匯入檔案';

  const fileName = document.createElement('strong');
  fileName.id = 'mobileImportedFileName';
  fileName.textContent = '尚未選擇 PDF 場次表';

  const versionLabel = document.createElement('span');
  versionLabel.className = 'mobile-import-label';
  versionLabel.textContent = 'PDF 版本時間';

  const versionTime = document.createElement('time');
  versionTime.id = 'mobilePdfVersionTime';
  versionTime.textContent = '—';

  details.append(label, fileName, versionLabel, versionTime);
  summary.append(pdfButton, details);
  document.querySelector('.layout')?.insertBefore(summary, document.querySelector('#nextMovieCard'));

  document.addEventListener('movie-schedule:pdf-imported', event => {
    const detail = event.detail || {};
    fileName.textContent = detail.fileName || '未提供檔名';
    versionTime.textContent = detail.reportVersionTime || 'PDF 未辨識到版本時間';
    versionTime.dateTime = detail.reportVersionTime?.replace(' ', 'T').replaceAll('/', '-') || '';
  });
}

// 判斷目前是否位於 Capacitor 原生容器，避免顯示只適用 Safari 的 PWA 安裝提示。
function isNativeContainer() {
  return globalThis.Capacitor?.isNativePlatform?.() === true;
}

// 判斷目前是否已從 iPhone 主畫面或其他瀏覽器的獨立 Web App 模式開啟。
function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// 建立不阻擋操作的 iPhone 安裝提示，所有文字均使用安全 DOM API 寫入。
function showInstallGuide() {
  if (isNativeContainer() || isStandaloneMode() || sessionStorage.getItem(INSTALL_GUIDE_DISMISSED_KEY) === 'true') return;

  const guide = document.createElement('aside');
  guide.className = 'pwa-install-guide';
  guide.setAttribute('role', 'note');
  guide.setAttribute('aria-label', '安裝到 iPhone 主畫面');

  const title = document.createElement('strong');
  title.textContent = '安裝 TC 場次監控';

  const description = document.createElement('p');
  description.textContent = 'iPhone 請用 Safari 開啟，點「分享」→「加入主畫面」，並開啟「作為 Web App」。';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = '關閉';
  closeButton.setAttribute('aria-label', '關閉安裝提示');
  closeButton.addEventListener('click', () => {
    sessionStorage.setItem(INSTALL_GUIDE_DISMISSED_KEY, 'true');
    guide.remove();
  });

  guide.append(title, description, closeButton);
  document.body.append(guide);
}

// 註冊唯一的 Service Worker，讓靜態應用程式資產可在離線狀態開啟。
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;

  try {
    await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
  } catch {
    // 部署或瀏覽器不支援時維持線上模式，不阻擋既有場次功能。
  }
}

createPdfImportSummary();
showInstallGuide();
void registerServiceWorker();
