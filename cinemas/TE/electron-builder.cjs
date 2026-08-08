const basePackage = require('../../package.json');

// 建立可與 TC、MM 並存的 TE V2.0 安裝設定，並只打包 TE 使用的館別資產。
module.exports = {
  ...basePackage.build,
  appId: 'com.moviealarm.schedule.te',
  productName: '(TE) Movie Schedule Alarm',
  executableName: '(TE) Movie Schedule Alarm',
  directories: { ...basePackage.build.directories, output: 'release/TE' },
  extraMetadata: {
    name: 'movie-schedule-alarm-te',
    productName: '(TE) Movie Schedule Alarm',
    cinemaCode: 'TE',
    version: '2.0.0',
    desktopAppId: 'com.moviealarm.schedule.te'
  },
  files: [
    ...basePackage.build.files,
    '!cinemas/TC/**/*',
    '!cinemas/MM/**/*',
    '!cinemas/TD/**/*',
    '!assets/hall-voice/c9.mp3',
    '!assets/hall-voice/gc1.mp3',
    '!assets/hall-voice/gc2.mp3',
    '!assets/private-booking-voice/c9.mp3',
    '!assets/private-booking-voice/gc1.mp3',
    '!assets/private-booking-voice/gc2.mp3'
  ],
  nsis: { ...basePackage.build.nsis, artifactName: '(TE)Movie-Schedule-Alarm-V2.0-Setup.${ext}' }
};
