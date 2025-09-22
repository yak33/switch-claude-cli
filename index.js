#!/usr/bin/env node

import fs from "fs";
import path from "path";
import os from "os";
import inquirer from "inquirer";
import { spawn } from "child_process";

// 配置目录和文件路径
const configDir = path.join(os.homedir(), '.switch-claude');
const configPath = path.join(configDir, 'providers.json');
const cacheFile = path.join(configDir, 'cache.json');
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟

// 进度显示工具
class ProgressIndicator {
  constructor(total, message = "正在处理") {
    this.total = total;
    this.completed = 0;
    this.message = message;
    this.spinners = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
    this.spinnerIndex = 0;
    this.completedItems = [];
    this.interval = null;
    this.lastLine = '';
  }

  start() {
    if (process.stdout.isTTY) {
      this.interval = setInterval(() => {
        this.render();
      }, 100);
    }
    this.render();
  }

  update(completedItem = null) {
    if (completedItem) {
      this.completedItems.push(completedItem);
    }
    this.completed++;
    this.render();
  }

  render() {
    const spinner = this.spinners[this.spinnerIndex % this.spinners.length];
    this.spinnerIndex++;

    let line = `🔍 ${this.message}... ${spinner} [${this.completed}/${this.total}]`;

    if (this.completedItems.length > 0) {
      const recentItems = this.completedItems.slice(-3).join(', ');
      if (this.completedItems.length > 3) {
        line += ` 已完成: ...${recentItems}`;
      } else {
        line += ` 已完成: ${recentItems}`;
      }
    }

    if (process.stdout.isTTY) {
      // TTY环境：清除上一行并打印新行
      if (this.lastLine) {
        process.stdout.write('\r' + ' '.repeat(this.lastLine.length) + '\r');
      }
      process.stdout.write(line);
      this.lastLine = line;
    } else {
      // 非TTY环境：每2个完成项显示一次状态
      if (this.completed % 2 === 0 || this.completed === this.total) {
        console.log(line);
      }
    }
  }

  finish(finalMessage = null) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (process.stdout.isTTY) {
      // TTY环境：清除进度行
      process.stdout.write('\r' + ' '.repeat(this.lastLine.length) + '\r');
      if (finalMessage) {
        console.log(finalMessage);
      }
    } else {
      // 非TTY环境：显示完成信息
      if (finalMessage) {
        console.log(finalMessage);
      }
    }
  }
}

// 确保配置目录存在
function ensureConfigDir() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`✅ 已创建配置目录: ${configDir}`);
  }
}

function showWelcomeAndHelp() {
  console.log(`🎉 欢迎使用 Switch Claude CLI！`);
  console.log(`\n📚 Switch Claude CLI - Claude API Provider 切换工具

用法:
  switch-claude [选项] [编号]

选项:
  -h, --help          显示帮助信息
  -r, --refresh       强制刷新缓存，重新检测所有 provider
  -v, --verbose       显示详细的调试信息
  -l, --list          只列出 providers 不启动 claude
  -e, --env-only      只设置环境变量，不启动 claude
  --add               添加新的 provider
  --remove <编号>     删除指定编号的 provider
  --set-default <编号> 设置指定编号的 provider 为默认
  --clear-default     清除默认 provider（每次都需要手动选择）

参数:
  编号                直接选择指定编号的 provider（跳过交互选择）

示例:
  switch-claude           # 交互式选择
  switch-claude 1         # 直接选择编号为 1 的 provider
  switch-claude --refresh # 强制刷新缓存后选择
  switch-claude -v 2      # 详细模式选择编号为 2 的 provider
  switch-claude --list    # 只列出所有 providers
  switch-claude --add     # 添加新的 provider
  switch-claude --remove 2 # 删除编号为 2 的 provider
  switch-claude --set-default 1 # 设置编号为 1 的 provider 为默认
  switch-claude --clear-default  # 清除默认设置
  switch-claude -e 1      # 只设置环境变量，不启动 claude`);
}

