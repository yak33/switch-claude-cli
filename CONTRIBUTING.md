# Contributing to Switch Claude CLI

感谢你对 Switch Claude CLI 的关注！我们欢迎任何形式的贡献。

## 🚀 快速开始

1. Fork 这个仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启一个 Pull Request

## 📋 贡献指南

### 报告 Bug

如果你发现了 bug，请：

1. 搜索 [Issues](https://github.com/yak33/switch-claude-cli/issues) 确保该问题尚未被报告
2. 创建一个新的 Issue，包含：
   - 详细的错误描述
   - 重现步骤
   - 期望的行为
   - 实际的行为
   - 系统信息（操作系统、Node.js 版本等）

### 建议新功能

我们欢迎新功能建议！请：

1. 在 Issues 中描述你的想法
2. 解释为什么这个功能有用
3. 如果可能，提供实现思路

### 代码贡献

#### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/yak33/switch-claude-cli.git
cd switch-claude-cli

# 安装依赖
npm install

# 本地测试
npm link
switch-claude --help
```

#### 代码规范

- 使用 ES6+ 语法
- 保持代码简洁易读
- 添加必要的注释
- 遵循现有的代码风格

#### 测试

在提交之前，请确保：

```bash
# 测试基本功能
npm test

# 手动测试主要场景
switch-claude --help
switch-claude --list
switch-claude --add
```

#### 提交信息规范

使用语义化的提交信息：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 重构代码
- `test:` 测试相关
- `chore:` 构建/工具相关

示例：

```
feat: add provider health check endpoint
fix: resolve issue with cache file permissions
docs: update installation instructions
```

## 🎯 优先级

我们特别欢迎以下类型的贡献：

### 高优先级

- 🐛 Bug 修复
- 📚 文档改进
- 🔒 安全性增强
- ♿ 可访问性改进

### 中优先级

- ✨ 新功能（请先讨论）
- 🎨 UI/UX 改进
- ⚡ 性能优化

### 低优先级

- 🧹 代码清理
- 📦 依赖更新

## 🤝 行为准则

### 我们的承诺

为了营造一个开放和欢迎的环境，我们承诺：

- 使用包容性语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 专注于对社区最有利的事情
- 对其他社区成员表示同理心

### 不被接受的行为

- 使用性化的语言或图像
- 人身攻击或政治攻击
- 公开或私下的骚扰
- 未经明确许可发布他人的私人信息
- 其他在专业环境中被认为不当的行为

## 💡 需要帮助？

如果你在贡献过程中遇到任何问题：

- 查看我们的 [Issues](https://github.com/yak33/switch-claude-cli/issues)
- 阅读现有的代码和文档
- 创建一个 Issue 寻求帮助

## 📄 许可证

通过贡献代码，你同意你的贡献将在 [MIT License](LICENSE) 下许可。

---

再次感谢你的贡献！🎉
