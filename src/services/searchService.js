require('dotenv').config();
const axios = require('axios');

/**
 * Google Custom Search APIで情報を検索
 * @param {string} query - 検索クエリ
 * @param {number} num - 取得件数
 * @returns {Promise<Array>} 検索結果
 */
async function searchInformation(query, num = 5) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    const searchEngineId = process.env.SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      throw new Error('Google API credentials not configured');
    }

    // デバッグ: APIキーの最初と最後の4文字のみ表示
    console.log(`API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
    console.log(`Search Engine ID: ${searchEngineId}`);

    // 1週間以内の情報のみ取得（dateRestrict: d7 = 過去7日間）
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: searchEngineId,
        q: query,
        num: num,
        dateRestrict: 'd7', // 過去7日間
        lr: 'lang_ja', // 日本語のみ
        sort: 'date' // 日付順
      }
    });

    if (!response.data.items) {
      return [];
    }

    // 結果を整形
    return response.data.items.map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time'] || new Date().toISOString()
    }));
  } catch (error) {
    console.error('Search error:', error.message);
    if (error.response) {
      console.error('API Error:', error.response.data);
    }
    throw error;
  }
}

/**
 * 複数のクエリで情報収集
 * @returns {Promise<Array>} 収集した情報の配列
 */
async function collectVTuberInfo() {
  const queries = [
    'VTuber オーディション 募集',
    'YouTube 仕様変更 最新',
    'X Twitter 仕様変更 配信者',
    'VTuber 活動 ノウハウ',
    'VTuber デビュー 方法'
  ];

  const results = [];
  
  for (const query of queries) {
    try {
      console.log(`Searching: ${query}`);
      const searchResults = await searchInformation(query, 1); // 各クエリ1件ずつ
      
      if (searchResults.length > 0) {
        results.push({
          query: query,
          ...searchResults[0],
          collectedAt: new Date().toISOString(),
          sent: false // 送信済みフラグ
        });
      }
      
      // API制限対策（1秒待機）
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to search "${query}":`, error.message);
    }
  }

  return results;
}

module.exports = {
  searchInformation,
  collectVTuberInfo
};
