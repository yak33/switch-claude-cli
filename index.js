#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import inquirer from 'inquirer';
import updateNotifier from 'update-notifier';
import {
  recordCommand,
  recordProviderUse,
  displayStats,
  exportStats as exportStatsData,
  resetStats,
} from './lib/stats.js';

// 获取当前模块的目录路径（ESM 模块需要这样处理）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取 package.json 用于版本检查
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

// 检查更新（每6小时检查一次）
const notifier = updateNotifier({
  pkg,
  updateCheckInterval: 1000 * 60 * 60 * 6, // 6小时
  shouldNotifyInNpmScript: false,
});

// 配置目录和文件路径
const configDir = path.join(os.homedir(), '.switch-claude');
const configPath = path.join(configDir, 'providers.json');
const cacheFile = path.join(configDir, 'cache.json');
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟

// 进度显示工具
class ProgressIndicator {
  constructor(total, message = '正在处理') {
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

    let line = `🔍 检测中 ${spinner} [${this.completed}/${this.total}]`;

    // 显示当前正在处理的API完整名称
    if (this.completedItems.length > 0) {
      // 显示最新完成的一个项目的完整名称
      const latestItem = this.completedItems[this.completedItems.length - 1];
      line += ` 当前: ${latestItem}`;
    }

    // 控制整行长度，如果太长则优先保留API名称，缩短其他部分
    const maxLineLength = process.stdout.columns ? Math.min(process.stdout.columns - 2, 100) : 100;
    if (line.length > maxLineLength) {
      // 如果行太长，尝试缩短消息部分但保留API名称
      const baseMessage = `🔍 检测中 ${spinner} [${this.completed}/${this.total}]`;
      if (this.completedItems.length > 0) {
        const latestItem = this.completedItems[this.completedItems.length - 1];
        const remainingSpace = maxLineLength - baseMessage.length - 5; // 5 for " 当前: "
        if (remainingSpace > 10) {
          line = `${baseMessage} 当前: ${latestItem}`;
        } else {
          // 如果空间不够，只显示基本信息
          line = baseMessage;
        }
      }
    }

    if (process.stdout.isTTY) {
      // TTY环境：清除上一行并打印新行
      if (this.lastLine) {
        process.stdout.write(`\r${' '.repeat(this.lastLine.length)}\r`);
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
      process.stdout.write(`\r${' '.repeat(this.lastLine.length)}\r`);
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
  console.log(`🎉 欢迎使用 Switch Claude CLI v${pkg.version}！`);
  console.log(`\n📚 Switch Claude CLI - Claude API Provider 切换工具

用法:
  switch-claude [选项] [编号]

选项:
  -h, --help          显示帮助信息
  -V, --version       显示版本信息并检查更新
  -r, --refresh       强制刷新缓存，重新检测所有 provider
  -v, --verbose       显示详细的调试信息
  -l, --list          只列出 providers 不启动 claude
  -e, --env-only      只设置环境变量，不启动 claude
  --add               添加新的 provider
  --remove <编号>     删除指定编号的 provider
  --set-default <编号> 设置指定编号的 provider 为默认
  --clear-default     清除默认 provider（每次都需要手动选择）
  --check-update      手动检查版本更新
  --export [文件名]   导出配置到文件
  --import <文件名>   从文件导入配置
  --backup            备份当前配置
  --list-backups      列出所有备份

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
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    return cache.timestamp && Date.now() - cache.timestamp < CACHE_DURATION ? cache.results : {};
  } catch {
    return {};
  }
}

function saveCache(results) {
  try {
    fs.writeFileSync(
      cacheFile,
      JSON.stringify({
        timestamp: Date.now(),
        results,
      })
    );
  } catch (error) {
    console.warn('⚠️ 缓存保存失败:', error.message);
  }
}

function validateConfig(providers) {
  if (!Array.isArray(providers)) {
    throw new Error('配置文件格式错误：providers 必须是数组');
  }

  if (providers.length === 0) {
    throw new Error('配置文件为空：至少需要一个 provider');
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
      name: 'Provider1',
      baseUrl: 'https://api.example1.com',
      key: 'sk-your-api-key-here-replace-with-real-key',
      default: true,
    },
    {
      name: 'Provider2',
      baseUrl: 'https://api.example2.com',
      key: 'cr_your-api-key-here-replace-with-real-key',
      default: false,
    },
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
        type: 'input',
        name: 'name',
        message: '请输入 Provider 名称:',
        default: '我的Claude服务',
        validate: (input) => (input.trim() ? true : '名称不能为空'),
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: '请输入 API Base URL:',
        default: 'https://api.example.com',
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return '请输入有效的 URL';
          }
        },
      },
      {
        type: 'input',
        name: 'key',
        message: '请输入 API Key:',
        validate: (input) => {
          const trimmed = input.trim();
          if (!trimmed) return 'API Key 不能为空';
          if (trimmed.length < 10) return 'API Key 长度太短，请检查是否完整';
          return true;
        },
      },
      {
        type: 'confirm',
        name: 'continueSetup',
        message: '配置完成！是否现在就开始使用?',
        default: true,
      },
    ]);

    const newConfig = [
      {
        name: answers.name.trim(),
        baseUrl: answers.baseUrl.trim(),
        key: answers.key.trim(),
        default: true,
      },
    ];

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
    { model: 'claude-sonnet-4-20250514', type: 'Claude' },
    { model: 'gpt-5', type: 'GPT' },
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
          console.log(
            `    🌐 尝试 POST ${baseUrl}/v1/messages (${modelInfo.type}, 尝试 ${attempt + 1}/${retries + 1})`
          );
        }

        const options = {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            'User-Agent': 'switch-claude-cli/1.0.0',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: modelInfo.model,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1,
          }),
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
            // 记录成功的响应时间
            recordProviderUse(baseUrl, true, responseTime);
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
              error: res.ok
                ? null
                : res.status === 401
                  ? '认证失败，请检查API Key'
                  : res.status === 403
                    ? '权限不足，请检查API Key权限'
                    : res.status === 429
                      ? '请求频率超限，服务可用'
                      : res.status === 400
                        ? '请求参数错误，可能模型不支持'
                        : res.status === 422
                          ? '模型不支持'
                          : `HTTP ${res.status}: ${res.statusText}`,
            };
          }

          // 如果成功了就跳到下一个模型
          if (res.ok) break;
        } else if (verbose) {
          console.log(`    ❌ 端点失败: ${res.status} ${res.statusText}`);
        }
      } catch (error) {
        const errorMsg =
          error.name === 'AbortError'
            ? 'Timeout (8s)'
            : error.code === 'ENOTFOUND'
              ? 'DNS解析失败'
              : error.code === 'ECONNREFUSED'
                ? '连接被拒绝'
                : error.code === 'ETIMEDOUT'
                  ? '连接超时'
                  : error.message;

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
            error: errorMsg,
          };
        }

        if (attempt < retries) {
          if (verbose) {
            console.log(`    ⏳ 等待1秒后重试...`);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
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
    error: 'All models failed',
  };
}

// 导出配置到文件
async function exportConfig(outputPath) {
  try {
    if (!fs.existsSync(configPath)) {
      console.error('❌ 配置文件不存在');
      console.log('💡 请先运行 switch-claude 创建配置');
      return false;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // 如果没有指定输出路径，使用默认文件名
    if (!outputPath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      outputPath = `switch-claude-backup-${timestamp}.json`;
    }

    // 添加元数据
    const exportData = {
      version: pkg.version,
      exportTime: new Date().toISOString(),
      providers: config,
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`✅ 配置已导出到: ${path.resolve(outputPath)}`);
    console.log(`📋 包含 ${config.length} 个 provider 配置`);
    return true;
  } catch (error) {
    console.error(`❌ 导出失败: ${error.message}`);
    return false;
  }
}

// 从文件导入配置
async function importConfig(inputPath, merge = false) {
  try {
    if (!fs.existsSync(inputPath)) {
      console.error(`❌ 文件不存在: ${inputPath}`);
      return false;
    }

    const importData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

    // 验证导入数据格式
    let providersToImport;
    if (importData.providers && Array.isArray(importData.providers)) {
      // 新格式（包含元数据）
      providersToImport = importData.providers;
      console.log(`📄 导入文件版本: v${importData.version || 'unknown'}`);
      if (importData.exportTime) {
        console.log(`📅 导出时间: ${new Date(importData.exportTime).toLocaleString('zh-CN')}`);
      }
    } else if (Array.isArray(importData)) {
      // 旧格式（纯数组）
      providersToImport = importData;
    } else {
      console.error('❌ 无效的配置文件格式');
      return false;
    }

    // 验证配置内容
    try {
      validateConfig(providersToImport);
    } catch (error) {
      console.error('❌ 配置验证失败:');
      console.error(error.message);
      return false;
    }

    // 如果需要合并配置
    if (merge && fs.existsSync(configPath)) {
      const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const existingNames = new Set(existingConfig.map((p) => p.name));

      // 过滤重复的 provider
      const newProviders = providersToImport.filter((p) => !existingNames.has(p.name));

      if (newProviders.length === 0) {
        console.log('⚠️ 没有新的 provider 需要导入（所有名称都已存在）');
        return false;
      }

      console.log(`🔄 合并模式: 将添加 ${newProviders.length} 个新 provider`);
      providersToImport = [...existingConfig, ...newProviders];
    }

    // 备份现有配置
    if (fs.existsSync(configPath)) {
      const backupPath = `${configPath}.backup-${Date.now()}`;
      fs.copyFileSync(configPath, backupPath);
      console.log(`📦 已备份原配置到: ${path.basename(backupPath)}`);
    }

    // 写入新配置
    fs.writeFileSync(configPath, JSON.stringify(providersToImport, null, 2));
    console.log(`✅ 成功导入 ${providersToImport.length} 个 provider 配置`);

    // 显示导入的 providers
    console.log('\n📋 导入的 Providers:');
    providersToImport.forEach((p, i) => {
      console.log(`  [${i + 1}] ${p.name} (${p.baseUrl})${p.default ? ' ⭐默认' : ''}`);
    });

    return true;
  } catch (error) {
    console.error(`❌ 导入失败: ${error.message}`);
    return false;
  }
}

// 自动备份配置
async function backupConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      console.error('❌ 配置文件不存在，无需备份');
      return false;
    }

    const backupDir = path.join(configDir, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = path.join(backupDir, `backup-${timestamp}.json`);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const backupData = {
      version: pkg.version,
      backupTime: new Date().toISOString(),
      providers: config,
    };

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`✅ 配置已备份到: ${path.relative(configDir, backupPath)}`);

    // 清理旧备份（保留最近10个）
    const backups = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (backups.length > 10) {
      const toDelete = backups.slice(10);
      toDelete.forEach((file) => {
        fs.unlinkSync(path.join(backupDir, file));
      });
      console.log(`🗑️ 已清理 ${toDelete.length} 个旧备份文件`);
    }

    return true;
  } catch (error) {
    console.error(`❌ 备份失败: ${error.message}`);
    return false;
  }
}

// 列出所有备份
async function listBackups() {
  try {
    const backupDir = path.join(configDir, 'backups');
    if (!fs.existsSync(backupDir)) {
      console.log('📭 没有找到备份文件');
      return;
    }

    const backups = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (backups.length === 0) {
      console.log('📭 没有找到备份文件');
      return;
    }

    console.log('📚 可用的备份文件:\n');
    backups.forEach((file, index) => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      console.log(`[${index + 1}] ${file}`);
      console.log(`    📅 备份时间: ${new Date(data.backupTime).toLocaleString('zh-CN')}`);
      console.log(`    📦 包含 ${data.providers.length} 个 provider`);
      console.log(`    💾 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log('');
    });

    console.log(`💡 使用 switch-claude --import <备份文件路径> 恢复配置`);
  } catch (error) {
    console.error(`❌ 列出备份失败: ${error.message}`);
  }
}

async function main() {
  // 确保配置目录存在
  ensureConfigDir();

  // 显示更新提示（如果有新版本）
  notifier.notify({
    isGlobal: true,
    defer: false, // 立即显示，不延迟到进程结束
    message:
      '🚀 发现新版本 {latestVersion}，当前版本 {currentVersion}\n' +
      '运行以下命令更新：\n' +
      'npm update -g {packageName}\n' +
      '或者：\n' +
      'npm install -g {packageName}@latest',
    boxenOptions: {
      padding: 1,
      margin: 1,
      align: 'center',
      borderColor: 'yellow',
      borderStyle: 'round',
    },
  });

  // 解析命令行参数
  const args = process.argv.slice(2);
  const showHelp = args.includes('--help') || args.includes('-h');
  const showVersion = args.includes('--version') || args.includes('-V');
  const showStats = args.includes('--stats');
  const exportStats = args.includes('--export-stats');
  const resetStatsFlag = args.includes('--reset-stats');

  // 配置备份和导入相关参数
  const exportConfig_ = args.includes('--export');
  const importConfig_ = args.includes('--import');
  const backupConfig_ = args.includes('--backup');
  const listBackups_ = args.includes('--list-backups');
  const mergeImport = args.includes('--merge');

  // 其他命令参数
  const forceRefresh = args.includes('--refresh') || args.includes('-r');
  const verbose = args.includes('--verbose') || args.includes('-v');
  const listProviders = args.includes('--list') || args.includes('-l');
  const addProvider = args.includes('--add');
  const removeProvider = args.includes('--remove');
  const setDefault = args.includes('--set-default');
  const clearDefault = args.includes('--clear-default');
  const envOnly = args.includes('--env-only') || args.includes('-e');
  const checkUpdate = args.includes('--check-update');
  const providerIndex = args.find((arg) => !arg.startsWith('-') && !isNaN(parseInt(arg)));

  // 统计相关命令
  if (showStats) {
    recordCommand('--stats');
    const verbose = args.includes('-v') || args.includes('--verbose');
    displayStats(verbose);
    process.exit(0);
  }

  if (exportStats) {
    recordCommand('--export-stats');
    const exportIndex = args.indexOf('--export-stats');
    const outputPath =
      args[exportIndex + 1] && !args[exportIndex + 1].startsWith('-')
        ? args[exportIndex + 1]
        : `stats-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.json`;
    exportStatsData(outputPath);
    process.exit(0);
  }

  if (resetStatsFlag) {
    recordCommand('--reset-stats');
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmReset',
        message: '确定要重置所有统计数据吗？',
        default: false,
      },
    ]);

    if (answers.confirmReset) {
      resetStats();
    } else {
      console.log('已取消重置');
    }
    process.exit(0);
  }

  // 如果是版本命令，显示版本信息
  if (showVersion) {
    recordCommand('--version');
    console.log(`switch-claude-cli v${pkg.version}`);

    // 主动检查一次更新
    const update = await notifier.fetchInfo();
    if (update && update.latest !== pkg.version) {
      console.log(`\n🆕 最新版本: v${update.latest}`);
      if (update.time && update.time[update.latest]) {
        console.log(`📅 发布时间: ${new Date(update.time[update.latest]).toLocaleString('zh-CN')}`);
      }
      console.log(`\n💡 更新命令: npm update -g switch-claude-cli`);
    } else {
      console.log('✅ 已是最新版本');
    }
    process.exit(0);
  }

  // 如果是帮助命令，直接显示帮助并退出
  if (showHelp) {
    recordCommand('--help');
    console.log(`
📚 Switch Claude CLI - Claude API Provider 切换工具 (v${pkg.version})

用法:
  switch-claude [选项] [编号]

选项:
  -h, --help          显示帮助信息
  -V, --version       显示版本信息并检查更新
  -r, --refresh       强制刷新缓存，重新检测所有 provider
  -v, --verbose       显示详细的调试信息
  -l, --list          只列出 providers 不启动 claude
  -e, --env-only      只设置环境变量，不启动 claude
  --add               添加新的 provider
  --remove <编号>     删除指定编号的 provider
  --set-default <编号> 设置指定编号的 provider 为默认
  --clear-default     清除默认 provider（每次都需要手动选择）
  --check-update      手动检查版本更新
  --export [文件名]   导出配置到文件
  --import <文件名>   从文件导入配置
  --merge             导入时合并而不是替换（与 --import 配合使用）
  --backup            备份当前配置
  --list-backups      列出所有备份
  --stats             显示使用统计
  --export-stats [文件名] 导出统计数据
  --reset-stats       重置统计数据

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
  switch-claude --export  # 导出配置到带时间戳的文件
  switch-claude --export my-config.json # 导出到指定文件
  switch-claude --import backup.json # 导入配置（替换）
  switch-claude --import backup.json --merge # 导入配置（合并）
  switch-claude --backup  # 备份当前配置
  switch-claude --list-backups # 查看所有备份
`);
    process.exit(0);
  }

  // 记录命令使用
  let commandUsed = 'default';
  if (exportConfig_) commandUsed = '--export';
  else if (importConfig_) commandUsed = '--import';
  else if (backupConfig_) commandUsed = '--backup';
  else if (listBackups_) commandUsed = '--list-backups';
  else if (addProvider) commandUsed = '--add';
  else if (removeProvider) commandUsed = '--remove';
  else if (setDefault) commandUsed = '--set-default';
  else if (clearDefault) commandUsed = '--clear-default';
  else if (checkUpdate) commandUsed = '--check-update';
  else if (listProviders) commandUsed = '--list';
  else if (envOnly) commandUsed = '--env-only';
  else if (providerIndex) commandUsed = 'direct-select';

  recordCommand(commandUsed);

  // 处理导出配置
  if (exportConfig_) {
    // 查找 --export 后面的参数作为输出文件名
    const exportIndex = args.indexOf('--export');
    const outputPath =
      args[exportIndex + 1] && !args[exportIndex + 1].startsWith('-')
        ? args[exportIndex + 1]
        : null;
    const success = await exportConfig(outputPath);
    process.exit(success ? 0 : 1);
  }

  // 处理导入配置
  if (importConfig_) {
    const importIndex = args.indexOf('--import');
    const inputPath = args[importIndex + 1];

    if (!inputPath || inputPath.startsWith('-')) {
      console.error('❌ 请指定要导入的文件路径');
      console.log('💡 用法: switch-claude --import <文件路径>');
      process.exit(1);
    }

    const success = await importConfig(inputPath, mergeImport);
    process.exit(success ? 0 : 1);
  }

  // 处理备份配置
  if (backupConfig_) {
    const success = await backupConfig();
    process.exit(success ? 0 : 1);
  }

  // 处理列出备份
  if (listBackups_) {
    await listBackups();
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
          type: 'confirm',
          name: 'useInteractive',
          message: '是否使用交互式配置向导? (推荐)',
          default: true,
        },
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
    } catch {
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
    const configContent = fs.readFileSync(configPath, 'utf-8');
    providers = JSON.parse(configContent);
    validateConfig(providers);
  } catch (error) {
    console.error('❌ 配置文件错误：');
    if (error instanceof SyntaxError) {
      console.error('JSON 格式错误，请检查文件语法');
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }

  // 变量已在前面定义，这里不需要重复定义

  // 如果是检查更新命令
  if (checkUpdate) {
    console.log('🔍 正在检查更新...');
    const update = await notifier.fetchInfo();

    if (update && update.latest !== pkg.version) {
      console.log(`\n🎉 发现新版本！`);
      console.log(`📌 当前版本: v${pkg.version}`);
      console.log(`🆕 最新版本: v${update.latest}`);
      if (update.time && update.time[update.latest]) {
        console.log(`📅 发布时间: ${new Date(update.time[update.latest]).toLocaleString('zh-CN')}`);
      }

      // 尝试获取更新说明
      if (update.latest) {
        console.log(`\n💡 更新方法：`);
        console.log(`   npm update -g switch-claude-cli`);
        console.log(`   或者：`);
        console.log(`   npm install -g switch-claude-cli@latest`);
      }
    } else {
      console.log(`✅ 太好了！你已经在使用最新版本 v${pkg.version}`);
    }
    process.exit(0);
  }

  console.log('📋 可用的第三方列表：\n');
  providers.forEach((p, i) => {
    console.log(`[${i + 1}] ${p.name} (${p.baseUrl})${p.default ? ' ⭐默认' : ''}`);
  });

  // 处理配置管理命令
  if (listProviders) {
    process.exit(0);
  }

  if (addProvider) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Provider 名称:',
        validate: (input) => (input.trim() ? true : '名称不能为空'),
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: 'API Base URL:',
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return '请输入有效的 URL';
          }
        },
      },
      {
        type: 'input',
        name: 'key',
        message: 'API Key:',
        validate: (input) => {
          const trimmed = input.trim();
          if (!trimmed) return 'API Key 不能为空';
          if (trimmed.length < 10) return 'API Key 长度太短，请检查是否完整';
          return true;
        },
      },
      {
        type: 'confirm',
        name: 'setAsDefault',
        message: '设置为默认 provider?',
        default: providers.length === 0, // 如果是第一个 provider，默认设为默认
      },
    ]);

    const newProvider = {
      name: answers.name.trim(),
      baseUrl: answers.baseUrl.trim(),
      key: answers.key.trim(),
      default: answers.setAsDefault,
    };

    if (answers.setAsDefault) {
      providers.forEach((p) => (p.default = false));
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
    const index = parseInt(providerIndex, 10) - 1; // 转换为 0-based index
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
    const index = parseInt(providerIndex, 10) - 1; // 转换为 0-based index
    if (isNaN(index) || index < 0 || index >= providers.length) {
      console.error(`\n❌ 无效的编号: ${providerIndex}`);
      process.exit(1);
    }

    providers.forEach((p, i) => (p.default = i === index));

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
    providers.forEach((p) => (p.default = false));

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
    console.log('\n💾 使用缓存结果 (5分钟内有效，使用 --refresh 强制刷新)：\n');

    // 对于缓存结果，直接返回
    testResults = providers.map((p) => {
      const cacheKey = `${p.baseUrl}:${p.key.slice(-8)}`;
      return cache[cacheKey];
    });
  } else {
    // 需要进行检测时，显示进度
    if (!verbose) {
      // 非详细模式下显示进度条
      progress = new ProgressIndicator(providers.length, '正在检测 API 可用性');
      progress.start();
    } else {
      // 详细模式下显示传统信息
      console.log('\n🔍 正在并行检测可用性...\n');
    }

    const testPromises = providers.map(async (p, i) => {
      const cacheKey = `${p.baseUrl}:${p.key.slice(-8)}`;
      if (cache[cacheKey] && !forceRefresh) {
        if (verbose) {
          console.log(`🔍 [${i + 1}] ${p.name}: 使用缓存结果`);
        }
        if (progress) {
          progress.update(`${p.name}📋`);
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
        // 简化显示信息，只显示provider名称和简单状态
        const status = result.available ? '✓' : '✗';
        progress.update(`${p.name}${status}`);
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

    let statusText = '';
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

  const available = results.filter((p) => p.ok);

  if (available.length === 0) {
    console.error('\n🚨 没有可用的服务！');
    process.exit(1);
  }

  let selected;

  if (providerIndex !== undefined) {
    const index = parseInt(providerIndex, 10) - 1; // 转换为 0-based index
    if (!isNaN(index) && index >= 0 && results[index] && results[index].ok) {
      selected = results[index];
      console.log(`\n👉 已通过编号选择: ${selected.name} (${selected.baseUrl})`);
    } else {
      console.error(`\n❌ 编号 ${providerIndex} 无效或该 provider 不可用`);
      process.exit(1);
    }
  } else {
    const defaultProvider = results.find((p) => p.default && p.ok);
    if (defaultProvider) {
      selected = defaultProvider;
      console.log(`\n⭐ 已自动选择默认 provider: ${selected.name} (${selected.baseUrl})`);
    } else {
      // 没有默认 provider，总是显示交互式选择
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: '请选择一个可用的 provider:',
          choices: available.map((p) => {
            // 通过 name 和 baseUrl 找到原始索引
            const originalIndex = providers.findIndex(
              (provider) => provider.name === p.name && provider.baseUrl === p.baseUrl
            );
            const displayIndex = originalIndex + 1;
            return {
              name: `[${displayIndex}] ${p.name} (${p.baseUrl})`,
              value: p,
            };
          }),
        },
      ]);
      selected = answers.provider;
    }
  }

  process.env.ANTHROPIC_BASE_URL = selected.baseUrl;
  process.env.ANTHROPIC_AUTH_TOKEN = selected.key;

  console.log(`\n✅ 已切换到: ${selected.name} (${selected.baseUrl})`);

  // 记录使用统计
  recordProviderUse(selected.name, true, selected.testResult?.responseTime);
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

  // 检查 claude 命令的实际路径
  let claudeCommand = 'claude';
  const claudeArgs = [];

  // 尝试解析 shell 别名或获取完整路径
  try {
    // 检查操作系统类型
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // Windows 系统处理
      // 首先尝试使用 where 命令（Windows 等效于 which）
      const whereResult = spawnSync('where', ['claude'], { encoding: 'utf8' });
      if (whereResult.status === 0 && whereResult.stdout.trim()) {
        claudeCommand = whereResult.stdout.trim().split('\n')[0]; // 取第一个结果
      } else {
        // 尝试常见的 Windows Claude 安装路径
        const possiblePaths = [
          path.join(os.homedir(), '.claude', 'local', 'claude.exe'),
          path.join(os.homedir(), '.claude', 'local', 'claude'),
          'C:\\Program Files\\Claude\\claude.exe',
          'C:\\Program Files (x86)\\Claude\\claude.exe',
        ];

        for (const possiblePath of possiblePaths) {
          if (fs.existsSync(possiblePath)) {
            claudeCommand = possiblePath;
            break;
          }
        }
      }
    } else {
      // Unix-like 系统处理（macOS, Linux）
      // 首先尝试使用 which 命令获取完整路径
      const whichResult = spawnSync('which', ['claude'], { encoding: 'utf8' });
      if (whichResult.status === 0 && whichResult.stdout.trim()) {
        claudeCommand = whichResult.stdout.trim();
      } else {
        // 如果 which 没有找到，尝试使用 bash -c 来解析别名
        const aliasResult = spawnSync('bash', ['-c', 'alias claude'], { encoding: 'utf8' });
        if (aliasResult.status === 0 && aliasResult.stdout.trim()) {
          // 解析别名内容，例如: alias claude='/path/to/claude'
          const match = aliasResult.stdout.trim().match(/alias claude='([^']+)'/);
          if (match && match[1]) {
            claudeCommand = match[1];
          }
        } else {
          // 如果是 zsh，尝试使用 zsh 来解析别名
          const zshAliasResult = spawnSync('zsh', ['-c', 'alias claude'], { encoding: 'utf8' });
          if (zshAliasResult.status === 0 && zshAliasResult.stdout.trim()) {
            // 解析别名内容
            const match = zshAliasResult.stdout.trim().match(/claude='([^']+)'/);
            if (match && match[1]) {
              claudeCommand = match[1];
            }
          } else {
            // 最后尝试直接使用 echo 解析别名
            const echoResult = spawnSync('bash', ['-c', 'echo $(which claude)'], {
              encoding: 'utf8',
            });
            if (
              echoResult.status === 0 &&
              echoResult.stdout.trim() &&
              !echoResult.stdout.includes('not found')
            ) {
              claudeCommand = echoResult.stdout.trim();
            } else {
              // 如果所有方法都失败，使用用户配置的路径
              const userClaudePath =
                process.env.CLAUDE_PATH || path.join(os.homedir(), '.claude', 'local', 'claude');
              if (fs.existsSync(userClaudePath)) {
                claudeCommand = userClaudePath;
              }
            }
          }
        }
      }
    }
  } catch {
    // 如果解析失败，尝试使用默认路径
    const defaultClaudePath =
      process.platform === 'win32'
        ? path.join(os.homedir(), '.claude', 'local', 'claude.exe')
        : path.join(os.homedir(), '.claude', 'local', 'claude');

    if (fs.existsSync(defaultClaudePath)) {
      claudeCommand = defaultClaudePath;
    }
    console.warn(`⚠️ 无法解析 claude 命令路径，使用默认路径`);
  }

  console.log(`🔍 使用 claude 命令路径: ${claudeCommand}`);

  // 为 Claude Code 设置正确的 stdin 配置以支持交互
  const child = spawn(claudeCommand, claudeArgs, {
    stdio: ['inherit', 'inherit', 'inherit'], // 继承 stdin, stdout, stderr
    env: process.env,
    shell: true,
  });

  child.on('error', (error) => {
    if (error.code === 'ENOENT') {
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
      paths.slice(0, 5).forEach((p) => console.log(`   - ${p}`));
      if (paths.length > 5) {
        console.log(`   ... 还有 ${paths.length - 5} 个目录`);
      }
    } else {
      console.error(`\n❌ 启动 claude 时出错: ${error.message}`);
    }
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`\n⚠️  Claude Code 退出，退出码: ${code}`);
    }
    process.exit(code);
  });
}

main();
