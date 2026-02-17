# VTuber情報収集システム - WannaV

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com)

## 📋 概要

VTuber育成スクール「WannaV」向けの情報収集・配信システムです。

VTuber活動に役立つ最新情報（オーディション情報、YouTube/Xの仕様変更など）を自動収集し、指定のDiscordチャンネルに配信します。

## ✨ 主な機能

- 🔍 **自動情報収集**: Google Custom Search APIで週1回自動的に情報を収集
- 📊 **ダッシュボード**: 収集した情報を一覧表示・管理
- 💾 **スプレッドシート連携**: Google Sheetsにデータを自動保存
- 📨 **Discord配信**: アクティブな生徒のDiscordに一括送信
- ✅ **送信管理**: 送信済み情報に自動でマーク
- ⏰ **定期実行**: 毎週月曜日 朝9時（JST）に自動実行

## 🛠️ 技術スタック

- **Backend**: Node.js + Express.js
- **Frontend**: Bootstrap 5 + EJS
- **APIs**: 
  - Google Custom Search API
  - Google Sheets API
  - Discord Webhooks
- **Scheduler**: node-cron
- **Hosting**: Render

## 📦 インストール

### 1. リポジトリのクローン

```bash
git clone https://github.com/kyo10310415/Useful-information.git
cd Useful-information
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、必要な情報を設定します。

```bash
cp .env.example .env
```

`.env` ファイルを編集：

```env
# Google Custom Search API
GOOGLE_API_KEY=your_google_api_key_here
SEARCH_ENGINE_ID=your_search_engine_id_here

# Google Sheets API (Service Account)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
SPREADSHEET_ID=1iqrAhNjW8jTvobkur5N_9r9uUWFHCKqrhxM72X5z-iM

# Server Configuration
PORT=3000
NODE_ENV=production

# Cron Schedule (週1回 月曜日 朝9時)
CRON_SCHEDULE=0 9 * * 1
```

## 🔑 API設定ガイド

### Google Custom Search API

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成（または既存プロジェクトを選択）
3. **APIとサービス** → **ライブラリ** → "Custom Search API" を検索して有効化
4. **認証情報** → **APIキーを作成**
5. [Programmable Search Engine](https://programmablesearchengine.google.com/) で検索エンジンを作成
   - 検索範囲: 「ウェブ全体を検索」を選択
   - **Search Engine ID（CX）** をコピー

**料金**: 
- 無料枠: 100クエリ/日（月3,000クエリ）
- このシステムでの使用量: 週1回 × 5クエリ = 約20クエリ/月（無料枠内）

### Google Sheets API (Service Account)

1. [Google Cloud Console](https://console.cloud.google.com/) で同じプロジェクトを選択
2. **APIとサービス** → **ライブラリ** → "Google Sheets API" を検索して有効化
3. **認証情報** → **認証情報を作成** → **サービスアカウント**
4. サービスアカウントを作成し、**キーを作成**（JSON形式）
5. JSONファイルから以下の情報をコピー：
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`
6. スプレッドシートにService Accountのメールアドレスを共有設定で追加（編集権限）

### Discord Webhook

Discord Webhook URLは、スプレッドシート「❶RAW_生徒様情報」のI列に記載されています。

## 🚀 Renderへのデプロイ

### 手順

1. **Renderアカウント作成**: https://render.com/

2. **New Web Service** をクリック

3. **GitHubリポジトリを接続**: `Useful-information` を選択

4. **設定を入力**:
   - **Name**: `useful-information` (任意)
   - **Region**: Singapore（日本に最も近い）
   - **Branch**: `main`
   - **Root Directory**: (空白)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

5. **環境変数を設定**:
   
   **Environment** タブで以下の変数を追加：
   
   | Key | Value |
   |-----|-------|
   | `GOOGLE_API_KEY` | Google API Key |
   | `SEARCH_ENGINE_ID` | Search Engine ID (CX) |
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service Account Email |
   | `GOOGLE_PRIVATE_KEY` | Private Key（改行を保持） |
   | `SPREADSHEET_ID` | `1iqrAhNjW8jTvobkur5N_9r9uUWFHCKqrhxM72X5z-iM` |
   | `NODE_ENV` | `production` |
   | `CRON_SCHEDULE` | `0 9 * * 1` |

   **重要**: `GOOGLE_PRIVATE_KEY` は改行を含む複数行の値です。Renderでは自動的に処理されます。

