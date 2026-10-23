require('dotenv').config();
const { loadAccessConfig } = require('./access');
const accessConfig = loadAccessConfig(process.env);
const { createApp } = require('./app');
const cron = require('node-cron');

// Services
const { collectVTuberInfo } = require('./services/searchService');
const { 
  initializeSheetsAPI, 
  getStudentData, 
  saveCollectedInfo, 
  getCollectedInfo,
  markAsSent 
} = require('./services/sheetsService');
const { broadcastToActiveStudents } = require('./services/discordService');

initializeSheetsAPI();
const { app, collectInformationTask } = createApp({ accessConfig, collectVTuberInfo,
  getStudentData, saveCollectedInfo, getCollectedInfo, markAsSent, broadcastToActiveStudents });
const PORT = process.env.PORT || 3000;
// Cron Job - 週1回（月曜日 朝9時）に自動実行
const cronSchedule = process.env.CRON_SCHEDULE || '0 9 * * 1';
cron.schedule(cronSchedule, async () => {
  console.log('=== Scheduled task triggered ===');
  await collectInformationTask();
}, {
  timezone: 'Asia/Tokyo'
});

// サーバー起動時に一度実行（オプション）
// 本番環境ではコメントアウト推奨
// setTimeout(() => {
//   collectInformationTask();
// }, 5000);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════╗
║   VTuber情報収集システム - WannaV         ║
╠════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}           ║
║  Cron: ${cronSchedule} (JST)        ║
║  Status: Running ✓                         ║
╚════════════════════════════════════════════╝
  `);
});

module.exports = app;
