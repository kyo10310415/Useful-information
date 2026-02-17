require('dotenv').config();
const express = require('express');
const path = require('path');
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

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Initialize Google Sheets API
initializeSheetsAPI();

// メモリ内データストア（一時的）
let collectedData = [];
let lastCollectionTime = null;

/**
 * 情報収集タスク
 */
async function collectInformationTask() {
  console.log('=== Starting information collection ===');
  try {
    // Google Custom Searchで情報収集
    const results = await collectVTuberInfo();
    
    if (results.length > 0) {
      // スプレッドシートに保存
      await saveCollectedInfo(results);
      
      // メモリにも保存
      collectedData = results;
      lastCollectionTime = new Date();
      
      console.log(`✅ Collected ${results.length} items`);
    } else {
      console.log('⚠️ No new information found');
    }
  } catch (error) {
    console.error('❌ Collection task failed:', error.message);
  }
}

// Routes

/**
 * ダッシュボード - トップページ
 */
app.get('/', async (req, res) => {
  try {
    // スプレッドシートから収集データを取得
    const data = await getCollectedInfo();
    
    res.render('dashboard', {
      data: data,
      lastCollectionTime: lastCollectionTime
    });
  } catch (error) {
    res.status(500).render('error', { error: error.message });
  }
});

/**
 * 手動で情報収集を実行
 */
app.post('/api/collect', async (req, res) => {
  try {
    await collectInformationTask();
    res.json({ success: true, message: '情報収集が完了しました' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 選択した情報をDiscordに送信
 */
app.post('/api/send', async (req, res) => {
  try {
    const { rowIndex } = req.body;
    
    if (!rowIndex) {
      return res.status(400).json({ success: false, error: 'Row index is required' });
    }

    // 収集データを取得
    const allData = await getCollectedInfo();
    const targetInfo = allData.find(item => item.rowIndex === parseInt(rowIndex));
    
    if (!targetInfo) {
      return res.status(404).json({ success: false, error: 'Information not found' });
    }

    // すでに送信済みの場合
    if (targetInfo.sent) {
      return res.status(400).json({ success: false, error: 'Already sent' });
    }

    // 生徒データを取得
    const students = await getStudentData();
    
    // アクティブな生徒に送信
    const successCount = await broadcastToActiveStudents(students, targetInfo);
    
    // 送信済みフラグを更新
    await markAsSent(rowIndex);
    
    res.json({ 
      success: true, 
      message: `${successCount}名の生徒に送信しました`,
      sentCount: successCount
    });
  } catch (error) {
    console.error('Send error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * システム起動時に情報収集を実行
 */
app.post('/api/collect-on-startup', async (req, res) => {
  try {
    console.log('=== Startup collection triggered ===');
    await collectInformationTask();
    res.json({ success: true, message: 'Startup collection completed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ヘルスチェック（Render用）
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    lastCollection: lastCollectionTime
  });
});

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
