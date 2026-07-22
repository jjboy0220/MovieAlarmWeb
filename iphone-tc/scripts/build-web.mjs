import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const repositoryDirectory = path.resolve(projectDirectory, '..');
const webDirectory = path.join(projectDirectory, 'www');

// 將共用目錄複製到 iOS 網頁產物，避免維護第二套場次處理原始碼。
async function copySharedDirectory(relativePath) {
  await cp(path.join(repositoryDirectory, relativePath), path.join(webDirectory, relativePath), {
    recursive: true
  });
}

// 產生只含 TC 設定的 iPhone 網頁資產，並套用 iOS 專用標題與樣式。
async function buildIosWebAssets() {
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
    .replace('<link rel="stylesheet" href="css/alarm.css">', '<link rel="stylesheet" href="css/alarm.css">\n  <link rel="stylesheet" href="css/ios.css">')
    .replace('警報音量（桌面版同步 Windows 主音量）', '警報音量（僅調整 App 警報音量）')
    .replace('Movie Schedule Alarm V1.2 ・ Cinema Operations Toolkit', '(TC) Movie Schedule Alarm V1.0 ・ iPhone App');

  await writeFile(path.join(webDirectory, 'index.html'), iosIndex, 'utf8');
  await cp(path.join(projectDirectory, 'src', 'ios.css'), path.join(webDirectory, 'css', 'ios.css'));
}

await buildIosWebAssets();
console.log(`已產生 TC iPhone 網頁資產：${webDirectory}`);
