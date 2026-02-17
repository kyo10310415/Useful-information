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
      publishedDate: new Date().toISOString()
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
 * Gemini APIで検索（Grounding with Google Search）
 */
async function searchWithGemini(query, num) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    console.log(`[Gemini] Searching: ${query}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      tools: [{
        googleSearch: {}
      }]
    });

    // Gemini APIで検索プロンプト
    const prompt = `
以下の検索クエリに対して、最新の情報を${num}件見つけてください。
各結果について、タイトル、URL、概要（100文字程度）を提供してください。
情報は過去1週間以内のものを優先してください。

検索クエリ: ${query}

JSON形式で以下のように返してください：
[
  {
    "title": "記事のタイトル",
    "url": "https://example.com/article",
    "snippet": "記事の概要（100文字程度）"
  }
]
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSON部分を抽出
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('No JSON found in response');
      return [];
    }

    const results = JSON.parse(jsonMatch[0]);

    return results.map(item => ({
      title: item.title,
      link: item.url,
      snippet: item.snippet,
      publishedDate: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Gemini Search error:', error.message);
    if (error.response) {
      console.error('API Error:', error.response.data);
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
      publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time'] || new Date().toISOString()
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
      publishedDate: item.dateLastCrawled || new Date().toISOString()
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
          collectedAt: new Date().toISOString(),
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
