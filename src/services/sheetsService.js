require('dotenv').config();
const { google } = require('googleapis');

// Google Sheets API設定
let sheets;

/**
 * Google Sheets APIの初期化
 */
function initializeSheetsAPI() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets API initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Google Sheets API:', error.message);
  }
}

/**
 * スプレッドシートから生徒情報を取得
 * @returns {Promise<Array>} 生徒情報の配列
 */
async function getStudentData() {
  try {
    if (!sheets) {
      throw new Error('Google Sheets API not initialized');
    }

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const range = '❶RAW_生徒様情報!A:I';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return [];
    }

    // ヘッダー行を取得
    const headers = rows[0];
    const dataRows = rows.slice(1);

    // データを整形
    return dataRows.map(row => ({
      status: row[3] || '', // D列: 会員ステータス
      discordId: row[6] || '', // G列: Discord ID
      webhookUrl: row[8] || '', // I列: お役立ち_WH
      isActive: (row[3] || '').trim() === 'アクティブ'
    }));
  } catch (error) {
    console.error('Failed to get student data:', error.message);
    return [];
  }
}

/**
 * 収集した情報をスプレッドシートに保存
 * シート名: 収集データ（自動作成）
 * @param {Array} data - 保存するデータ
 */
async function saveCollectedInfo(data) {
  try {
    if (!sheets) {
      throw new Error('Google Sheets API not initialized');
    }

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetName = '収集データ';

    // シートの存在確認・作成
    try {
      await sheets.spreadsheets.get({
        spreadsheetId,
        ranges: [sheetName]
      });
    } catch {
      // シートが存在しない場合は作成
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: { title: sheetName }
            }
          }]
        }
      });
    }

    // ヘッダー行
    const headers = ['収集日時', 'タイトル', 'URL', '概要', '検索クエリ', '送信済み'];
    
    // データ行
    const rows = data.map(item => [
      item.collectedAt,
      item.title,
      item.link,
      item.snippet,
      item.query,
      item.sent ? '✓' : ''
    ]);

    // 既存データを取得
    let existingData = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:F`
      });
      existingData = response.data.values || [];
    } catch (error) {
      // データがない場合は空配列
    }

    // ヘッダーがない場合は追加
    if (existingData.length === 0) {
      existingData = [headers];
    }

    // 新規データを追加
    const allRows = [...existingData, ...rows];

    // スプレッドシートに書き込み
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      resource: {
        values: allRows
      }
    });

    console.log(`✅ Saved ${rows.length} items to spreadsheet`);
  } catch (error) {
    console.error('Failed to save collected info:', error.message);
    throw error;
  }
}

/**
 * 収集データをスプレッドシートから取得
 * @returns {Promise<Array>} 収集データの配列
 */
async function getCollectedInfo() {
  try {
    if (!sheets) {
      throw new Error('Google Sheets API not initialized');
    }

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetName = '収集データ';
    const range = `${sheetName}!A:F`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return [];
    }

    // データ行（ヘッダーを除く）
    const dataRows = rows.slice(1);

    return dataRows.map((row, index) => ({
      rowIndex: index + 2, // スプレッドシートの行番号（1-indexed + header）
      collectedAt: row[0] || '',
      title: row[1] || '',
      link: row[2] || '',
      snippet: row[3] || '',
      query: row[4] || '',
      sent: row[5] === '✓'
    }));
  } catch (error) {
    console.error('Failed to get collected info:', error.message);
    return [];
  }
}

/**
 * 送信済みフラグを更新
 * @param {number} rowIndex - 行番号
 */
async function markAsSent(rowIndex) {
  try {
    if (!sheets) {
      throw new Error('Google Sheets API not initialized');
    }

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetName = '収集データ';
    const range = `${sheetName}!F${rowIndex}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: {
        values: [['✓']]
      }
    });

    console.log(`✅ Marked row ${rowIndex} as sent`);
  } catch (error) {
    console.error('Failed to mark as sent:', error.message);
    throw error;
  }
}

module.exports = {
  initializeSheetsAPI,
  getStudentData,
  saveCollectedInfo,
  getCollectedInfo,
  markAsSent
};
