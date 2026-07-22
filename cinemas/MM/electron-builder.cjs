const basePackage = require('../../package.json');

// 建立可與 TC 並存的 MM V1.0 安裝設定，使用獨立產品識別與輸出資料夾。
module.exports = {
  ...basePackage.build,
  appId: 'com.moviealarm.schedule.mm',
  productName: '(MM) Movie Schedule Alarm',
  executableName: '(MM) Movie Schedule Alarm',
  directories: { ...basePackage.build.directories, output: 'release/MM' },
  extraMetadata: {
    name: 'movie-schedule-alarm-mm',
    productName: '(MM) Movie Schedule Alarm',
    cinemaCode: 'MM',
    version: '1.0.0',
    desktopAppId: 'com.moviealarm.schedule.mm'
  },
  files: [...basePackage.build.files, '!cinemas/TC/**/*', '!assets/hall-voice/gc1.mp3', '!assets/hall-voice/gc2.mp3'],
  nsis: { ...basePackage.build.nsis, artifactName: '(MM)Movie-Schedule-Alarm-V1.0-Setup.${ext}' }
};