function loadCache() {
  try {
    if (!fs.existsSync(cacheFile)) return {};
    const cache = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
    return cache.timestamp && (Date.now() - cache.timestamp < CACHE_DURATION) ? cache.results : {};
  } catch {
    return {};
  }
}

function saveCache(results) {
  try {
    fs.writeFileSync(cacheFile, JSON.stringify({
      timestamp: Date.now(),
      results: results
    }));
  } catch (error) {
    console.warn("⚠️ 缓存保存失败:", error.message);
  }
}

function validateConfig(providers) {
  if (!Array.isArray(providers)) {
    throw new Error("配置文件格式错误：providers 必须是数组");
  }

  if (providers.length === 0) {
    throw new Error("配置文件为空：至少需要一个 provider");
  }

  const errors = [];
  const names = new Set();

  providers.forEach((provider, index) => {
    if (!provider || typeof provider !== 'object') {
      errors.push(`Provider [${index}]: 必须是对象`);
      return;
    }

    if (!provider.name || typeof provider.name !== 'string') {
      errors.push(`Provider [${index}]: 缺少有效的 name 字段`);
    } else if (names.has(provider.name)) {
      errors.push(`Provider [${index}]: name "${provider.name}" 重复`);
    } else {
      names.add(provider.name);
    }

    if (!provider.baseUrl || typeof provider.baseUrl !== 'string') {
      errors.push(`Provider [${index}]: 缺少有效的 baseUrl 字段`);
    } else {
      try {
        const url = new URL(provider.baseUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push(`Provider [${index}]: baseUrl 必须是 HTTP 或 HTTPS 协议`);
        }
      } catch {
        errors.push(`Provider [${index}]: baseUrl 格式无效`);
      }
    }

    if (!provider.key || typeof provider.key !== 'string') {
      errors.push(`Provider [${index}]: 缺少有效的 key 字段`);
    } else if (provider.key.length < 10) {
      errors.push(`Provider [${index}]: key 长度太短，请检查是否完整`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`配置验证失败：\n${errors.join('\n')}`);
  }

  return true;
}

async function createExampleConfig() {
  const exampleConfig = [
    {
      "name": "Provider1",
      "baseUrl": "https://api.example1.com",
      "key": "sk-your-api-key-here-replace-with-real-key",
      "default": true
    },
    {
      "name": "Provider2",
      "baseUrl": "https://api.example2.com",
      "key": "cr_your-api-key-here-replace-with-real-key",
      "default": false
    }
  ];

  try {
    fs.writeFileSync(configPath, JSON.stringify(exampleConfig, null, 2));
    console.log(`✅ 已创建示例配置文件: ${configPath}`);
    return true;
  } catch (error) {
    console.error(`❌ 创建配置文件失败: ${error.message}`);
    return false;
  }
}

async function interactiveSetup() {
  console.log(`\n🚀 欢迎使用交互式配置向导！\n`);
  console.log(`我们将帮你添加第一个 Claude API Provider。`);
  console.log(`你可以稍后使用 --add 命令添加更多 provider。\n`);

  try {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "请输入 Provider 名称:",
        default: "我的Claude服务",
        validate: input => input.trim() ? true : "名称不能为空"
      },
      {
        type: "input",
        name: "baseUrl",
        message: "请输入 API Base URL:",
        default: "https://api.example.com",
        validate: input => {
          try {
            new URL(input);
            return true;
          } catch {
            return "请输入有效的 URL";
          }
        }
      },
      {
        type: "input",
        name: "key",
        message: "请输入 API Key:",
        validate: input => {
          const trimmed = input.trim();
          if (!trimmed) return "API Key 不能为空";
          if (trimmed.length < 10) return "API Key 长度太短，请检查是否完整";
          return true;
        }
      },
      {
        type: "confirm",
        name: "continueSetup",
        message: "配置完成！是否现在就开始使用?",
        default: true
      }
    ]);

    const newConfig = [{
      name: answers.name.trim(),
      baseUrl: answers.baseUrl.trim(),
      key: answers.key.trim(),
      default: true
    }];

    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    console.log(`\n✅ 配置已保存到: ${configPath}`);

    if (answers.continueSetup) {
      console.log(`\n🎉 配置完成！现在开始检测 API 可用性...\n`);
      return true; // 继续执行主程序
    } else {
      console.log(`\n💡 配置已完成，你可以随时运行 switch-claude 开始使用！`);
      return false; // 退出程序
    }

  } catch (error) {
    if (error.isTtyError || error.name === 'ExitPromptError') {
      console.log(`\n\n⚠️  已取消配置。`);
      console.log(`\n📝 你也可以手动编辑配置文件：`);

      if (process.platform === 'win32') {
        console.log(`   notepad "${configPath}"`);
      } else if (process.platform === 'darwin') {
        console.log(`   open "${configPath}"`);
      } else {
        console.log(`   nano "${configPath}"`);
      }

      console.log(`\n💡 配置完成后，再次运行 switch-claude 即可使用！`);
      return false;
    } else {
      console.error(`❌ 配置过程中出现错误: ${error.message}`);
      return false;
    }
  }
}

