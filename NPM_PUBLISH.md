# 发布到 NPM 指南

## 📦 NPM 发布流程

### 1. 准备 NPM 账户

```bash
# 注册 NPM 账户（如果没有）
# 访问 https://www.npmjs.com/signup

# 登录 NPM
npm login
# 输入用户名、密码和邮箱
```

### 2. 检查包名可用性

```bash
# 检查包名是否已被占用
npm view switch-claude-cli

# 如果包名已存在，需要修改 package.json 中的 name 字段
# 例如：@yourusername/switch-claude-cli 或 switch-claude-api-cli
```

### 3. 发布前检查

```bash
# 确保所有文件都已提交到 Git
git status
git add .
git commit -m "feat: prepare for npm publication"

# 检查将要发布的文件
npm pack --dry-run

# 应该包含：
# - index.js
# - providers.example.json
# - README.md
# - SECURITY.md
# - package.json
# - LICENSE

# 测试本地安装
npm install -g .
switch-claude --help
npm uninstall -g switch-claude-cli
```

### 4. 发布到 NPM

```bash
# 发布（首次发布）
npm publish

# 如果包名被占用，可以发布到你的命名空间下
npm publish --access public
```

### 5. 版本管理

```bash
# 发布补丁版本（1.0.0 -> 1.0.1）
npm version patch
npm publish

# 发布小版本（1.0.1 -> 1.1.0）
npm version minor
npm publish

# 发布大版本（1.1.0 -> 2.0.0）
npm version major
npm publish
```

## 🚀 发布后验证

### 验证安装

```bash
# 全局安装
npm install -g switch-claude-cli

# 验证命令可用
switch-claude --help

# 验证配置文件提示
switch-claude

# 清理测试
npm uninstall -g switch-claude-cli
```

### 查看包信息

```bash
# 查看包信息
npm view switch-claude-cli

# 查看下载统计
npm view switch-claude-cli --json
```

## 📊 包管理最佳实践

### 1. 语义化版本

- **1.0.0** - 首次稳定版本
- **1.0.1** - 补丁版本（bug 修复）
- **1.1.0** - 小版本（新功能，向后兼容）
- **2.0.0** - 大版本（破坏性更改）

### 2. 发布前清单

- [ ] 更新版本号
- [ ] 更新 CHANGELOG.md
- [ ] 测试所有功能
- [ ] 检查依赖安全性
- [ ] 验证文档正确性

### 3. 维护计划

- 定期更新依赖
- 监控安全漏洞
- 响应用户反馈
- 维护文档更新

## ⚠️ 注意事项

### 包名建议

如果 `switch-claude-cli` 已被占用，可以考虑：
- `claude-api-switcher`
- `claude-provider-cli`
- `multi-claude-cli`
- `@yourusername/switch-claude-cli`（命名空间包）

### 发布安全

- 确保 `.npmignore` 或 `package.json` 的 `files` 字段正确
- 不要包含敏感文件
- 使用 2FA 保护 NPM 账户

### 许可证

- 已添加 MIT 许可证
- 允许商业和个人使用
- 需要保留版权声明

发布成功后，用户就可以通过 `npm install -g switch-claude-cli` 安装你的工具了！🎉