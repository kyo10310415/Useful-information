require('dotenv').config();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

/**
 * Web検索APIで情報を検索（OpenAI/Gemini/Bing/Google対応）
 * @param {string} query - 検索クエリ
 * @param {number} num - 取得件数
 * @returns {Promise<Array>} 検索結果
 */
async function searchInformation(query, num = 5) {
  const searchProvider = process.env.SEARCH_PROVIDER || 'openai';
  
  if (searchProvider === 'openai') {
    return searchWithOpenAI(query, num);
  } else if (searchProvider === 'gemini') {
    return searchWithGemini(query, num);
  } else if (searchProvider === 'bing') {
    return searchWithBing(query, num);
  } else {
    return searchWithGoogle(query, num);
  }
}

/**
 * OpenAI APIで検索（web_search機能）
 */
async function searchWithOpenAI(query, num) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log(`[OpenAI] Searching: ${query}`);

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'あなたはVTuber業界の情報収集アシスタントです。与えられた検索クエリに対して、最新の情報を見つけてJSON形式で返してください。'
        },
        {
          role: 'user',
          content: `以下の検索クエリに対して、最新の情報を${num}件見つけてください。過去1週間以内の情報を優先してください。

検索クエリ: ${query}

JSON形式で以下のように返してください（コードブロックなし、純粋なJSONのみ）：
[
  {
    "title": "記事のタイトル",
    "url": "https://example.com/article",
    "snippet": "記事の概要（100文字程度）"
  }
]`
        }
      ],
      tools: [{
        type: 'web_search'
      }],
      temperature: 0.3
    });

    const responseText = completion.choices[0].message.content;

    // JSON部分を抽出
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('No JSON found in response:', responseText);
      return [];
    }

    const results = JSON.parse(jsonMatch[0]);

    return results.map(item => ({
      title: item.title,
      link: item.url,
      snippet: item.snippet,
      publishedDate: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    }));

  } catch (error) {
    console.error('OpenAI Search error:', error.message);
    if (error.response) {
      console.error('API Error:', error.response.data);
    }
    return [];
  }
}

/**
 * URLが有効かチェック（HEAD リクエスト）
 */
async function validateUrl(url) {
  try {
    // URLの基本的なフォーマットチェック
    if (!url || !url.startsWith('http')) {
      console.log(`[URL Validation] ❌ Invalid format: ${url}`);
      return false;
    }

    console.log(`[URL Validation] Checking: ${url}`);
    
    const response = await axios.head(url, {
      timeout: 8000, // 8秒に延長
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log(`[URL Validation] ✅ Valid (${response.status}): ${url}`);
    return true;
  } catch (error) {
    // HEADが失敗した場合はGETを試行
    try {
      console.log(`[URL Validation] HEAD failed, trying GET: ${url}`);
      const response = await axios.get(url, {
        timeout: 8000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      console.log(`[URL Validation] ✅ Valid via GET (${response.status}): ${url}`);
      return true;
    } catch (getError) {
      console.log(`[URL Validation] ❌ Failed: ${url} - ${getError.message}`);
      return false;
    }
  }
}

/**
 * Gemini APIで検索（Grounding with Google Search）
 */
async function searchWithGemini(query, num) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    console.log(`[Gemini] Searching for VTuber information`);

    // 現在の日付を取得
    const today = new Date();
    const dateStr = today.toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // 1週間前の日付を取得
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // VTuber業界の情報通プロンプト
    const prompt = `あなたは「VTuber業界の事情通」であり、活動者のための敏腕コンサルタントです。

日付: ${dateStr}

その日付を基準とした直近1週間（7日間、${oneWeekAgoStr} 〜 ${dateStr}）の情報をWeb検索し、VTuber活動に役立つ情報を収集してください。

## アクションフロー

1. **日付の特定**: ${dateStr} を基準日とします。

2. **情報収集**: ${oneWeekAgoStr} 〜 ${dateStr} の期間で、以下のトピックに関する最新情報をGoogle検索で収集します。
   - YouTube、X (旧Twitter)、Twitch等のプラットフォームの仕様変更・アルゴリズム更新
   - 大手・注目事務所のVTuberオーディション情報（にじさんじ、ホロライブ、VTA、その他新規プロジェクト）
   - VTuber界隈で流行しているゲーム、ミーム、ハッシュタグ
   - 配信機材やLive2D/3D技術のアップデート情報

3. **選定**: 収集した情報の中から、個人のVTuber活動において「即効性が高い」「対策が必要」なものを重要度順に5つ選定します。

## 出力フォーマット

以下のJSON形式で出力してください（コードブロックやマークダウンなし、純粋なJSONのみ）：

[
  {
    "title": "[見出し：情報のジャンル] タイトル",
    "url": "信頼できる情報源のURL（必ずアクセス可能な実在のもの）",
    "snippet": "【内容】ニュースの要約。【影響】活動者にどのような影響があるか。【対策】具体的にどう動くべきか。"
  }
]

## 制約事項
- 情報は必ず ${oneWeekAgoStr} 〜 ${dateStr} の期間内のものを選ぶこと
- 古い情報（1週間以上前）は絶対に含めないこと
- 必ず実際にWeb検索を実行すること
- 情報は必ず裏付け（ソース）を確認し、憶測で書かないこと
- URLは必ずアクセス可能な実在のものを記載すること
- URLはテキストでコピーできる完全な形式（https://から始まる）で記載すること
- 推測や創作は一切禁止
- 見つからない場合は該当分野の公式サイトURLを使用

検索結果が見つかったURLのみを記載してください。`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        tools: [{
          google_search: {}
        }]
      }
    );

    const text = response.data.candidates[0].content.parts[0].text;
    console.log('[Gemini] Response received, extracting JSON...');

    // JSON部分を抽出
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('No JSON found in response');
      return [];
    }

    const results = JSON.parse(jsonMatch[0]);

    // URL検証とフィルタリング
    console.log('[Gemini] Validating URLs...');
    const validatedResults = [];
    
    for (const item of results) {
      const isValid = await validateUrl(item.url);
      if (isValid) {
        console.log(`✅ Valid URL: ${item.url}`);
        validatedResults.push({
          title: item.title,
          link: item.url,
          snippet: item.snippet,
          publishedDate: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
        });
      } else {
        console.log(`❌ Invalid URL: ${item.url} - Skipping`);
      }
    }

    if (validatedResults.length === 0) {
      console.log('⚠️ No valid URLs found. Using original results.');
      // バリデーションでゼロになった場合は元のデータを返す
      return results.map(item => ({
        title: item.title,
        link: item.url,
        snippet: item.snippet,
        publishedDate: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      }));
    }

    return validatedResults;

  } catch (error) {
    console.error('Gemini Search error:', error.message);
    if (error.response) {
      console.error('API Error:', JSON.stringify(error.response.data, null, 2));
    }
    return [];
  }
}

