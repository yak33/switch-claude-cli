# Switch Claude CLI

一个智能的 Claude API Provider 切换工具，帮助你在多个第三方 Claude API 服务之间快速切换。

## ✨ 功能特性

- 🚀 **智能检测**：自动检测 API 可用性，支持多端点测试和重试机制
- ⚡ **缓存机制**：5分钟内缓存检测结果，避免重复检测
- 🎯 **灵活选择**：支持自动选择默认 provider 或交互式手动选择
- 🔧 **配置管理**：完整的 provider 增删改查功能
- 📊 **详细日志**：可选的详细模式显示响应时间和错误信息
- 🛡️ **错误处理**：完善的错误处理和用户友好的提示信息

## 📦 安装

### 从 NPM 安装（推荐）

```bash
npm install -g switch-claude-cli
```

### 从源码安装

```bash
git clone https://github.com/yourusername/switch-claude-cli.git
cd switch-claude-cli
npm install
npm link
```

## 🚀 快速开始

### 1. 创建配置文件

从示例配置文件开始：

```bash
# 复制示例配置文件
cp providers.example.json providers.json

# 或者在 Windows 上：
copy providers.example.json providers.json
```

然后编辑 `providers.json` 文件，替换为你的真实 API 信息：

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

⚠️ **重要**：`providers.json` 包含敏感信息，已被 `.gitignore` 忽略，不会提交到版本控制中。

### 2. 运行工具

```bash
switch-claude
```

## 📖 使用方法

### 基本用法

```bash
# 交互式选择 provider
switch-claude

# 直接选择编号为 1 的 provider
switch-claude 1

# 只设置环境变量，不启动 claude
switch-claude -e 1
```

### 检测和缓存

```bash
# 强制刷新缓存，重新检测所有 provider
switch-claude --refresh

# 显示详细的检测信息（响应时间、错误详情等）
switch-claude -v 1
```

### 配置管理

```bash
# 列出所有 providers
switch-claude --list

# 添加新的 provider
switch-claude --add

# 删除编号为 2 的 provider
switch-claude --remove 2

# 设置编号为 1 的 provider 为默认
switch-claude --set-default 1

# 清除默认设置（每次都需要手动选择）
switch-claude --clear-default
```

### 帮助信息

```bash
# 显示完整帮助
switch-claude --help
```

## 🔧 命令行选项

| 选项 | 简写 | 描述 |
|------|------|------|
| `--help` | `-h` | 显示帮助信息 |
| `--refresh` | `-r` | 强制刷新缓存，重新检测所有 provider |
| `--verbose` | `-v` | 显示详细的调试信息 |
| `--list` | `-l` | 只列出 providers 不启动 claude |
| `--env-only` | `-e` | 只设置环境变量，不启动 claude |
| `--add` | | 添加新的 provider |
| `--remove <编号>` | | 删除指定编号的 provider |
| `--set-default <编号>` | | 设置指定编号的 provider 为默认 |
| `--clear-default` | | 清除默认 provider（每次都需要手动选择） |

## 📁 配置文件格式

### providers.json

```json
[
  {
    "name": "Provider名称",           // 必需：显示名称
    "baseUrl": "https://api.url",     // 必需：API Base URL
    "key": "your-api-key",            // 必需：API Key（支持各种格式）
    "default": true                   // 可选：是否为默认 provider
  }
]
```

### 配置验证

工具会自动验证配置文件：
- ✅ JSON 格式正确性
- ✅ 必需字段完整性
- ✅ URL 格式有效性
- ✅ Provider 名称唯一性
- ✅ API Key 长度检查（至少10个字符）

## 🎯 使用场景

### 场景一：有稳定的主要 Provider

1. 设置一个默认 provider：
```bash
switch-claude --set-default 1
```

2. 日常使用（自动选择默认）：
```bash
switch-claude
```

3. 临时切换到其他 provider：
```bash
switch-claude 2
```

### 场景二：经常切换 Provider

1. 清除默认设置：
```bash
switch-claude --clear-default
```

2. 每次运行都会显示选择界面：
```bash
switch-claude
```

### 场景三：调试和测试

1. 详细模式查看所有信息：
```bash
switch-claude -v --refresh
```

2. 只设置环境变量，手动运行 claude：
```bash
switch-claude -e 1
claude
```

## 🔍 API 检测机制

工具使用多层检测策略确保 API 可用性：

1. **轻量级检测**：首先尝试 `GET /v1/models`
2. **功能性检测**：然后尝试 `POST /v1/messages`（最小 token 请求）
3. **重试机制**：每个端点最多重试 3 次
4. **超时控制**：单次请求超时 8 秒
5. **错误分类**：区分网络错误、认证错误、服务错误等

## 🗂️ 缓存机制

- **缓存时长**：5分钟
- **缓存文件**：`.switch-claude-cache.json`
- **缓存标识**：基于 baseUrl 和 API Key 的后8位
- **强制刷新**：使用 `--refresh` 参数

## ❗ 错误处理

### Claude 命令未找到

如果遇到 "spawn claude ENOENT" 错误：

1. **检查安装**：确保 Claude Code 已正确安装
2. **检查 PATH**：确保 claude 命令在系统 PATH 中
3. **使用 --env-only**：
```bash
switch-claude -e 1
# 然后手动运行
claude
```

### API 连接问题

常见错误及解决方案：

- **DNS解析失败**：检查网络连接和 URL 正确性
- **连接被拒绝**：检查防火墙设置
- **连接超时**：网络问题或服务不可用
- **HTTP 401**：API Key 无效或过期
- **HTTP 403**：权限不足或配额用完

## 🔒 安全注意事项

### 配置文件安全
- **敏感文件保护**：`providers.json` 和 `.switch-claude-cache.json` 已在 `.gitignore` 中被忽略
- **示例配置**：使用 `providers.example.json` 作为配置模板
- **API Key 保护**：显示时会被部分遮码（只显示前12位）
- **文件权限**：在 Unix 系统上建议设置适当的文件权限：
  ```bash
  chmod 600 providers.json  # 仅所有者可读写
  ```

### 开源项目安全
- ✅ 真实 API Key 已从版本控制中排除
- ✅ 缓存文件不会被提交
- ✅ 提供安全的示例配置文件
- ⚠️ **永远不要**将包含真实 API Key 的配置文件提交到版本控制
- ⚠️ **定期轮换** API Key 以确保安全

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🆘 常见问题

### Q: 如何添加新的 provider？
A: 使用 `switch-claude --add` 命令，按提示输入信息。

### Q: 如何备份配置？
A: 直接复制 `providers.json` 文件即可。

### Q: 工具支持哪些平台？
A: 支持 Windows、macOS 和 Linux。

### Q: 如何更新工具？
A: 使用 `npm update -g switch-claude-cli`（全局安装）或 `git pull && npm install`（本地安装）。

### Q: 缓存文件可以删除吗？
A: 可以。删除 `.switch-claude-cache.json` 不会影响功能，只是下次运行会重新检测。

---

**项目地址**: [GitHub Repository](#)
**问题反馈**: [Issues](#)