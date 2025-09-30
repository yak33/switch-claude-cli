# Switch Claude CLI (Japanese)

[![npm version](https://badge.fury.io/js/switch-claude-cli.svg)](https://www.npmjs.com/package/switch-claude-cli)
[![Tests](https://github.com/yak33/switch-claude-cli/actions/workflows/test.yml/badge.svg)](https://github.com/yak33/switch-claude-cli/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/badge/coverage-95.62%25-brightgreen)]()
[![GitHub license](https://img.shields.io/github/license/yak33/switch-claude-cli)](https://github.com/yak33/switch-claude-cli/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/yak33/switch-claude-cli)](https://github.com/yak33/switch-claude-cli/issues)
[![GitHub stars](https://img.shields.io/github/stars/yak33/switch-claude-cli)](https://github.com/yak33/switch-claude-cli/stargazers)

複数のサードパーティ製Claude APIサービスを迅速に切り替えるための、スマートなClaude APIプロバイダー切り替えツールです。

👉 開発の動機については、私のWeChatパブリックアカウントの記事をご覧ください：[我受够了复制粘贴 Claude Code API ，于是写了个工具，3秒自动切换](https://mp.weixin.qq.com/s/5A5eFc-l6GHBu_qxuLdtIQ)

## 📋 ドキュメントと更新

- 📄 **[更新履歴](CHANGELOG.md)** - 全バージョンの更新記録を確認

## ✨ 機能特性

- 🚀 **スマート検出**: APIの可用性を自動検出し、マルチエンドポイントテストとリトライ機構をサポート
- ⚡ **キャッシュ機構**: 5分間検出結果をキャッシュし、重複検出を回避
- 🎯 **柔軟な選択**: デフォルトプロバイダーの自動選択または対話式手動選択をサポート
- 🔧 **設定管理**: プロバイダーの完全なCRUD機能
- 📊 **詳細ログ**: オプションの詳細モードで応答時間とエラー情報を表示
- 🛡️ **エラー処理**: 完全なエラー処理とユーザーフレンドリーなヒント情報
- 🔔 **バージョン更新**: 最新バージョンへの自動更新リマインダー
- 📦 **設定バックアップ**: 設定のエクスポート、インポート、バックアップ、復元をサポート
- 📺 **表示最適化**: 完全なAPI名を表示し、ターミナル幅にスマート適応
- ✨ **TypeScriptリファクタ**: v1.4.0新機能！完全TypeScriptリファクタ、型安全、モジュラーアーキテクチャ
- 📈 **使用統計**: v1.4.0新機能！使用統計を記録し、エクスポートとリセット機能をサポート

## 📦 インストール

### システム要件

- **Node.js**: 18.0.0 以上
- **npm**: 8.0.0 以上（または yarn 1.22+）
- **OS**: Windows、macOS、Linux

### NPMからインストール（推奨）

```bash
npm install -g switch-claude-cli
```


### ソースからインストール

```bash
git clone https://github.com/yak33/switch-claude-cli.git
cd switch-claude-cli
npm install
npm run build
npm link
```

**注意**：v1.4.0からプロジェクトはTypeScriptを使用するため、インストール前にビルドが必要です。

## 🚀 クイックスタート

### 1. インストール後の初回実行

```bash
switch-claude
# またはショートカットコマンドを使用
scl
```

初回実行時、ツールは自動的に以下を行います:

- `~/.switch-claude` に設定ディレクトリを作成します。
- `~/.switch-claude/providers.json` に設定ファイルの例を生成します。
- 設定ファイルを編集するためのコマンドを提供します。

### 2. 設定ファイルの編集

プロンプトに従って設定ファイルを編集します:

```bash
# Windows
notepad "$USERPROFILE\.switch-claude\providers.json"

# macOS
open ~/.switch-claude/providers.json

# Linux
nano ~/.switch-claude/providers.json
```

ファイルの内容を、ご自身の実際のAPIプロバイダー情報に置き換えてください:

```json
[
  {
    "name": "Veloera",
    "baseUrl": "https://zone.veloera.org",
    "key": "sk-your-real-api-key-here",
    "default": true
  },
  {
    "name": "NonoCode",
    "baseUrl": "https://claude.nonocode.cn/api",
    "key": "cr_your-real-api-key-here"
  }
]
```

### 3. 再度実行して開始

```bash
switch-claude
```

## 📖 使用方法

### ショートカットコマンド ⚡

入力を簡素化するため、ツールは `switch-claude` と完全に同等な短いコマンドエイリアス `scl` を提供します：

```bash
# 次のコマンドペアは同等です
switch-claude        <==>  scl
switch-claude 1      <==>  scl 1
switch-claude -v     <==>  scl -v
switch-claude --list <==>  scl --list
```

### 基本的な使い方

```bash
# 対話形式でプロバイダーを選択
switch-claude
# または
scl

# プロバイダー番号1を直接選択
scl 1

# 環境変数のみ設定し、claudeを起動しない
scl -e 1

# バージョンを確認し、更新をチェック
scl --version
```

### 検出とキャッシュ

```bash
# キャッシュを強制的に更新し、すべてのプロバイダーを再チェック
scl --refresh

# 詳細な検出情報（応答時間、エラーなど）を表示
scl -v 1
```

### 設定管理

```bash
# すべてのプロバイダーを一覧表示
switch-claude --list

# 新しいプロバイダーを追加
switch-claude --add

# プロバイダー番号2を削除
switch-claude --remove 2

# プロバイダー番号1をデフォルトに設定
switch-claude --set-default 1

# デフォルト設定をクリア（毎回手動選択が必要になります）
switch-claude --clear-default
```

### 設定バックアップと復元 📦 v1.3.0

```bash
# 設定をファイルにエクスポート（自動的にタイムスタンプを追加）
switch-claude --export

# 指定ファイルにエクスポート
switch-claude --export my-providers.json

# ファイルから設定をインポート（既存設定を置換）
switch-claude --import backup.json

# インポートしてマージ（同名プロバイダーを上書きしない）
switch-claude --import new-providers.json --merge

# システムディレクトリにバックアップ（~/.switch-claude/backups/）
switch-claude --backup

# 全バックアップを表示
switch-claude --list-backups
```

**機能特徴**：

- 🔒 インポート前に元設定を自動バックアップ
- 🔄 マージインポートをサポートし、既存設定の上書きを回避
- 📅 エクスポートファイルにバージョンと時間情報を含む
- 🗑️ 古いバックアップを自動クリーンアップ（最新10個を保持）
- 📁 バックアップは `~/.switch-claude/backups/` ディレクトリに保存

### バージョン更新 🆕 v1.3.0

```bash
# 現在のバージョンを確認し、更新をチェック
switch-claude --version
# または
switch-claude -V

# 手動で更新をチェック
switch-claude --check-update
```

**自動更新リマインダー**：

- 🔔 実行時に新バージョンを自動チェック（6時間ごと）
- 📦 新バージョンがある場合、目立つ黄色枠で通知
- 🚀 便利な更新コマンドを提供

### 使用統計 📊 v1.4.0

```bash
# 使用統計情報を表示
switch-claude --stats

# 統計データをファイルにエクスポート
switch-claude --export-stats
switch-claude --export-stats my-stats.json

# 全統計データをリセット
switch-claude --reset-stats
```

**統計機能特徴**：

- 📈 **コマンド使用統計**：各コマンドの使用頻度と時間を記録
- 🎯 **プロバイダー性能統計**：各APIプロバイダーの成功率と応答時間を追跡
- ⏰ **24時間使用分布**：使用時間分布を視覚化表示
- 🐛 **エラー統計分析**：各種エラータイプを記録・分析
- 📤 **データエクスポート**：統計データのJSONファイルエクスポートをサポート
- 🔄 **データリセット**：全統計データのクリアをサポート

**統計データ保存**：
- 統計データは `~/.switch-claude/stats.json` に保存
- データは自動保存され、手動操作不要
- 再インストールやアップグレード時も統計データは保持

### ヘルプ情報

```bash
# 完全なヘルプメッセージを表示
switch-claude --help
```

## 🔧 コマンドラインオプション

| オプション                   | 短縮形 | 説明                                      |
| ---------------------------- | ------ | ----------------------------------------- |
| `--help`                     | `-h`   | ヘルプ情報を表示                          |
| `--version`                  | `-V`   | バージョン情報を表示し、更新をチェック    |
| `--refresh`                  | `-r`   | キャッシュを強制更新し、全プロバイダーを再検出 |
| `--verbose`                  | `-v`   | 詳細なデバッグ情報を表示                  |
| `--list`                     | `-l`   | プロバイダーのみ一覧表示し、claudeを起動しない |
| `--env-only`                 | `-e`   | 環境変数のみ設定し、claudeを起動しない    |
| `--add`                      |        | 新しいプロバイダーを追加                  |
| `--remove <番号>`            |        | 指定番号のプロバイダーを削除              |
| `--set-default <番号>`       |        | 指定番号のプロバイダーをデフォルトに設定  |
| `--clear-default`            |        | デフォルトプロバイダーをクリア（毎回手動選択） |
| `--check-update`             |        | 手動でバージョン更新をチェック            |
| `--export [ファイル名]`      |        | 設定をファイルにエクスポート              |
| `--import <ファイル名>`      |        | ファイルから設定をインポート              |
| `--merge`                    |        | --importと併用し、マージして置換しない    |
| `--backup`                   |        | 現在の設定をシステムディレクトリにバックアップ |
| `--list-backups`             |        | 全バックアップファイルを一覧表示          |
| `--stats`                    |        | 使用統計情報を表示                        |
| `--export-stats [ファイル名]` |       | 統計データをファイルにエクスポート        |
| `--reset-stats`              |        | 全統計データをリセット                    |

## 📁 設定ファイルの場所

### 設定ディレクトリ構造

```
~/.switch-claude/
├── providers.json    # API設定ファイル
├── cache.json       # 検出結果キャッシュ
├── stats.json       # 使用統計データ (v1.4.0+)
└── backups/         # バックアップファイルディレクトリ
    ├── backup-2024-09-22T10-30-00.json
    └── backup-2024-09-22T14-15-30.json
```

**設定ディレクトリの場所**:

- **Windows**: `C:\Users\YourName\.switch-claude\`
- **macOS**: `/Users/YourName/.switch-claude/`
- **Linux**: `/home/YourName/.switch-claude/`

### providers.json

```json
[
  {
    "name": "プロバイダー名", // 必須：表示名
    "baseUrl": "https://api.url", // 必須：API Base URL
    "key": "your-api-key", // 必須：APIキー（各種形式をサポート）
    "default": true // オプション：デフォルトプロバイダーかどうか
  }
]
```

### 設定セキュリティ

- **自動作成**：初回実行時に設定ディレクトリとサンプルファイルを自動作成
- **ユーザーディレクトリ**：設定ファイルはユーザーホームディレクトリに保存し、権限問題を回避
- **APIキー保護**：表示時に部分的にマスク（最初の12文字のみ表示）
- **キャッシュ分離**：各ユーザーのキャッシュファイルは独立保存

## 🎯 使用シナリオ

### シナリオ1: 安定したメインプロバイダーがある場合

1.  デフォルトプロバイダーを設定:

    ```bash
    switch-claude --set-default 1
    ```

2.  日常的な使用（デフォルトを自動選択）:

    ```bash
    switch-claude
    ```

3.  一時的に他のプロバイダーに切り替え:
    ```bash
    switch-claude 2
    ```

### シナリオ2: 頻繁にプロバイダーを切り替える場合

1.  デフォルト設定をクリア:

    ```bash
    switch-claude --clear-default
    ```

2.  実行するたびに選択画面が表示されます:
    ```bash
    switch-claude
    ```

### シナリオ3: デバッグとテスト

1.  詳細モードですべての情報を確認:

    ```bash
    switch-claude -v --refresh
    ```

2.  環境変数のみ設定し、`claude`を手動で実行:
    ```bash
    switch-claude -e 1
    claude
    ```

## 🔍 API検出の仕組み

このツールは、APIの可用性を保証するために多層的な検出戦略を採用しています:

1.  **軽量チェック**: まず `GET /v1/models` リクエストを試みます。
2.  **機能チェック**: 次に、最小限のトークン数で `POST /v1/messages` リクエストを試みます。
3.  **リトライ機構**: 各エンドポイントは最大3回試行されます。
4.  **タイムアウト制御**: 1回のリクエストは8秒でタイムアウトします。
5.  **エラー分類**: ネットワークエラー、認証エラー、サービスエラーなどを区別します。

## 🗂️ キャッシュの仕組み

- **キャッシュ期間**: 5分間。
- **キャッシュファイル**: 設定ディレクトリ内の `cache.json`。
- **キャッシュ識別子**: `baseUrl` とAPIキーの末尾8文字に基づきます。
- **強制更新**: `--refresh` または `-r` フラグを使用します。

## ❗ エラーハンドリング

### "claude: command not found"

"spawn claude ENOENT" エラーが発生した場合:

1.  **インストールを確認**: 公式の `claude` CLIが正しくインストールされていることを確認してください。
2.  **PATHを確認**: `claude` コマンドがシステムのPATHに含まれていることを確認してください。
3.  **`--env-only` を使用**:
    ```bash
    switch-claude -e 1
    # その後、手動で実行
    claude
    ```

### API接続の問題

一般的なエラーとその解決策:

- **DNS解決失敗**: ネットワーク接続とプロバイダーの `baseUrl` を確認してください。
- **接続拒否**: ファイアウォールの設定やプロキシが必要かどうかを確認してください。
- **接続タイムアウト**: ネットワークの問題か、サービスがダウンしている可能性があります。
- **HTTP 401 Unauthorized**: APIキーが無効か、期限切れです。
- **HTTP 403 Forbidden**: 権限がないか、クォータを使い切っています。

## 🔒 セキュリティ注意事項

### 設定ファイルセキュリティ

- **ユーザーディレクトリ分離**：設定ファイルは `~/.switch-claude/` に保存され、各ユーザー独立
- **自動初期化**：初回実行時に設定ディレクトリとサンプルファイルを自動作成
- **APIキー保護**：表示時に部分的にマスク（最初の12文字のみ表示）
- **ファイル権限**：Unixシステムでは適切なファイル権限の設定を推奨：
  ```bash
  chmod 700 ~/.switch-claude          # 所有者のみディレクトリアクセス可能
  chmod 600 ~/.switch-claude/*        # 所有者のみファイル読み書き可能
  ```

### データセキュリティ

- ✅ 設定ファイルはユーザーディレクトリに保存され、他ユーザーに影響しない
- ✅ キャッシュファイルは独立保存され、競合を回避
- ✅ 機密情報はログに記録されない
- ⚠️ セキュリティ確保のため**APIキーを定期的にローテーション**
- ⚠️ 設定ファイルやスクリーンショットの**共有に注意**

## 🔧 開発

### コード規範

```bash
# ESLintチェックを実行
npm run lint

# ESLint問題を自動修正
npm run lint:fix

# Prettierフォーマットを実行
npm run format

# Prettierフォーマットをチェック
npm run format:check
```

### テスト

```bash
# 全テストを実行
npm test

# ウォッチモード
npm run test:watch

# テストカバレッジ
npm run test:coverage
```

## 🤝 貢献

IssueやPull Requestを歓迎します！

## 📄 ライセンス

MIT License

## 🆘 よくある質問 (FAQ)

### Q: 新しいプロバイダーを追加するには？

A: `switch-claude --add` コマンドを使用し、プロンプトに従ってください。

### Q: 設定をバックアップするには？

A: 複数の方法があります：

- `switch-claude --export` でファイルにエクスポート
- `switch-claude --backup` でシステムディレクトリに自動バックアップ
- 手動で `~/.switch-claude/providers.json` ファイルをコピー

### Q: どのプラットフォームをサポートしていますか？

A: Windows, macOS, Linuxをサポートしています。

### Q: ツールを更新するには？

A: ツールが自動的に更新をリマインドします！以下の方法も使用できます：

- `switch-claude --version` で新バージョンがあるかチェック
- `switch-claude --check-update` で手動更新チェック
- `npm update -g switch-claude-cli` で最新バージョンに更新

### Q: キャッシュファイルは削除しても大丈夫ですか？

A: はい。`cache.json` を削除しても機能に影響せず、次回実行時に再検出するだけです。

---

**プロジェクトアドレス**: [GitHub](https://github.com/yak33/switch-claude-cli)  
**問題報告**: [Issues](https://github.com/yak33/switch-claude-cli/issues)  
**NPMパッケージ**: [switch-claude-cli](https://www.npmjs.com/package/switch-claude-cli)  
**更新履歴**: [CHANGELOG.md](CHANGELOG.md)
