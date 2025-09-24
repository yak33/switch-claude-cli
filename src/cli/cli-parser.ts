import type { CliOptions } from '../types';
import { OutputFormatter } from '../ui/output-formatter.js';
import { FileUtils } from '../utils/file-utils.js';

/**
 * CLI 参数解析器
 * 负责解析命令行参数
 */
export class CliParser {
  /**
   * 解析命令行参数
   */
  static parseArgs(args: string[]): {
    options: CliOptions;
    providerIndex?: string;
    showHelp: boolean;
    showVersion: boolean;
  } {
    const options: CliOptions = {};
    let providerIndex: string | undefined;
    let showHelp = false;
    let showVersion = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '-h':
        case '--help':
          showHelp = true;
          break;

        case '-V':
        case '--version':
          showVersion = true;
          break;

        case '-r':
        case '--refresh':
          options.refresh = true;
          break;

        case '-v':
        case '--verbose':
          options.verbose = true;
          break;

        case '-l':
        case '--list':
          options.list = true;
          break;

        case '-e':
        case '--env-only':
          options.envOnly = true;
          break;

        case '--add':
          options.add = true;
          break;

        case '--remove':
          options.remove = true;
          if (i + 1 < args.length && !args[i + 1]?.startsWith('-')) {
            options.providerIndex = args[++i];
          }
          break;

        case '--set-default':
          options.setDefault = true;
          if (i + 1 < args.length && !args[i + 1]?.startsWith('-')) {
            options.providerIndex = args[++i];
          }
          break;

        case '--clear-default':
          options.clearDefault = true;
          break;

        case '--export':
          options.export = true;
          if (i + 1 < args.length && !args[i + 1]?.startsWith('-')) {
            options.exportPath = args[++i];
          }
          break;

        case '--import':
          options.import = true;
          if (i + 1 < args.length && !args[i + 1]?.startsWith('-')) {
            options.importPath = args[++i];
          }
          break;

        case '--merge':
          options.merge = true;
          break;

        case '--backup':
          options.backup = true;
          break;

        case '--list-backups':
          options.listBackups = true;
          break;

        case '--check-update':
          options.checkUpdate = true;
          break;

        case '--stats':
          options.stats = true;
          break;

        case '--export-stats':
          options.exportStats = true;
          if (i + 1 < args.length && !args[i + 1]?.startsWith('-')) {
            options.exportPath = args[++i];
          }
          break;

        case '--reset-stats':
          options.resetStats = true;
          break;

        default:
          // 如果是数字，可能是 provider 索引
          if (/^\d+$/.test(arg) && !providerIndex) {
            providerIndex = arg;
          } else if (arg.startsWith('-')) {
            // 无效的选项
            throw new Error(`未知选项: ${arg}`);
          }
          break;
      }
    }

    // 如果有 providerIndex 选项但没有值，使用位置参数
    if ((options.remove || options.setDefault) && !options.providerIndex && providerIndex) {
      options.providerIndex = providerIndex;
      providerIndex = undefined;
    }

    return {
      options,
      providerIndex,
      showHelp,
      showVersion,
    };
  }

  /**
   * 验证参数组合
   */
  static validateOptions(options: CliOptions): { valid: boolean; error?: string } {
    // 检查互斥选项
    const mutuallyExclusive = [
      'list',
      'add',
      'remove',
      'setDefault',
      'clearDefault',
      'export',
      'import',
      'backup',
      'listBackups',
      'stats',
    ];

    const activeOptions = mutuallyExclusive.filter((key) => options[key as keyof CliOptions]);

    if (activeOptions.length > 1) {
      return {
        valid: false,
        error: `选项冲突: ${activeOptions.join(', ')} 不能同时使用`,
      };
    }

    // 检查必需的参数
    if (options.remove && !options.providerIndex) {
      return {
        valid: false,
        error: '--remove 需要指定 provider 编号',
      };
    }

    if (options.setDefault && !options.providerIndex) {
      return {
        valid: false,
        error: '--set-default 需要指定 provider 编号',
      };
    }

    if (options.import && !options.importPath) {
      return {
        valid: false,
        error: '--import 需要指定文件路径',
      };
    }

    if (options.merge && !options.import) {
      return {
        valid: false,
        error: '--merge 只能与 --import 一起使用',
      };
    }

    return { valid: true };
  }

  /**
   * 显示帮助信息
   */
  static showHelp(): void {
    const pkg = FileUtils.getPackageInfo();
    console.log(OutputFormatter.formatHelpMessage(pkg?.version));
  }

  /**
   * 显示版本信息
   */
  static async showVersion(): Promise<void> {
    try {
      // 使用FileUtils获取package.json信息
      const pkg = FileUtils.getPackageInfo();

      if (!pkg) {
        console.log('Switch Claude CLI (版本信息不可用)');
        return;
      }

      // 检查更新
      const updateNotifier = (await import('update-notifier')).default;
      const notifier = updateNotifier({
        pkg,
        updateCheckInterval: 0, // 立即检查
        shouldNotifyInNpmScript: false,
      });

      const hasUpdate = !!notifier.update;
      const latestVersion = notifier.update?.latest;

      const versionInfo = OutputFormatter.formatVersionInfo(pkg.version, hasUpdate, latestVersion);

      console.log(versionInfo);
    } catch {
      console.log('Switch Claude CLI (版本信息不可用)');
    }
  }

  /**
   * 获取使用说明
   */
  static getUsage(): string {
    return `
用法: switch-claude [选项] [provider编号]

常用命令:
  switch-claude              # 交互式选择 provider
  switch-claude 1            # 直接选择编号为 1 的 provider
  switch-claude --add        # 添加新的 provider
  switch-claude --list       # 列出所有 providers

使用 --help 查看完整帮助信息
`;
  }
}
