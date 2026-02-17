// Toast通知を表示
function showToast(title, message, type = 'info') {
    const toastEl = document.getElementById('toast');
    const toastTitle = document.getElementById('toast-title');
    const toastBody = document.getElementById('toast-body');
    
    // アイコンを設定
    let icon = '📢';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    toastTitle.textContent = `${icon} ${title}`;
    toastBody.textContent = message;
    
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

// 今すぐ収集
async function collectNow() {
    const btn = event.target.closest('button');
    const originalHTML = btn.innerHTML;
    
    try {
        // ボタンを無効化
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>収集中...';
        
        const response = await fetch('/api/collect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('収集完了', result.message, 'success');
            // 3秒後にページをリロード
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } else {
            showToast('エラー', result.error || '収集に失敗しました', 'error');
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    } catch (error) {
        console.error('Collection error:', error);
        showToast('エラー', 'サーバーとの通信に失敗しました', 'error');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// Discordに送信
async function sendToDiscord(rowIndex) {
    if (!confirm('この情報をアクティブな生徒全員のDiscordに送信しますか？')) {
        return;
    }
    
    const btn = event.target.closest('button');
    const originalHTML = btn.innerHTML;
    
    try {
        // ボタンを無効化
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        
        const response = await fetch('/api/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rowIndex })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('送信完了', result.message, 'success');
            
            // 行を更新
            const row = document.getElementById(`row-${rowIndex}`);
            if (row) {
                row.classList.add('table-success');
                const statusCell = row.querySelector('td:first-child');
                statusCell.innerHTML = '<i class="fas fa-check-circle text-success" title="送信済み"></i>';
                
                const actionCell = row.querySelector('td:last-child');
                actionCell.innerHTML = '<span class="badge bg-success">送信済</span>';
            }
        } else {
            showToast('エラー', result.error || '送信に失敗しました', 'error');
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    } catch (error) {
        console.error('Send error:', error);
        showToast('エラー', 'サーバーとの通信に失敗しました', 'error');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// ページロード時の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');
});
