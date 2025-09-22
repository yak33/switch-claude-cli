import fs from 'fs';
import path from 'path';
import os from 'os';

// 配置目录和文件路径
export const configDir = path.join(os.homedir(), '.switch-claude');
export const configPath = path.join(configDir, 'providers.json');
export const cacheFile = path.join(configDir, 'cache.json');
export const CACHE_DURATION = 5 * 60 * 1000; // 5分钟

// 确保配置目录存在
export function ensureConfigDir() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    return true;
  }
  return false;
}

// 验证单个 provider 配置
export function validateProvider(provider, index) {
  const errors = [];

  if (!provider || typeof provider !== 'object') {
    errors.push(`Provider [${index}]: 必须是对象`);
    return errors;
  }

  if (!provider.name || typeof provider.name !== 'string') {
    errors.push(`Provider [${index}]: 缺少有效的 name 字段`);
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

  return errors;
}

// 验证配置
export function validateConfig(providers) {
  if (!Array.isArray(providers)) {
    throw new Error('配置文件格式错误：providers 必须是数组');
  }

  if (providers.length === 0) {
    throw new Error('配置文件为空：至少需要一个 provider');
  }

  const errors = [];
  const names = new Set();

  providers.forEach((provider, index) => {
    const providerErrors = validateProvider(provider, index);
    errors.push(...providerErrors);

    // 检查名称重复
    if (provider.name && names.has(provider.name)) {
      errors.push(`Provider [${index}]: name "${provider.name}" 重复`);
    } else if (provider.name) {
      names.add(provider.name);
    }
  });

  if (errors.length > 0) {
    throw new Error(`配置验证失败：\n${errors.join('\n')}`);
  }

  return true;
}

// 加载缓存
export function loadCache() {
  try {
    if (!fs.existsSync(cacheFile)) return {};
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    return cache.timestamp && Date.now() - cache.timestamp < CACHE_DURATION ? cache.results : {};
  } catch {
    return {};
  }
}

// 保存缓存
export function saveCache(results) {
  try {
    fs.writeFileSync(
      cacheFile,
      JSON.stringify({
        timestamp: Date.now(),
        results: results,
      })
    );
    return true;
  } catch (error) {
    console.warn('⚠️ 缓存保存失败:', error.message);
    return false;
  }
}

// 生成备份文件名
export function generateBackupFilename(prefix = 'backup') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${prefix}-${timestamp}.json`;
}

// 解析命令行参数
export function parseArgs(args) {
  const parsed = {
    showHelp: args.includes('--help') || args.includes('-h'),
    showVersion: args.includes('--version') || args.includes('-V'),
    forceRefresh: args.includes('--refresh') || args.includes('-r'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    listProviders: args.includes('--list') || args.includes('-l'),
    envOnly: args.includes('--env-only') || args.includes('-e'),
    exportConfig: args.includes('--export'),
    importConfig: args.includes('--import'),
    backupConfig: args.includes('--backup'),
    listBackups: args.includes('--list-backups'),
    mergeImport: args.includes('--merge'),
    addProvider: args.includes('--add'),
    removeProvider: args.includes('--remove'),
    setDefault: args.includes('--set-default'),
    clearDefault: args.includes('--clear-default'),
    checkUpdate: args.includes('--check-update'),
    providerIndex: args.find((arg) => !arg.startsWith('-') && !isNaN(parseInt(arg))),
  };

  // 获取带参数的选项值
  if (parsed.exportConfig) {
    const exportIndex = args.indexOf('--export');
    parsed.exportPath =
      args[exportIndex + 1] && !args[exportIndex + 1].startsWith('-')
        ? args[exportIndex + 1]
        : null;
  }

  if (parsed.importConfig) {
    const importIndex = args.indexOf('--import');
    parsed.importPath = args[importIndex + 1];
  }

  return parsed;
}

// 格式化 API Key（部分隐藏）
export function maskApiKey(key, showLength = 12) {
  if (!key || key.length <= showLength) return key;
  return key.slice(0, showLength) + '...';
}
