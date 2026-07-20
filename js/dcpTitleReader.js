import { createDcpTitleMap } from './dcpTitleMap.js';

const SUPPORTED_DCP_EXTENSIONS = ['.xlsm', '.xlsx', '.xls'];
const MAX_DCP_FILE_BYTES = 30 * 1024 * 1024;

// 在一次性 Web Worker 中解析 DCP 活頁簿，避免大型 XLSM 阻塞或終止 Renderer 主畫面。
function extractDcpRowsInWorker(arrayBuffer) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./dcpTitleWorker.js', import.meta.url));
    worker.addEventListener('message', event => {
      worker.terminate();
      if (event.data?.success) {
        resolve(event.data);
      } else {
        reject(new Error(event.data?.message || 'DCP Worker 無法解析檔案。'));
      }
    }, { once: true });
    worker.addEventListener('error', event => {
      worker.terminate();
      reject(new Error(event.message || 'DCP Worker 載入失敗。'));
    }, { once: true });
    worker.postMessage(arrayBuffer, [arrayBuffer]);
  });
}

// 只讀取指定「現有DCP」工作表的純儲存格值；SheetJS 不執行 VBA、外部連結或公式程式碼。
export async function readDcpTitleWorkbook(file) {
  if (!file) throw new Error('請選擇現有 DCP Excel 檔案。');
  const extension = `.${String(file.name || '').split('.').pop().toLowerCase()}`;
  if (!SUPPORTED_DCP_EXTENSIONS.includes(extension)) throw new Error('DCP 片名資料只支援 .xlsm、.xlsx 或 .xls。');
  if (file.size > MAX_DCP_FILE_BYTES) throw new Error('DCP 檔案超過 30 MB，為避免記憶體不足已停止匯入。');

  try {
    const { sheetName, rows } = await extractDcpRowsInWorker(await file.arrayBuffer());
    return { sheetName, ...createDcpTitleMap(rows) };
  } catch (error) {
    if (error instanceof Error && /找不到/.test(error.message)) throw error;
    throw new Error(`DCP 片名資料讀取失敗：${error instanceof Error ? error.message : '檔案可能損壞或受到密碼保護'}`);
  }
}
