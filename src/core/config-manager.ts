import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Provider, ExportData, ImportOptions } from '../types';
import { ValidationUtils } from '../utils/validation.js';
import { FileUtils } from '../utils/file-utils.js';

/**
 * 配置管理器
 * 负责 Provider 配置的读取、写入、验证和备份
 */
export class ConfigManager {
  private readonly configDir: string;
  private readonly configPath: string;
  private readonly backupDir: string;

  constructor() {
    this.configDir = path.join(os.homedir(), '.switch-claude');
    this.configPath = path.join(this.configDir, 'providers.json');
    this.backupDir = path.join(this.configDir, 'backups');
  }

  /**
   * 加载 Provider 配置
   */
  async loadProviders(): Promise<Provider[]> {
    if (!fs.existsSync(this.configPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const providers = JSON.parse(content) as Provider[];

      // 验证配置
      const errors = ValidationUtils.validateProviders(providers);
      if (errors.length > 0) {
        throw new Error(`配置验证失败:\n${errors.join('\n')}`);
      }

      return providers;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 保存 Provider 配置
   */
  async saveProviders(providers: Provider[]): Promise<void> {
    try {
      // 验证配置
      const errors = ValidationUtils.validateProviders(providers);
      if (errors.length > 0) {
        throw new Error(`配置验证失败:\n${errors.join('\n')}`);
      }

      // 确保目录存在
      FileUtils.ensureConfigDir();

      // 保存配置
      fs.writeFileSync(this.configPath, JSON.stringify(providers, null, 2));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 创建示例配置
   */
  async createExampleConfig(): Promise<void> {
    const exampleConfig: Provider[] = [
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
      {
        name: 'Provider3-WithProxy',
        baseUrl: 'https://api.example3.com',
        key: 'sk-your-api-key-here-replace-with-real-key',
        default: false,
        proxy: 'http://127.0.0.1:7897',
      },
    ];

    await this.saveProviders(exampleConfig);
  }

  /**
   * 导出配置
   */
  async exportConfig(providers: Provider[], outputPath?: string): Promise<string> {
    // 如果没有指定输出路径，使用默认文件名
    if (!outputPath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      outputPath = `switch-claude-backup-${timestamp}.json`;
    }

    // 添加元数据
    const exportData: ExportData = {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      providers,
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    return path.resolve(outputPath);
  }

  /**
   * 导入配置
   */
  async importConfig(inputPath: string, options: ImportOptions = {}): Promise<number> {
    try {
      // 读取导入文件
      const content = fs.readFileSync(inputPath, 'utf-8');
      const parsed = JSON.parse(content) as unknown;

      let importProviders: Provider[] | undefined;

      if (Array.isArray(parsed)) {
        importProviders = parsed as Provider[];
      } else if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as ExportData).providers)
      ) {
        importProviders = (parsed as ExportData).providers;
      }

      if (!importProviders) {
        throw new Error('导入文件格式无效：未找到 providers 数组');
      }

      let newProviders = [...importProviders];

      if (options.merge) {
        // 合并模式：与现有配置合并
        const existingProviders = await this.loadProviders();
        const existingNames = new Set(existingProviders.map((p) => p.name));

        // 只添加不重复的 Provider
        newProviders = newProviders.filter((p) => !existingNames.has(p.name));
        newProviders = [...existingProviders, ...newProviders];
      } else {
        // 替换模式：备份现有配置
        if (options.backup !== false) {
          const existingProviders = await this.loadProviders();
          if (existingProviders.length > 0) {
            await this.backupConfig(existingProviders);
          }
        }
      }

      // 保存新配置
      await this.saveProviders(newProviders);
      return newProviders.length;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 备份配置
   */
  async backupConfig(providers: Provider[]): Promise<string> {
    try {
      // 确保备份目录存在
      FileUtils.ensureBackupDir();

      // 生成备份文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const backupFile = path.join(this.backupDir, `backup-${timestamp}.json`);

      // 添加备份元数据
      const backupData = {
        version: '1.0.0',
        backupTime: new Date().toISOString(),
        providerCount: providers.length,
        providers,
      };

      fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

      // 清理旧备份
      FileUtils.cleanOldBackups();

      return backupFile;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 验证配置文件
   */
  validateConfig(providers: Provider[]): { valid: boolean; errors: string[] } {
    const errors = ValidationUtils.validateProviders(providers);
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 获取配置目录路径
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * 检查配置文件是否存在
   */
  configExists(): boolean {
    return fs.existsSync(this.configPath);
  }
}
