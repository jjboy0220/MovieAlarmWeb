importScripts('../vendor/xlsx/xlsx.full.min.js');

// 在獨立 Worker 解析 XLSM／XLSX／XLS，只回傳「現有DCP」工作表的純文字列。
self.addEventListener('message', event => {
  try {
    const workbook = self.XLSX.read(event.data, {
      type: 'array',
      cellDates: false,
      bookVBA: false,
      dense: true
    });
    const sheetName = '現有DCP';
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error('找不到「現有DCP」工作表，請確認是否選擇正確的檔案。');
    const decodedRange = self.XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const safeRange = {
      s: decodedRange.s,
      e: { r: Math.min(decodedRange.e.r, 19999), c: decodedRange.e.c }
    };
    const rows = self.XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
      range: safeRange,
      blankrows: false
    });
    self.postMessage({ success: true, sheetName, rows });
  } catch (error) {
    self.postMessage({
      success: false,
      message: error instanceof Error ? error.message : '檔案可能損壞或受到密碼保護'
    });
  }
});