6. **Create Web Service** をクリック

7. デプロイが完了したら、URLにアクセスしてダッシュボードを確認

### Renderの制限事項

- **無料プラン**: 
  - 15分間アクセスがないとスリープ状態になります
  - 初回アクセス時は起動に数秒かかります
  - Cron Jobは動作しますが、スリープ中は実行されません

- **推奨**: 
  - 定期実行を確実に行うには有料プラン（$7/月〜）を推奨
  - または、外部サービス（UptimeRobot等）で定期的にヘルスチェックを実行

## 💻 ローカル開発

```bash
# 開発モード（自動リロード）
npm run dev

# 本番モード
npm start
```

アクセス: http://localhost:3000

## 📖 使い方

### ダッシュボード操作

1. **情報収集**:
   - 「今すぐ収集」ボタンをクリックで手動実行
   - 週1回（月曜日 朝9時）に自動実行

2. **Discord送信**:
   - 収集した情報の一覧から送信したい項目を選択
   - 「📨」ボタンをクリック
   - アクティブな生徒全員のDiscordに自動配信

3. **送信状態**:
   - 🟡 黄色い丸: 未送信
   - ✅ 緑色のチェック: 送信済み

### スプレッドシート

- **収集データシート**: 自動作成され、収集した情報が保存されます
- **❶RAW_生徒様情報シート**: 生徒情報と配信先Webhookが管理されています

### Discord送信条件

- D列（会員ステータス）が「アクティブ」の生徒のみ
- I列（お役立ち_WH）にWebhook URLが設定されている生徒のみ
- G列（Discord ID）をメンション

## 📊 システム構成

```
Useful-information/
├── src/
│   ├── server.js                 # メインサーバー
│   └── services/
│       ├── searchService.js      # 情報収集ロジック
│       ├── sheetsService.js      # Google Sheets連携
│       └── discordService.js     # Discord送信ロジック
├── views/
│   ├── dashboard.ejs             # ダッシュボードUI
│   └── error.ejs                 # エラーページ
├── public/
│   ├── css/style.css             # スタイルシート
│   └── js/app.js                 # フロントエンドJS
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 🔧 カスタマイズ

### 検索クエリの変更

`src/services/searchService.js` の `queries` 配列を編集：

```javascript
const queries = [
  'VTuber オーディション 募集',
  'YouTube 仕様変更 最新',
  'X Twitter 仕様変更 配信者',
  'VTuber 活動 ノウハウ',
  'VTuber デビュー 方法'
];
```

### 実行スケジュールの変更

`.env` ファイルの `CRON_SCHEDULE` を変更：

```env
# 毎日午前9時
CRON_SCHEDULE=0 9 * * *

# 毎週月・水・金 午前9時
CRON_SCHEDULE=0 9 * * 1,3,5

# 毎月1日 午前9時
CRON_SCHEDULE=0 9 1 * *
```

Cron形式: `分 時 日 月 曜日`

## 🐛 トラブルシューティング

### Google Sheets APIエラー

- Service Accountのメールアドレスがスプレッドシートに共有されているか確認
- Private Keyの改行が正しく設定されているか確認（`\n` が必要）

### Discord送信エラー

- Webhook URLが有効か確認
- Discord ID形式が正しいか確認（数字のみ）

### 情報収集エラー

- Google API Keyが有効か確認
- Search Engine IDが正しいか確認
- API制限（100クエリ/日）に達していないか確認

## 📝 ライセンス

MIT License

## 👤 開発者

WannaV - VTuber育成スクール

## 📞 サポート

問題が発生した場合は、GitHubのIssuesでお知らせください。

---

**🎉 開発完了日**: 2026年2月17日
