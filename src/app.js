const express = require('express');
const path = require('path');
const { requireAdmin } = require('./access');

// Inject services so tests never initialize Google, Discord, schedulers or listeners.
function createApp({ accessConfig, collectVTuberInfo, getStudentData, saveCollectedInfo,
  getCollectedInfo, markAsSent, broadcastToActiveStudents }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use(requireAdmin(accessConfig));
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: true, limit: '32kb' }));
  app.use(express.static(path.join(__dirname, '../public')));
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));

// メモリ内データストア（一時的）
let collectedData = [];
let lastCollectionTime = null;
let broadcastInProgress = false;

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
    res.status(500).render('error', { error: 'Information could not be loaded' });
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
    res.status(500).json({ success: false, error: 'Operation failed' });
  }
});

/**
 * 選択した情報をDiscordに送信
 */
app.post('/api/send', async (req, res) => {
  if (broadcastInProgress) return res.status(409).json({ success: false, error: 'A broadcast is already running' });
  broadcastInProgress = true;
  try {
    const { rowIndex } = req.body;

    if (!Number.isInteger(rowIndex) || rowIndex < 2 || req.body.confirmed !== true) {
      return res.status(400).json({ success: false, error: 'A valid row index and explicit confirmation are required' });
    }

    // 収集データを取得
    const allData = await getCollectedInfo();
    const targetInfo = allData.find(item => item.rowIndex === rowIndex);

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
    console.log('Admin broadcast completed');

    res.json({
      success: true,
      message: `${successCount}名の生徒に送信しました`,
      sentCount: successCount
    });
  } catch (error) {
    console.error('Send operation failed');
    res.status(500).json({ success: false, error: 'Operation failed' });
  } finally {
    broadcastInProgress = false;
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
    res.status(500).json({ success: false, error: 'Operation failed' });
  }
});


  return { app, collectInformationTask };
}
module.exports = { createApp };
