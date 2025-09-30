# Switch Claude CLI

[![npm version](https://badge.fury.io/js/switch-claude-cli.svg)](https://www.npmjs.com/package/switch-claude-cli)
[![Tests](https://github.com/yak33/switch-claude-cli/actions/workflows/test.yml/badge.svg)](https://github.com/yak33/switch-claude-cli/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/badge/coverage-95.62%25-brightgreen)]()
[![GitHub license](https://img.shields.io/github/license/yak33/switch-claude-cli)](https://github.com/yak33/switch-claude-cli/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/yak33/switch-claude-cli)](https://github.com/yak33/switch-claude-cli/issues)
[![GitHub stars](https://img.shields.io/github/stars/yak33/switch-claude-cli)](https://github.com/yak33/switch-claude-cli/stargazers)

A smart Claude API provider switcher that helps you quickly switch between multiple third-party Claude API services.

👉 For the original motivation behind this project, see this WeChat article (Chinese): [我受够了复制粘贴 Claude Code API ，于是写了个工具，3秒自动切换](https://mp.weixin.qq.com/s/5A5eFc-l6GHBu_qxuLdtIQ)

## 📋 Documentation and Updates

- 📄 **[Changelog](CHANGELOG.md)** - View all version update records

## ✨ Features

- 🚀 **Smart Detection**: Automatically checks API availability with support for multi-endpoint testing and a retry mechanism
- ⚡ **Caching**: Caches detection results for 5 minutes to avoid redundant checks
- 🎯 **Flexible Selection**: Supports automatic selection of a default provider or interactive manual selection
- 🔧 **Configuration Management**: Full CRUD (Create, Read, Update, Delete) functionality for managing providers
- 📊 **Verbose Logging**: Optional verbose mode to display detailed response times and error messages
- 🛡️ **Robust Error Handling**: Comprehensive error handling with user-friendly tips
- 🔔 **Version Updates**: Automatic reminders to update to the latest version
- 📦 **Configuration Backup**: Support for exporting, importing, backing up and restoring configurations
- 📺 **Optimized Display**: Shows complete API names, intelligently adapts to terminal width
- ✨ **TypeScript Refactor**: v1.4.0 New! Complete TypeScript refactor with type safety and modular architecture
- 📈 **Usage Statistics**: v1.4.0 New! Record usage statistics with export and reset functionality

## 📦 Installation

### System Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher (or yarn 1.22+)
- **Operating System**: Windows, macOS, Linux

### From NPM (Recommended)

```bash
npm install -g switch-claude-cli
```

### From Source

```bash
git clone https://github.com/yak33/switch-claude-cli.git
cd switch-claude-cli
npm install
npm run build
npm link
```

**Note**: Starting from v1.4.0, the project uses TypeScript and requires building before installation.

## 🚀 Quick Start

### 1. First Run After Installation

```bash
switch-claude
# Or use the shortcut command
scl
```

On the first run, the tool will automatically:

- Create a configuration directory at `~/.switch-claude`
- Generate an example configuration file at `~/.switch-claude/providers.json`
- Provide the command to edit the configuration file.

### 2. Edit the Configuration File

Edit the configuration file as prompted:

```bash
# Windows
notepad "$USERPROFILE\.switch-claude\providers.json"

# macOS
open ~/.switch-claude/providers.json

# Linux
nano ~/.switch-claude/providers.json
```

Replace the example content with your actual API provider information:

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

### 3. Run Again to Start

```bash
switch-claude
```

## 📖 Usage

### Shortcut Command ⚡

To simplify typing, the tool provides multiple command aliases, fully equivalent to `switch-claude`:

```bash
# The following commands are equivalent
switch-claude        <==>  scl  <==>  ccc
switch-claude 1      <==>  scl 1      <==>  ccc 1
switch-claude -v     <==>  scl -v     <==>  ccc -v
switch-claude --list <==>  scl --list <==>  ccc --list
```

**Alias Descriptions**:
- `switch-claude` - Full command, clear semantics
- `scl` - Switch CLaude abbreviation
- `ccc` - Choose Claude CLI abbreviation

### Basic Usage

```bash
# Interactively select a provider
switch-claude
# Or
scl
# Or
ccc

# Directly select provider number 1
scl 1

# Only set environment variables without starting claude
scl -e 1

# View version and check for updates
scl --version
```

### Detection and Caching

```bash
# Force refresh the cache and re-check all providers
scl --refresh

# Show detailed detection info (response time, errors, etc.)
scl -v 1
```

### Configuration Management

```bash
# List all providers
switch-claude --list

# Add a new provider
switch-claude --add

# Remove provider number 2
switch-claude --remove 2

# Set provider number 1 as the default
switch-claude --set-default 1

# Clear the default setting (requires manual selection every time)
switch-claude --clear-default
```

### Configuration Backup & Restore 📦 v1.3.0

```bash
# Export configuration to file (automatically adds timestamp)
switch-claude --export

# Export to specified file
switch-claude --export my-providers.json

# Import configuration from file (replaces existing configuration)
switch-claude --import backup.json

# Import and merge (doesn't overwrite existing providers with same name)
switch-claude --import new-providers.json --merge

# Backup to system directory (~/.switch-claude/backups/)
switch-claude --backup

# View all backups
switch-claude --list-backups
```

**Features**:

- 🔒 Automatically backs up original configuration before importing
- 🔄 Supports merge import to avoid overwriting existing configurations
- 📅 Export files include version and timestamp information
- 🗑️ Automatically cleans up old backups (keeps latest 10)
- 📁 Backups stored in `~/.switch-claude/backups/` directory

### Version Updates 🆕 v1.3.0

```bash
# View current version and check for updates
switch-claude --version
# or
switch-claude -V

# Manually check for updates
switch-claude --check-update
```

**Automatic Update Reminders**:

- 🔔 Automatically checks for new versions on each run (checks every 6 hours)
- 📦 If a new version is available, displays a prominent yellow border notification
- 🚀 Provides convenient update commands

### Usage Statistics 📊 v1.4.0

```bash
# View usage statistics
switch-claude --stats

# Export statistics data to file
switch-claude --export-stats
switch-claude --export-stats my-stats.json

# Reset all statistics data
switch-claude --reset-stats
```

**Statistics Features**:

- 📈 **Command Usage Stats**: Records frequency and timing of each command usage
- 🎯 **Provider Performance Stats**: Tracks success rate and response time for each API provider
- ⏰ **24-Hour Usage Distribution**: Visualizes usage time distribution
- 🐛 **Error Statistics Analysis**: Records and analyzes various error types
- 📤 **Data Export**: Supports exporting statistics data to JSON files
- 🔄 **Data Reset**: Supports clearing all statistics data

**Statistics Data Storage**:
- Statistics data is stored in `~/.switch-claude/stats.json`
- Data is automatically saved, no manual operation required
- Statistics data is preserved during reinstallation or upgrades

### Help Information

```bash
# Display the full help message
switch-claude --help
```

## 🔧 Command-line Options

| Option                   | Alias | Description                                                 |
| ------------------------ | ----- | ----------------------------------------------------------- |
| `--help`                 | `-h`  | Show help information                                       |
| `--version`              | `-V`  | Show version information and check for updates             |
| `--refresh`              | `-r`  | Force cache refresh and re-check all providers             |
| `--verbose`              | `-v`  | Display detailed debugging information                      |
| `--list`                 | `-l`  | List providers without starting the claude CLI             |
| `--env-only`             | `-e`  | Only set environment variables, do not start the claude CLI |
| `--add`                  |       | Add a new provider                                          |
| `--remove <number>`      |       | Remove a provider by its number                             |
| `--set-default <number>` |       | Set a provider as the default by its number                |
| `--clear-default`        |       | Clear the default provider setting (manual selection required) |
| `--check-update`         |       | Manually check for version updates                         |
| `--export [filename]`    |       | Export configuration to file                               |
| `--import <filename>`    |       | Import configuration from file                             |
| `--merge`                |       | Use with --import to merge instead of replace             |
| `--backup`               |       | Backup current configuration to system directory          |
| `--list-backups`         |       | List all backup files                                      |
| `--stats`                |       | Display usage statistics information                       |
| `--export-stats [filename]` |   | Export statistics data to file                            |
| `--reset-stats`          |       | Reset all statistics data                                  |

## 📁 Configuration Files

### Directory Structure

```
~/.switch-claude/
├── providers.json    # API provider configuration
├── cache.json        # Detection result cache
├── stats.json        # Usage statistics data (v1.4.0+)
└── backups/          # Backup files directory
    ├── backup-2024-09-22T10-30-00.json
    └── backup-2024-09-22T14-15-30.json
```

**Configuration Directory Location**:

- **Windows**: `C:\Users\YourName\.switch-claude\`
- **macOS**: `/Users/YourName/.switch-claude/`
- **Linux**: `/home/YourName/.switch-claude/`

### providers.json

```json
[
  {
    "name": "ProviderName", // Required: Display name
    "baseUrl": "https://api.url", // Required: API Base URL
    "key": "your-api-key", // Required: API Key (supports various formats)
    "default": true // Optional: Set as the default provider
  }
]
```

### Configuration Security

- **Automatic Creation**: Automatically creates configuration directory and example files on first run
- **User Directory**: Configuration files stored in user home directory to avoid permission issues
- **API Key Protection**: Keys are partially masked when displayed (only first 12 characters shown)
- **Cache Isolation**: Each user's cache files are stored independently

## 🎯 Usage Scenarios

### Scenario 1: You have a stable, primary provider

1.  Set a default provider:

    ```bash
    switch-claude --set-default 1
    ```

2.  Daily use (automatically selects the default):

    ```bash
    switch-claude
    ```

3.  Temporarily switch to another provider:
    ```bash
    switch-claude 2
    ```

### Scenario 2: You frequently switch between providers

1.  Clear the default setting:

    ```bash
    switch-claude --clear-default
    ```

2.  The selection interface will appear every time you run the command:
    ```bash
    switch-claude
    ```

### Scenario 3: Debugging and testing

1.  Use verbose mode to see all details:

    ```bash
    switch-claude -v --refresh
    ```

2.  Only set environment variables and run `claude` manually:
    ```bash
    switch-claude -e 1
    claude
    ```

## 🔍 API Detection Mechanism

The tool employs a multi-layered detection strategy to ensure API availability:

1.  **Lightweight Check**: First, it attempts a `GET /v1/models` request.
2.  **Functional Check**: Then, it attempts a `POST /v1/messages` request with a minimal token count.
3.  **Retry Mechanism**: Each endpoint is tried up to 3 times.
4.  **Timeout Control**: A single request will time out after 8 seconds.
5.  **Error Classification**: Differentiates between network errors, authentication errors, service errors, etc.

## 🗂️ Caching Mechanism

- **Cache Duration**: 5 minutes.
- **Cache File**: `cache.json` in the config directory.
- **Cache Identifier**: Based on the `baseUrl` and the last 8 characters of the API key.
- **Force Refresh**: Use the `--refresh` or `-r` flag.

## ❗ Error Handling

### "claude: command not found"

If you encounter a "spawn claude ENOENT" error:

1.  **Check Installation**: Ensure that the official `claude` CLI is correctly installed.
2.  **Check PATH**: Make sure the `claude` command is in your system's PATH.
3.  **Use `--env-only`**:
    ```bash
    switch-claude -e 1
    # Then run it manually
    claude
    ```

### API Connection Issues

Common errors and their solutions:

- **DNS Resolution Failed**: Check your network connection and the provider's `baseUrl`.
- **Connection Refused**: Check your firewall settings or if a proxy is needed.
- **Connection Timeout**: Likely a network issue or the service is down.
- **HTTP 401 Unauthorized**: Your API key is invalid or has expired.
- **HTTP 403 Forbidden**: You don't have permission or have run out of quota.

## 🔒 Security Notes

### Configuration File Security

- **User Directory Isolation**: Configuration files stored in `~/.switch-claude/`, each user independent
- **Automatic Initialization**: Automatically creates configuration directory and example files on first run
- **API Key Protection**: Keys are partially masked when displayed (only first 12 characters shown)
- **File Permissions**: On Unix systems, it's recommended to set appropriate file permissions:
  ```bash
  chmod 700 ~/.switch-claude          # Only owner can access directory
  chmod 600 ~/.switch-claude/*        # Only owner can read/write files
  ```

### Data Security

- ✅ Configuration files stored in user directory, won't affect other users
- ✅ Cache files stored independently, avoiding conflicts
- ✅ Sensitive information not logged
- ⚠️ **Regularly rotate** API keys for security
- ⚠️ Be **cautious** when sharing configuration files or screenshots

## 🔧 Development

### Code Standards

```bash
# Run ESLint checks
npm run lint

# Auto-fix ESLint issues
npm run lint:fix

# Run Prettier formatting
npm run format

# Check Prettier formatting
npm run format:check
```

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Test coverage
npm run test:coverage
```

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📄 License

[MIT](https://github.com/yak33/switch-claude-cli/blob/main/LICENSE)

## 🆘 FAQ

### Q: How do I add a new provider?

A: Use the `switch-claude --add` command and follow the prompts.

### Q: How do I back up my configuration?

A: There are multiple ways:

- Use `switch-claude --export` to export to a file
- Use `switch-claude --backup` to automatically backup to system directory
- Manually copy the `~/.switch-claude/providers.json` file

### Q: Which platforms are supported?

A: Windows, macOS, and Linux are all supported.

### Q: How do I update the tool?

A: The tool will automatically remind you to update! You can also:

- Run `switch-claude --version` to check if there's a new version
- Run `switch-claude --check-update` to manually check for updates
- Use `npm update -g switch-claude-cli` to update to the latest version

### Q: Can I delete the cache file?

A: Yes. Deleting `cache.json` won't affect functionality, it will just re-detect on the next run.

---

**Project Repository**: [GitHub](https://github.com/yak33/switch-claude-cli)  
**Report an Issue**: [Issues](https://github.com/yak33/switch-claude-cli/issues)  
**NPM Package**: [switch-claude-cli](https://www.npmjs.com/package/switch-claude-cli)  
**Changelog**: [CHANGELOG.md](CHANGELOG.md)