async function testProvider(baseUrl, key, retries = 2, verbose = false) {
  // 测试多种模型以支持不同类型的第三方服务
  const testModels = [
    { model: "claude-sonnet-4-20250514", type: "Claude" },
    { model: "gpt-5", type: "GPT" }
  ];

  const supportedModels = [];
  let bestResult = null;

  // 测试每种模型
  for (const modelInfo of testModels) {
    if (verbose) {
      console.log(`    🔍 测试 ${modelInfo.type} 模型: ${modelInfo.model}`);
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        if (verbose) {
          console.log(`    🌐 尝试 POST ${baseUrl}/v1/messages (${modelInfo.type}, 尝试 ${attempt + 1}/${retries + 1})`);
        }

        const options = {
          method: 'POST',
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "User-Agent": "switch-claude-cli/1.0.0"
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: modelInfo.model,
            messages: [{ role: "user", content: "test" }],
            max_tokens: 1
          })
        };

        const res = await fetch(`${baseUrl}/v1/messages`, options);
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        if (verbose) {
          console.log(`    ⏱️  响应时间: ${responseTime}ms, 状态: ${res.status} ${res.statusText}`);
        }

        // 扩展状态码处理：200/400/401/403/422/429 都说明服务可达
        // 200: 成功
        // 400: 请求错误（可能是模型不支持但服务可达）
        // 401: API Key 问题，但服务可用
        // 403: 权限问题，但服务可用
        // 422: 模型不支持，但服务可用
        // 429: 限流，但服务可用
        if (res.ok || [400, 401, 403, 422, 429].includes(res.status)) {
          const isModelSupported = res.ok;

          if (isModelSupported) {
            supportedModels.push(modelInfo.type);
            if (verbose) {
              console.log(`    ✅ ${modelInfo.type} 模型支持`);
            }
          } else if (verbose) {
            console.log(`    ❌ ${modelInfo.type} 模型不支持 (${res.status})`);
          }

          // 记录最好的结果（优先选择成功的）
          if (!bestResult || res.ok) {
            bestResult = {
              available: true,
              status: res.status,
              endpoint: '/v1/messages',
              responseTime,
              supportedModels: [...supportedModels],
              error: res.ok ? null :
                     res.status === 401 ? '认证失败，请检查API Key' :
                     res.status === 403 ? '权限不足，请检查API Key权限' :
                     res.status === 429 ? '请求频率超限，服务可用' :
                     res.status === 400 ? '请求参数错误，可能模型不支持' :
                     res.status === 422 ? '模型不支持' :
                     `HTTP ${res.status}: ${res.statusText}`
            };
          }

          // 如果成功了就跳到下一个模型
          if (res.ok) break;
        } else if (verbose) {
          console.log(`    ❌ 端点失败: ${res.status} ${res.statusText}`);
        }

      } catch (error) {
        const errorMsg = error.name === 'AbortError' ? 'Timeout (8s)' :
                        error.code === 'ENOTFOUND' ? 'DNS解析失败' :
                        error.code === 'ECONNREFUSED' ? '连接被拒绝' :
                        error.code === 'ETIMEDOUT' ? '连接超时' :
                        error.message;

        if (verbose) {
          console.log(`    ❌ 请求失败: ${errorMsg}`);
        }

        // 如果是最后一次尝试且没有任何成功结果，返回错误
        if (attempt === retries && !bestResult) {
          return {
            available: false,
            status: null,
            endpoint: '/v1/messages',
            responseTime: null,
            supportedModels: [],
            error: errorMsg
          };
        }

        if (attempt < retries) {
          if (verbose) {
            console.log(`    ⏳ 等待1秒后重试...`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  }

  // 返回最好的结果，如果没有任何成功就返回失败
  if (bestResult) {
    bestResult.supportedModels = supportedModels;
    return bestResult;
  }

  return {
    available: false,
    status: null,
    endpoint: '/v1/messages',
    responseTime: null,
    supportedModels: [],
    error: 'All models failed'
  };
}

async function main() {
  // 确保配置目录存在
  ensureConfigDir();

  // 解析命令行参数
  const args = process.argv.slice(2);
  const showHelp = args.includes('--help') || args.includes('-h');

  // 如果是帮助命令，直接显示帮助并退出
  if (showHelp) {
    console.log(`
📚 Switch Claude CLI - Claude API Provider 切换工具

用法:
  switch-claude [选项] [编号]

选项:
  -h, --help          显示帮助信息
  -r, --refresh       强制刷新缓存，重新检测所有 provider
  -v, --verbose       显示详细的调试信息
  -l, --list          只列出 providers 不启动 claude
  -e, --env-only      只设置环境变量，不启动 claude
  --add               添加新的 provider
  --remove <编号>     删除指定编号的 provider
  --set-default <编号> 设置指定编号的 provider 为默认
  --clear-default     清除默认 provider（每次都需要手动选择）

参数:
  编号                直接选择指定编号的 provider（跳过交互选择）

示例:
  switch-claude           # 交互式选择
  switch-claude 1         # 直接选择编号为 1 的 provider
  switch-claude --refresh # 强制刷新缓存后选择
  switch-claude -v 2      # 详细模式选择编号为 2 的 provider
  switch-claude --list    # 只列出所有 providers
  switch-claude --add     # 添加新的 provider
  switch-claude --remove 2 # 删除编号为 2 的 provider
  switch-claude --set-default 1 # 设置编号为 1 的 provider 为默认
  switch-claude --clear-default  # 清除默认设置
  switch-claude -e 1      # 只设置环境变量，不启动 claude
`);
    process.exit(0);
  }

  // 首次运行检查
  if (!fs.existsSync(configPath)) {
    showWelcomeAndHelp();
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔧 首次运行，正在初始化配置...`);

    // 询问用户是否使用交互式配置
    try {
      const { useInteractive } = await inquirer.prompt([
        {
          type: "confirm",
          name: "useInteractive",
          message: "是否使用交互式配置向导? (推荐)",
          default: true
        }
      ]);

      if (useInteractive) {
        const shouldContinue = await interactiveSetup();
        if (!shouldContinue) {
          process.exit(0);
        }
        // 如果用户选择继续，程序会继续执行主逻辑
      } else {
        // 用户选择手动配置
        if (createExampleConfig()) {
          console.log(`\n📝 请编辑配置文件，替换为你的真实 API 信息：`);

          if (process.platform === 'win32') {
            console.log(`   notepad "${configPath}"`);
          } else if (process.platform === 'darwin') {
            console.log(`   open "${configPath}"`);
          } else {
            console.log(`   nano "${configPath}"`);
            console.log(`   或者 vim "${configPath}"`);
          }

          console.log(`\n💡 配置完成后，再次运行 switch-claude 即可使用！`);
          process.exit(0);
        } else {
          process.exit(1);
        }
      }
    } catch (error) {
      // 如果交互式询问失败，回退到原来的方式
      if (createExampleConfig()) {
        console.log(`\n📝 请编辑配置文件，替换为你的真实 API 信息：`);

        if (process.platform === 'win32') {
          console.log(`   notepad "${configPath}"`);
        } else if (process.platform === 'darwin') {
          console.log(`   open "${configPath}"`);
        } else {
          console.log(`   nano "${configPath}"`);
          console.log(`   或者 vim "${configPath}"`);
        }

        console.log(`\n💡 配置完成后，再次运行 switch-claude 即可使用！`);
        process.exit(0);
      } else {
        process.exit(1);
      }
    }
  }

  // 加载配置文件
  let providers;
  try {
    const configContent = fs.readFileSync(configPath, "utf-8");
    providers = JSON.parse(configContent);
    validateConfig(providers);
  } catch (error) {
    console.error("❌ 配置文件错误：");
    if (error instanceof SyntaxError) {
      console.error("JSON 格式错误，请检查文件语法");
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }

  // 解析其他命令行参数
  const forceRefresh = args.includes('--refresh') || args.includes('-r');
  const verbose = args.includes('--verbose') || args.includes('-v');
  const listProviders = args.includes('--list') || args.includes('-l');
  const addProvider = args.includes('--add');
  const removeProvider = args.includes('--remove');
  const setDefault = args.includes('--set-default');
  const clearDefault = args.includes('--clear-default');
  const envOnly = args.includes('--env-only') || args.includes('-e');
  const providerIndex = args.find(arg => !arg.startsWith('-') && !isNaN(parseInt(arg)));

  console.log("📋 可用的第三方列表：\n");
  providers.forEach((p, i) => {
    console.log(`[${i + 1}] ${p.name} (${p.baseUrl})${p.default ? " ⭐默认" : ""}`);
  });

  // 处理配置管理命令
  if (listProviders) {
    process.exit(0);
  }

  if (addProvider) {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Provider 名称:",
        validate: input => input.trim() ? true : "名称不能为空"
      },
      {
        type: "input",
        name: "baseUrl",
        message: "API Base URL:",
        validate: input => {
          try {
            new URL(input);
            return true;
          } catch {
            return "请输入有效的 URL";
          }
        }
      },
      {
        type: "input",
        name: "key",
        message: "API Key:",
        validate: input => {
          const trimmed = input.trim();
          if (!trimmed) return "API Key 不能为空";
          if (trimmed.length < 10) return "API Key 长度太短，请检查是否完整";
          return true;
        }
      },
      {
        type: "confirm",
        name: "setAsDefault",
        message: "设置为默认 provider?",
        default: providers.length === 0  // 如果是第一个 provider，默认设为默认
      }
    ]);

    const newProvider = {
      name: answers.name.trim(),
      baseUrl: answers.baseUrl.trim(),
      key: answers.key.trim(),
      default: answers.setAsDefault
    };

    if (answers.setAsDefault) {
      providers.forEach(p => p.default = false);
    }

    providers.push(newProvider);

    try {
      fs.writeFileSync(configPath, JSON.stringify(providers, null, 2));
      console.log(`\n✅ 已添加 provider: ${newProvider.name}`);
    } catch (error) {
      console.error(`\n❌ 保存配置失败: ${error.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (removeProvider) {
    const index = parseInt(providerIndex, 10) - 1;  // 转换为 0-based index
    if (isNaN(index) || index < 0 || index >= providers.length) {
      console.error(`\n❌ 无效的编号: ${providerIndex}`);
      process.exit(1);
    }

    const removed = providers[index];
    providers.splice(index, 1);

    try {
      fs.writeFileSync(configPath, JSON.stringify(providers, null, 2));
      console.log(`\n✅ 已删除 provider: ${removed.name}`);
    } catch (error) {
      console.error(`\n❌ 保存配置失败: ${error.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (setDefault) {
    const index = parseInt(providerIndex, 10) - 1;  // 转换为 0-based index
    if (isNaN(index) || index < 0 || index >= providers.length) {
      console.error(`\n❌ 无效的编号: ${providerIndex}`);
      process.exit(1);
    }

    providers.forEach((p, i) => p.default = (i === index));

    try {
      fs.writeFileSync(configPath, JSON.stringify(providers, null, 2));
      console.log(`\n✅ 已设置 ${providers[index].name} 为默认 provider`);
    } catch (error) {
      console.error(`\n❌ 保存配置失败: ${error.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (clearDefault) {
    providers.forEach(p => p.default = false);

    try {
      fs.writeFileSync(configPath, JSON.stringify(providers, null, 2));
      console.log(`\n✅ 已清除所有默认设置，每次运行都会提示选择 provider`);
    } catch (error) {
      console.error(`\n❌ 保存配置失败: ${error.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  const cache = forceRefresh ? {} : loadCache();
  const cacheKeys = Object.keys(cache);
  const hasCachedResults = cacheKeys.length > 0;

  let progress = null;
  let testResults = [];

  if (hasCachedResults && !forceRefresh) {
    console.log("\n💾 使用缓存结果 (5分钟内有效，使用 --refresh 强制刷新)：\n");

    // 对于缓存结果，直接返回
    testResults = providers.map((p) => {
      const cacheKey = `${p.baseUrl}:${p.key.slice(-8)}`;
      return cache[cacheKey];
    });
  } else {
    // 需要进行检测时，显示进度
    if (!verbose) {
      // 非详细模式下显示进度条
      progress = new ProgressIndicator(providers.length, "正在检测 API 可用性");
      progress.start();
    } else {
      // 详细模式下显示传统信息
      console.log("\n🔍 正在并行检测可用性...\n");
    }

    const testPromises = providers.map(async (p, i) => {
      const cacheKey = `${p.baseUrl}:${p.key.slice(-8)}`;
      if (cache[cacheKey] && !forceRefresh) {
        if (verbose) {
          console.log(`🔍 [${i + 1}] ${p.name}: 使用缓存结果`);
        }
        if (progress) {
          progress.update(p.name);
        }
        return cache[cacheKey];
      }

      if (verbose) {
        console.log(`🔍 [${i + 1}] ${p.name}: 开始检测...`);
      }

      const result = await testProvider(p.baseUrl, p.key, 2, verbose);

      if (verbose) {
        console.log(`🔍 [${i + 1}] ${p.name}: 检测完成 - ${result.available ? '可用' : '不可用'}`);
      }

      // 更新进度
      if (progress) {
        const modelInfo = result.supportedModels && result.supportedModels.length > 0
          ? `(${result.supportedModels.join(', ')})`
          : result.available ? '(可达)' : '';
        progress.update(`${p.name}${modelInfo}`);
      }

      return result;
    });

    testResults = await Promise.all(testPromises);

    // 完成进度显示
    if (progress) {
      progress.finish();
    }
  }

  // 更新缓存
  const newCache = {};
  providers.forEach((p, i) => {
    const cacheKey = `${p.baseUrl}:${p.key.slice(-8)}`;
    newCache[cacheKey] = testResults[i];
  });
  saveCache(newCache);

  const results = providers.map((p, i) => {
    const testResult = testResults[i];
    const isAvailable = testResult.available;
    const cacheKey = `${p.baseUrl}:${p.key.slice(-8)}`;
    const fromCache = cache[cacheKey] && !forceRefresh;

    let statusText = "";
    if (isAvailable) {
      statusText = `✅ [${i + 1}] ${p.name} 可用`;

      // 添加支持的模型类型显示
      if (testResult.supportedModels && testResult.supportedModels.length > 0) {
        statusText += ` (支持: ${testResult.supportedModels.join(', ')})`;
      }

      if (verbose && testResult.responseTime) {
        statusText += ` - (${testResult.status}) ${testResult.responseTime}ms`;
      }
      if (fromCache) statusText += ' 📋';
    } else {
      statusText = `❌ [${i + 1}] ${p.name} 不可用 - ${testResult.error}`;
      if (fromCache) statusText += ' 📋';
    }

    console.log(statusText);
    return { ...p, ok: isAvailable, testResult };
  });

  const available = results.filter(p => p.ok);

  if (available.length === 0) {
    console.error("\n🚨 没有可用的服务！");
    process.exit(1);
  }

  let selected;

  if (providerIndex !== undefined) {
    const index = parseInt(providerIndex, 10) - 1;  // 转换为 0-based index
    if (!isNaN(index) && index >= 0 && results[index] && results[index].ok) {
      selected = results[index];
      console.log(`\n👉 已通过编号选择: ${selected.name} (${selected.baseUrl})`);
    } else {
      console.error(`\n❌ 编号 ${providerIndex} 无效或该 provider 不可用`);
      process.exit(1);
    }
  } else {
    const defaultProvider = results.find(p => p.default && p.ok);
    if (defaultProvider) {
      selected = defaultProvider;
      console.log(`\n⭐ 已自动选择默认 provider: ${selected.name} (${selected.baseUrl})`);
    } else {
      // 没有默认 provider，总是显示交互式选择
      const answers = await inquirer.prompt([
        {
          type: "list",
          name: "provider",
          message: "请选择一个可用的 provider:",
          choices: available.map((p, i) => {
            // 通过 name 和 baseUrl 找到原始索引
            const originalIndex = providers.findIndex(provider =>
              provider.name === p.name && provider.baseUrl === p.baseUrl
            );
            const displayIndex = originalIndex + 1;
            return {
              name: `[${displayIndex}] ${p.name} (${p.baseUrl})`,
              value: p
            };
          })
        }
      ]);
      selected = answers.provider;
    }
  }

  process.env.ANTHROPIC_BASE_URL = selected.baseUrl;
  process.env.ANTHROPIC_AUTH_TOKEN = selected.key;

  console.log(`\n✅ 已切换到: ${selected.name} (${selected.baseUrl})`);
  console.log(`\n🔧 环境变量已设置:`);
  console.log(`   ANTHROPIC_BASE_URL=${selected.baseUrl}`);
  console.log(`   ANTHROPIC_AUTH_TOKEN=${selected.key.slice(0, 12)}...`);

  if (envOnly) {
    console.log(`\n📋 环境变量设置完成！你可以手动运行 claude 命令`);
    console.log(`\n💡 在当前会话中，你也可以使用这些命令：`);
    console.log(`   $env:ANTHROPIC_BASE_URL="${selected.baseUrl}"`);
    console.log(`   $env:ANTHROPIC_AUTH_TOKEN="${selected.key}"`);
    console.log(`   claude`);
    process.exit(0);
  }

  // 尝试启动 claude
  console.log(`\n🚀 正在启动 Claude Code...`);

  const child = spawn("claude", [], {
    stdio: "inherit",
    env: process.env,
    shell: true  // 在 Windows 上更好地处理命令
  });

  child.on("error", (error) => {
    if (error.code === "ENOENT") {
      console.error(`\n❌ 找不到 'claude' 命令！`);
      console.log(`\n💡 解决方案：`);
      console.log(`   1. 确保 Claude Code 已正确安装`);
      console.log(`   2. 检查 claude 命令是否在 PATH 环境变量中`);
      console.log(`   3. 或者手动设置环境变量后运行 claude：`);
      console.log(`      $env:ANTHROPIC_BASE_URL="${selected.baseUrl}"`);
      console.log(`      $env:ANTHROPIC_AUTH_TOKEN="${selected.key}"`);
      console.log(`      claude`);
      console.log(`\n🔍 当前 PATH 包含的目录：`);
      const paths = process.env.PATH.split(process.platform === 'win32' ? ';' : ':');
      paths.slice(0, 5).forEach(p => console.log(`   - ${p}`));
      if (paths.length > 5) {
        console.log(`   ... 还有 ${paths.length - 5} 个目录`);
      }
    } else {
      console.error(`\n❌ 启动 claude 时出错: ${error.message}`);
    }
    process.exit(1);
  });

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.log(`\n⚠️  Claude Code 退出，退出码: ${code}`);
    }
    process.exit(code);
  });
}

main();
