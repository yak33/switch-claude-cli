import inquirer from 'inquirer';
import type { Provider } from '../types/index.js';
import { ValidationUtils } from '../utils/validation.js';

/**
 * CLI 交互界面
 * 处理用户交互和输入
 */
export class CliInterface {
  /**
   * 显示Provider选择菜单
   */
  static async selectProvider(providers: Provider[]): Promise<number | null> {
    if (providers.length === 0) {
      console.log('❌ 没有可用的 providers');
      return null;
    }

    if (providers.length === 1) {
      console.log(`✅ 自动选择唯一的 provider: ${providers[0]?.name}`);
      return 0;
    }

    const choices = providers.map((provider, index) => ({
      name: `${index + 1}. ${provider.name} (${provider.baseUrl})`,
      value: index
    }));

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: '请选择一个 Provider:',
        choices,
        pageSize: Math.min(choices.length, 10)
      }
    ]);

    return answer.provider as number;
  }

  /**
   * 交互式添加Provider
   */
  static async addProvider(existingProviders: Provider[]): Promise<Provider | null> {
    console.log('\\n🚀 添加新的 Provider\\n');

    const existingNames = existingProviders.map(p => p.name);

    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: '请输入 Provider 名称:',
          validate: (input: string) => {
            const result = ValidationUtils.validateProviderName(input, existingNames);
            return result.valid || result.error || false;
          }
        },
        {
          type: 'input',
          name: 'baseUrl',
          message: '请输入 API Base URL:',
          validate: (input: string) => {
            const result = ValidationUtils.validateUrl(input);
            return result.valid || result.error || false;
          }
        },
        {
          type: 'input',
          name: 'key',
          message: '请输入 API Key:',
          validate: (input: string) => {
            const result = ValidationUtils.validateApiKey(input);
            return result.valid || result.error || false;
          }
        },
        {
          type: 'confirm',
          name: 'setAsDefault',
          message: '是否设置为默认 Provider?',
          default: existingProviders.length === 0
        }
      ]);

      return {
        name: answers.name.trim(),
        baseUrl: answers.baseUrl.trim(),
        key: answers.key.trim(),
        default: answers.setAsDefault
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        console.log('\\n操作已取消');
        return null;
      }
      throw error;
    }
  }

  /**
   * 确认删除Provider
   */
  static async confirmRemoveProvider(provider: Provider): Promise<boolean> {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确定要删除 Provider "${provider.name}" 吗？`,
        default: false
      }
    ]);

    return answer.confirm as boolean;
  }

  /**
   * 选择导入模式
   */
  static async selectImportMode(): Promise<'replace' | 'merge' | null> {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: '选择导入模式:',
        choices: [
          { name: '替换现有配置', value: 'replace' },
          { name: '合并配置（保留现有同名 provider）', value: 'merge' },
          { name: '取消', value: 'cancel' }
        ]
      }
    ]);

    return answer.mode === 'cancel' ? null : (answer.mode as 'replace' | 'merge');
  }

  /**
   * 选择备份文件
   */
  static async selectBackupFile(backups: Array<{ name: string; path: string; time: Date }>): Promise<string | null> {
    if (backups.length === 0) {
      console.log('❌ 没有找到备份文件');
      return null;
    }

    const choices = backups.map(backup => ({
      name: `${backup.name} (${backup.time.toLocaleString()})`,
      value: backup.path
    }));

    choices.push({ name: '取消', value: 'cancel' });

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'backup',
        message: '选择要恢复的备份:',
        choices,
        pageSize: Math.min(choices.length, 10)
      }
    ]);

    return answer.backup === 'cancel' ? null : (answer.backup as string);
  }

  /**
   * 确认操作
   */
  static async confirmAction(message: string, defaultValue: boolean = false): Promise<boolean> {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message,
        default: defaultValue
      }
    ]);

    return answer.confirm as boolean;
  }

  /**
   * 输入文件路径
   */
  static async inputFilePath(message: string, defaultPath?: string): Promise<string | null> {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'filePath',
        message,
        default: defaultPath,
        validate: (input: string) => {
          if (!input.trim()) {
            return '文件路径不能为空';
          }
          const result = ValidationUtils.validateFilePath(input);
          return result.valid || result.error || false;
        }
      }
    ]);

    return answer.filePath?.trim() || null;
  }

  /**
   * 显示首次运行的欢迎信息
   */
  static showWelcomeMessage(configPath: string, editCommand: string): void {
    console.log(`
🎉 欢迎使用 Switch Claude CLI！

📂 配置目录已创建: ${configPath}

⚠️  请先编辑配置文件，添加你的 API 信息：

${editCommand}

📝 配置示例：
[
  {
    "name": "我的Claude服务",
    "baseUrl": "https://api.example.com",
    "key": "sk-your-real-api-key-here",
    "default": true
  }
]

💡 配置完成后，再次运行 switch-claude 即可开始使用！
`);
  }

  /**
   * 显示版本更新提醒
   */
  static showUpdateNotification(currentVersion: string, latestVersion: string): void {
    const borderLine = '═'.repeat(60);
    console.log(`
╔${borderLine}╗
║${' '.repeat(60)}║
║  🚀 发现新版本！                                        ║
║                                                          ║
║  当前版本: ${currentVersion.padEnd(12)} 最新版本: ${latestVersion.padEnd(12)}      ║
║                                                          ║
║  更新命令: npm update -g switch-claude-cli               ║
║                                                          ║
╚${borderLine}╝
`);
  }

  /**
   * 显示错误消息
   */
  static showError(message: string, details?: string): void {
    console.error(`❌ ${message}`);
    if (details) {
      console.error(`   ${details}`);
    }
  }

  /**
   * 显示成功消息
   */
  static showSuccess(message: string): void {
    console.log(`✅ ${message}`);
  }

  /**
   * 显示警告消息
   */
  static showWarning(message: string): void {
    console.warn(`⚠️  ${message}`);
  }

  /**
   * 显示信息消息
   */
  static showInfo(message: string): void {
    console.log(`ℹ️  ${message}`);
  }
}