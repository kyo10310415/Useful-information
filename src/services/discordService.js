const axios = require('axios');

/**
 * Discord Webhookでメッセージを送信
 * @param {string} webhookUrl - Webhook URL
 * @param {string} discordId - Discord ID（メンション用）
 * @param {object} info - 送信する情報
 */
async function sendToDiscord(webhookUrl, discordId, info) {
  try {
    if (!webhookUrl) {
      throw new Error('Webhook URL is empty');
    }

    // メンション付きメッセージを作成
    const mention = discordId ? `<@${discordId}>` : '';
    
    const message = {
      content: mention,
      embeds: [{
        title: info.title,
        url: info.link,
        description: info.snippet,
        color: 5814783, // 青色
        fields: [
          {
            name: '検索クエリ',
            value: info.query || '-',
            inline: true
          },
          {
            name: '収集日時',
            value: new Date(info.collectedAt).toLocaleString('ja-JP'),
            inline: true
          }
        ],
        footer: {
          text: 'WannaV お役立ち情報'
        },
        timestamp: new Date().toISOString()
      }]
    };

    const response = await axios.post(webhookUrl, message);
    
    if (response.status === 204) {
      console.log('✅ Message sent to Discord');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to send to Discord:', error.message);
    if (error.response) {
      console.error('Discord API Error:', error.response.data);
    }
    throw error;
  }
}

/**
 * アクティブな生徒全員に情報を送信
 * @param {Array} students - 生徒情報の配列
 * @param {object} info - 送信する情報
 * @returns {Promise<number>} 送信成功数
 */
async function broadcastToActiveStudents(students, info) {
  let successCount = 0;
  
  // アクティブな生徒のみフィルタ
  const activeStudents = students.filter(student => student.isActive && student.webhookUrl);
  
  console.log(`Broadcasting to ${activeStudents.length} active students...`);
  
  for (const student of activeStudents) {
    try {
      await sendToDiscord(student.webhookUrl, student.discordId, info);
      successCount++;
      
      // レート制限対策（500ms待機）
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to send to student: ${error.message}`);
    }
  }
  
  console.log(`✅ Sent to ${successCount}/${activeStudents.length} students`);
  return successCount;
}

module.exports = {
  sendToDiscord,
  broadcastToActiveStudents
};
