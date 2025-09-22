# Switch Claude CLI

[![npm version](https://badge.fury.io/js/switch-claude-cli.svg)](https://www.npmjs.com/package/switch-claude-cli)
[![GitHub license](https://img.shields.io/github/license/yak33/switch-claude-cli)](https://github.com/yak33/switch-claude-cli/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/yak33/switch-claude-cli)](https://github.com/yak33/switch-claude-cli/issues)
[![GitHub stars](https://img.shields.io/github/stars/yak33/switch-claude-cli)](https://github.com/yak33/switch-claude-cli/stargazers)

A smart Claude API provider switcher that helps you quickly switch between multiple third-party Claude API services.

## ✨ Features

- 🚀 **Smart Detection**: Automatically checks API availability with support for multi-endpoint testing and a retry mechanism.
- ⚡ **Caching**: Caches detection results for 5 minutes to avoid redundant checks.
- 🎯 **Flexible Selection**: Supports automatic selection of a default provider or interactive manual selection.
- 🔧 **Configuration Management**: Full CRUD (Create, Read, Update, Delete) functionality for managing providers.
- 📊 **Verbose Logging**: Optional verbose mode to display detailed response times and error messages.
- 🛡️ **Robust Error Handling**: Comprehensive error handling with user-friendly tips.

## 📦 Installation

### From NPM (Recommended)

```bash
npm install -g switch-claude-cli
```

### From Source

```bash
git clone https://github.com/yak33/switch-claude-cli.git
cd switch-claude-cli
npm install
npm link
```

## 🚀 Quick Start

### 1. First Run After Installation

```bash
switch-claude
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

### Basic Usage

```bash
# Interactively select a provider
switch-claude

# Directly select provider number 1
switch-claude 1

# Only set environment variables without starting claude
switch-claude -e 1
```

### Detection and Caching

```bash
# Force refresh the cache and re-check all providers
switch-claude --refresh

# Show detailed detection info (response time, errors, etc.)
switch-claude -v 1
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

### Help Information

```bash
# Display the full help message
switch-claude --help
```

## 🔧 Command-line Options

| Option                   | Alias | Description                                                 |
| ------------------------ | ----- | ----------------------------------------------------------- |
| `--help`                 | `-h`  | Show help information                                       |
| `--refresh`              | `-r`  | Force cache refresh and re-check all providers              |
| `--verbose`              | `-v`  | Display detailed debugging information                      |
| `--list`                 | `-l`  | List providers without starting the claude CLI              |
| `--env-only`             | `-e`  | Only set environment variables, do not start the claude CLI |
| `--add`                  |       | Add a new provider                                          |
| `--remove <number>`      |       | Remove a provider by its number                             |
| `--set-default <number>` |       | Set a provider as the default by its number                 |
| `--clear-default`        |       | Clear the default provider setting                          |

## 📁 Configuration Files

### Directory Structure

```
~/.switch-claude/
├── providers.json    # API provider configuration
└── cache.json        # Detection result cache
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

- **Configuration Isolation**: Config files are stored in `~/.switch-claude/`, keeping them separate for each user.
- **API Key Protection**: Keys are partially masked (only the first 12 characters are shown) in the console output.
- **File Permissions**: On Unix-like systems, it's recommended to set secure file permissions:
  ```bash
  chmod 700 ~/.switch-claude          # Only owner can access the directory
  chmod 600 ~/.switch-claude/*        # Only owner can read/write files
  ```
- ⚠️ **Rotate API keys** periodically for better security.
- ⚠️ Be **cautious** when sharing your configuration file or screenshots.

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📄 License

[MIT](https://github.com/yak33/switch-claude-cli/blob/main/LICENSE)

## 🆘 FAQ

### Q: How do I add a new provider?

A: Use the `switch-claude --add` command and follow the prompts.

### Q: How do I back up my configuration?

A: Simply copy the `~/.switch-claude/providers.json` file.

### Q: Which platforms are supported?

A: Windows, macOS, and Linux are all supported.

### Q: How do I update the tool?

A: Use `npm update -g switch-claude-cli` (for global install) or `git pull && npm install` (for source install).

### Q: Can I delete the cache file?

A: Yes. Deleting `cache.json` is safe. The tool will simply re-run the availability checks next time.

---

**Project Repository**: [GitHub](https://github.com/yak33/switch-claude-cli)
**Report an Issue**: [Issues](https://github.com/yak33/switch-claude-cli/issues)
**NPM Package**: [switch-claude-cli](https://www.npmjs.com/package/switch-claude-cli)