/**
 * Google Custom Search APIで検索
 */
async function searchWithGoogle(query, num) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    const searchEngineId = process.env.SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      throw new Error('Google API credentials not configured');
    }

    console.log(`[Google] Searching: ${query}`);

    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: searchEngineId,
        q: query,
        num: num,
        dateRestrict: 'd7',
        lr: 'lang_ja',
        sort: 'date'
      }
    });

    if (!response.data.items) {
      return [];
    }

    return response.data.items.map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time'] || new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    }));
  } catch (error) {
    console.error('Google Search error:', error.message);
    if (error.response) {
      console.error('API Error:', error.response.data);
    }
    throw error;
  }
}

/**
 * Bing Web Search APIで検索
 */
async function searchWithBing(query, num) {
  try {
    const apiKey = process.env.BING_API_KEY;

    if (!apiKey) {
      throw new Error('Bing API key not configured');
    }

    console.log(`[Bing] Searching: ${query}`);

    const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
      params: {
        q: query,
        count: num,
        mkt: 'ja-JP',
        freshness: 'Week'
      },
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey
      }
    });

    if (!response.data.webPages?.value) {
      return [];
    }

    return response.data.webPages.value.map(item => ({
      title: item.name,
      link: item.url,
      snippet: item.snippet,
      publishedDate: item.dateLastCrawled || new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    }));
  } catch (error) {
    console.error('Bing Search error:', error.message);
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
  const searchProvider = process.env.SEARCH_PROVIDER || 'openai';
  
  // Geminiの場合は一度に5件取得
  if (searchProvider === 'gemini') {
    try {
      console.log('Collecting VTuber information with Gemini...');
      const results = await searchWithGemini('', 5);
      
      return results.map(item => ({
        query: 'VTuber業界の最新情報',
        ...item,
        collectedAt: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        sent: false
      }));
    } catch (error) {
      console.error('Failed to collect VTuber info:', error.message);
      return [];
    }
  }
  
  // 他のプロバイダー（OpenAI/Bing/Google）は従来通り
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
      const searchResults = await searchInformation(query, 1);
      
      if (searchResults.length > 0) {
        results.push({
          query: query,
          ...searchResults[0],
          collectedAt: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
          sent: false
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
