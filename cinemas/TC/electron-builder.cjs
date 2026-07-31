const basePackage = require('../../package.json');

// 建立具有 TC 館別品牌、獨立檔名與既有 appId 的 TC V2.0 安裝設定。
module.exports = {
  ...basePackage.build,
  productName: '(TC) Movie Schedule Alarm',
  executableName: '(TC) Movie Schedule Alarm',
  directories: { ...basePackage.build.directories, output: 'release/TC' },
  extraMetadata: {
    productName: '(TC) Movie Schedule Alarm',
    cinemaCode: 'TC',
    version: basePackage.version,
    desktopAppId: 'com.moviealarm.schedule'
  },
  files: [...basePackage.build.files, '!cinemas/MM/**/*'],
  nsis: { ...basePackage.build.nsis, artifactName: '(TC)Movie-Schedule-Alarm-V2.0-Setup.${ext}' }
};
