# Switch Claude CLI (Japanese)

[![npm version](https://badge.fury.io/js/switch-claude-cli.svg)](https://www.npmjs.com/package/switch-claude-cli)
[![GitHub license](https://img.shields.io/github/license/yak33/switch-claude-cli)](https://github.com/yak33/switch-claude-cli/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/yak33/switch-claude-cli)](https://github.com/yak33/switch-claude-cli/issues)
[![GitHub stars](https://img.shields.io/github/stars/yak33/switch-claude-cli)](https://github.com/yak33/switch-claude-cli/stargazers)

複数のサードパーティ製Claude APIサービスを迅速に切り替えるための、スマートなClaude APIプロバイダー切り替えツールです。

## ✨ 主な機能

- 🚀 **スマート検出**: マルチエンドポイントテストとリトライ機構をサポートし、APIの可用性を自動的にチェックします。
- ⚡ **キャッシュ機能**: 検出結果を5分間キャッシュし、冗長なチェックを回避します。
- 🎯 **柔軟な選択**: デフォルトプロバイダーの自動選択、または対話形式での手動選択をサポートします。
- 🔧 **設定管理**: プロバイダーを管理するための完全なCRUD（作成、読み取り、更新、削除）機能。
- 📊 **詳細ログ**: オプションの詳細モードで、応答時間やエラーメッセージを詳しく表示します。
- 🛡️ **堅牢なエラー処理**: ユーザーフレンドリーなヒントを備えた包括的なエラーハンドリング。

## 📦 インストール

### NPMからインストール (推奨)

```bash
npm install -g switch-claude-cli
```

### ソースからインストール

```bash
git clone https://github.com/yak33/switch-claude-cli.git
cd switch-claude-cli
npm install
npm link
```

## 🚀 クイックスタート

### 1. インストール後の初回実行

```bash
switch-claude
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

### 基本的な使い方

```bash
# 対話形式でプロバイダーを選択
switch-claude

# プロバイダー番号1を直接選択
switch-claude 1

# claudeを起動せず、環境変数のみ設定
switch-claude -e 1
```

### 検出とキャッシュ

```bash
# キャッシュを強制的に更新し、すべてのプロバイダーを再チェック
switch-claude --refresh

# 詳細な検出情報（応答時間、エラーなど）を表示
switch-claude -v 1
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

### ヘルプ情報

```bash
# 完全なヘルプメッセージを表示
switch-claude --help
```

## 🔧 コマンドラインオプション

| オプション | エイリアス | 説明 |
|---|---|---|
| `--help` | `-h` | ヘルプ情報を表示します |
| `--refresh` | `-r` | キャッシュを強制更新し、すべてのプロバイダーを再チェックします |
| `--verbose` | `-v` | 詳細なデバッグ情報を表示します |
| `--list` | `-l` | claude CLIを起動せずにプロバイダーを一覧表示します |
| `--env-only` | `-e` | 環境変数を設定するだけで、claude CLIは起動しません |
| `--add` | | 新しいプロバイダーを追加します |
| `--remove <番号>` | | 番号で指定したプロバイダーを削除します |
| `--set-default <番号>` | | 番号で指定したプロバイダーをデフォルトに設定します |
| `--clear-default` | | デフォルトのプロバイダー設定をクリアします |

## 📁 設定ファイル

### ディレクトリ構造

```
~/.switch-claude/
├── providers.json    # APIプロバイダー設定
└── cache.json        # 検出結果のキャッシュ
```

**設定ディレクトリの場所**:
- **Windows**: `C:\Users\YourName\.switch-claude\`
- **macOS**: `/Users/YourName/.switch-claude/`
- **Linux**: `/home/YourName/.switch-claude/`

### providers.json

```json
[
  {
    "name": "ProviderName",        // 必須: 表示名
    "baseUrl": "https://api.url",  // 必須: APIベースURL
    "key": "your-api-key",         // 必須: APIキー（様々な形式をサポート）
    "default": true                // オプション: デフォルトプロバイダーとして設定
  }
]
```

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

## 🔒 セキュリティに関する注意

- **設定の分離**: 設定ファイルは `~/.switch-claude/` に保存され、ユーザーごとに独立しています。
- **APIキーの保護**: コンソール出力では、キーの一部がマスクされます（最初の12文字のみ表示）。
- **ファイル権限**: Unix系システムでは、安全なファイル権限を設定することをお勧めします:
  ```bash
  chmod 700 ~/.switch-claude          # 所有者のみがディレクトリにアクセス可能
  chmod 600 ~/.switch-claude/*        # 所有者のみがファイルを読み書き可能
  ```
- ⚠️ セキュリティ向上のため、**APIキーを定期的にローテーション**してください。
- ⚠️ 設定ファイルやスクリーンショットを共有する際は**注意**してください。

## 🤝 貢献

IssueやPull Requestを歓迎します！

## 📄 ライセンス

[MIT](https://github.com/yak33/switch-claude-cli/blob/main/LICENSE)

## 🆘 よくある質問 (FAQ)

### Q: 新しいプロバイダーを追加するには？
A: `switch-claude --add` コマンドを使用し、プロンプトに従ってください。

### Q: 設定をバックアップするには？
A: `~/.switch-claude/providers.json` ファイルをコピーするだけです。

### Q: どのプラットフォームをサポートしていますか？
A: Windows, macOS, Linuxをサポートしています。

### Q: ツールを更新するには？
A: `npm update -g switch-claude-cli`（グローバルインストールの場合）または `git pull && npm install`（ソースからインストールした場合）を使用してください。

### Q: キャッシュファイルは削除しても大丈夫ですか？
A: はい、安全です。`cache.json` を削除すると、次回実行時に可用性チェックが再度実行されるだけです。

--- 

**プロジェクトリポジトリ**: [GitHub](https://github.com/yak33/switch-claude-cli)
**問題を報告**: [Issues](https://github.com/yak33/switch-claude-cli/issues)
**NPMパッケージ**: [switch-claude-cli](https://www.npmjs.com/package/switch-claude-cli)
