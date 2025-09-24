import inquirer from 'inquirer';
import type { Provider } from '../types';
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
      value: index,
    }));

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: '请选择一个 Provider:',
        choices,
        pageSize: Math.min(choices.length, 10),
      },
    ]);

    return answer.provider as number;
  }

  /**
   * 交互式添加Provider
   */
  static async addProvider(existingProviders: Provider[]): Promise<Provider | null> {
    console.log('\n🚀 添加新的 Provider\n');

    const existingNames = existingProviders.map((p) => p.name);

    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: '请输入 Provider 名称:',
          validate: (input: string) => {
            const result = ValidationUtils.validateProviderName(input, existingNames);
            return result.valid || result.error || false;
          },
        },
        {
          type: 'input',
          name: 'baseUrl',
          message: '请输入 API Base URL:',
          validate: (input: string) => {
            const result = ValidationUtils.validateUrl(input);
            return result.valid || result.error || false;
          },
        },
        {
          type: 'input',
          name: 'key',
          message: '请输入 API Key:',
          validate: (input: string) => {
            const result = ValidationUtils.validateApiKey(input);
            return result.valid || result.error || false;
          },
        },
        {
          type: 'confirm',
          name: 'setAsDefault',
          message: '是否设置为默认 Provider?',
          default: existingProviders.length === 0,
        },
      ]);

      return {
        name: answers.name.trim(),
        baseUrl: answers.baseUrl.trim(),
        key: answers.key.trim(),
        default: answers.setAsDefault,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        console.log('\n操作已取消');
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
        default: false,
      },
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
          { name: '取消', value: 'cancel' },
        ],
      },
    ]);

    return answer.mode === 'cancel' ? null : (answer.mode as 'replace' | 'merge');
  }

  /**
   * 选择备份文件
   */
  static async selectBackupFile(
    backups: Array<{ name: string; path: string; time: Date }>
  ): Promise<string | null> {
    if (backups.length === 0) {
      console.log('❌ 没有找到备份文件');
      return null;
    }

    const choices = backups.map((backup) => ({
      name: `${backup.name} (${backup.time.toLocaleString()})`,
      value: backup.path,
    }));

    choices.push({ name: '取消', value: 'cancel' });

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'backup',
        message: '选择要恢复的备份:',
        choices,
        pageSize: Math.min(choices.length, 10),
      },
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
        default: defaultValue,
      },
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
        },
      },
    ]);

    return answer.filePath?.trim() || null;
  }

  /**
   * 显示首次运行的欢迎信息和完整帮助
   */
  static showWelcomeAndHelp(version: string): void {
    console.log(`🎉 欢迎使用 Switch Claude CLI v${version}！`);
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

  /**
   * 询问是否使用交互式配置向导
   */
  static async askUseInteractiveSetup(): Promise<boolean> {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useInteractive',
        message: '是否使用交互式配置向导? (推荐)',
        default: true,
      },
    ]);

    return answer.useInteractive as boolean;
  }

  /**
   * 交互式配置向导
   */
  static async interactiveSetup(): Promise<{ provider: Provider; continueSetup: boolean } | null> {
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
          validate: (input: string) => (input.trim() ? true : '名称不能为空'),
        },
        {
          type: 'input',
          name: 'baseUrl',
          message: '请输入 API Base URL:',
          default: 'https://api.example.com',
          validate: (input: string) => {
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
          validate: (input: string) => {
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

      const provider: Provider = {
        name: answers.name.trim(),
        baseUrl: answers.baseUrl.trim(),
        key: answers.key.trim(),
        default: true,
      };

      return {
        provider,
        continueSetup: answers.continueSetup,
      };
    } catch (error) {
      if ((error as any)?.isTtyError || (error as any)?.name === 'ExitPromptError') {
        console.log(`\n\n⚠️  已取消配置。`);
        return null;
      } else {
        console.error(`❌ 配置过程中出现错误: ${(error as Error).message}`);
        return null;
      }
    }
  }

  /**
   * 显示首次运行的手动配置指引
   */
  static showManualConfigInstructions(configPath: string): void {
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
