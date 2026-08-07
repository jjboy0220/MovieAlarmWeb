const basePackage = require('../../package.json');

// 建立可與其他影城並存的 TD V1.0 安裝設定，僅打包 TD 專屬館別與語音資產。
module.exports = {
  ...basePackage.build,
  appId: 'com.moviealarm.schedule.td',
  productName: '(TD) Movie Schedule Alarm',
  executableName: '(TD) Movie Schedule Alarm',
  directories: { ...basePackage.build.directories, output: 'release/TD' },
  extraMetadata: {
    name: 'movie-schedule-alarm-td',
    productName: '(TD) Movie Schedule Alarm',
    cinemaCode: 'TD',
    version: '1.0.0',
    desktopAppId: 'com.moviealarm.schedule.td'
  },
  files: [
    ...basePackage.build.files,
    '!cinemas/TC/**/*',
    '!cinemas/MM/**/*',
    '!cinemas/TE/**/*',
    '!assets/hall-voice/**/*',
    '!assets/private-booking-voice/**/*'
  ],
  nsis: { ...basePackage.build.nsis, artifactName: '(TD)Movie-Schedule-Alarm-V1.0-Setup.${ext}' }
};
