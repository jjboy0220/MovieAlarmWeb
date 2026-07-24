import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const repositoryDirectory = path.resolve(projectDirectory, '..');
const webDirectory = path.join(projectDirectory, 'www');

// 將共用目錄複製到行動版網頁產物，避免維護第二套場次處理原始碼。
async function copySharedDirectory(relativePath) {
  await cp(path.join(repositoryDirectory, relativePath), path.join(webDirectory, relativePath), {
    recursive: true
  });
}

// 遞迴列出 PWA 需要預先快取的靜態檔案，並使用相對網址支援 GitHub Pages 子路徑。
async function listWebFiles(directory, baseDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listWebFiles(absolutePath, baseDirectory));
    } else if (entry.name !== 'service-worker.js') {
      files.push(`./${path.relative(baseDirectory, absolutePath).replaceAll(path.sep, '/')}`);
    }
  }

  return files.sort();
}

// 依現有 TC 圖示產生 PWA 與 iPhone 主畫面需要的尺寸，不建立另一份品牌來源。
async function buildPwaIcons() {
  const iconDirectory = path.join(webDirectory, 'icons');
  const sourceIcon = path.join(repositoryDirectory, 'assets', 'app-icon.png');
  await mkdir(iconDirectory, { recursive: true });

  await Promise.all([
    sharp(sourceIcon).resize(180, 180).png().toFile(path.join(iconDirectory, 'apple-touch-icon.png')),
    sharp(sourceIcon).resize(192, 192).png().toFile(path.join(iconDirectory, 'icon-192.png')),
    sharp(sourceIcon).resize(512, 512).png().toFile(path.join(iconDirectory, 'icon-512.png'))
  ]);
}

// 依完整靜態資產內容建立版本化快取名稱，確保每次部署都能安全汰換舊版離線檔案。
async function buildServiceWorker() {
  const precacheUrls = await listWebFiles(webDirectory);
  const contentHash = createHash('sha256');

  for (const relativeUrl of precacheUrls) {
    contentHash.update(relativeUrl);
    contentHash.update(await readFile(path.join(webDirectory, relativeUrl.slice(2))));
  }

  const template = await readFile(path.join(projectDirectory, 'src', 'service-worker.template.js'), 'utf8');
  const serviceWorker = template
    .replace('__CACHE_NAME__', `tc-pwa-${contentHash.digest('hex').slice(0, 12)}`)
    .replace('__PRECACHE_URLS__', JSON.stringify(precacheUrls, null, 2));

  await writeFile(path.join(webDirectory, 'service-worker.js'), serviceWorker, 'utf8');
}

// 產生只含 TC 設定的 iPhone/PWA 網頁資產，並套用行動版標題、安裝資訊與樣式。
async function buildMobileWebAssets() {
  await rm(webDirectory, { recursive: true, force: true });
  await mkdir(webDirectory, { recursive: true });

  await Promise.all([
    copySharedDirectory('assets'),
    copySharedDirectory('css'),
    copySharedDirectory('js'),
    copySharedDirectory('vendor'),
    copySharedDirectory('cinemas/TC')
  ]);

  const sourceIndex = await readFile(path.join(repositoryDirectory, 'index.html'), 'utf8');
  const iosIndex = sourceIndex
    .replace('width=device-width, initial-scale=1', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .replace('<title>Movie Schedule Alarm V1.2</title>', '<title>(TC) Movie Schedule Alarm V1.0</title>')
    .replace(
      '<meta name="description" content="Movie Schedule Alarm 影城營運場次管理工具">',
      '<meta name="description" content="老虎城威秀影城場次監控 PWA">\n  <meta name="theme-color" content="#071426">\n  <meta name="apple-mobile-web-app-capable" content="yes">\n  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n  <meta name="apple-mobile-web-app-title" content="TC 場次監控">\n  <link rel="manifest" href="manifest.webmanifest">\n  <link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">'
    )
    .replace('<link rel="stylesheet" href="css/alarm.css">', '<link rel="stylesheet" href="css/alarm.css">\n  <link rel="stylesheet" href="css/ios.css">')
    .replace('警報音量（桌面版同步 Windows 主音量）', '警報音量（僅調整 App 警報音量）')
    .replace('Movie Schedule Alarm V1.2 ・ Cinema Operations Toolkit', '(TC) Movie Schedule Alarm V1.0 ・ iPhone / PWA')
    .replace('<script type="module" src="js/app.js"></script>', '<script type="module" src="js/app.js"></script>\n  <script type="module" src="pwa.js"></script>');

  await writeFile(path.join(webDirectory, 'index.html'), iosIndex, 'utf8');
  await cp(path.join(projectDirectory, 'src', 'ios.css'), path.join(webDirectory, 'css', 'ios.css'));
  await cp(path.join(projectDirectory, 'src', 'manifest.webmanifest'), path.join(webDirectory, 'manifest.webmanifest'));
  await cp(path.join(projectDirectory, 'src', 'pwa.js'), path.join(webDirectory, 'pwa.js'));
  await buildPwaIcons();
  await buildServiceWorker();
}

await buildMobileWebAssets();
console.log(`已產生 TC iPhone / PWA 網頁資產：${webDirectory}`);
