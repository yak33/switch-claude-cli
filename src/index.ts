#!/usr/bin/env node

import { CliParser } from './cli/cli-parser.js';
import { CommandExecutor } from './commands/command-executor.js';
import { CliInterface } from './ui/cli-interface.js';
import { StatsManager } from './core/stats-manager.js';

/**
 * 主入口函数
 */
async function main(): Promise<void> {
  try {
    // 解析命令行参数
    const args = process.argv.slice(2);
    const { options, providerIndex, showHelp, showVersion } = CliParser.parseArgs(args);

    // 记录命令使用（统计功能）
    const commandName = getCommandName(options);
    StatsManager.recordCommand(commandName);

    // 处理帮助和版本
    if (showHelp) {
      CliParser.showHelp();
      process.exit(0);
    }

    if (showVersion) {
      await CliParser.showVersion();
      process.exit(0);
    }

    // 验证参数
    const validation = CliParser.validateOptions(options);
    if (!validation.valid) {
      CliInterface.showError('参数错误', validation.error);
      console.log(CliParser.getUsage());
      process.exit(1);
    }

    // 执行命令
    const executor = new CommandExecutor();
    const result = await executor.executeMain(options, providerIndex);

    // 处理结果
    if (result.success) {
      if (result.message) {
        CliInterface.showSuccess(result.message);
      }
      process.exit(result.exitCode || 0);
    } else {
      CliInterface.showError('执行失败', result.error);
      process.exit(result.exitCode || 1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // 如果是未知选项错误，显示使用帮助
    if (errorMessage.includes('未知选项:')) {
      CliInterface.showError('参数错误', errorMessage);
      console.log('\n' + CliParser.getUsage());
    } else {
      CliInterface.showError('程序异常', errorMessage);
    }
    
    process.exit(1);
  }
}

/**
 * 获取命令名称用于统计
 */
function getCommandName(options: any): string {
  if (options.list) return 'list';
  if (options.add) return 'add';
  if (options.remove) return 'remove';
  if (options.setDefault) return 'set-default';
  if (options.clearDefault) return 'clear-default';
  if (options.export) return 'export';
  if (options.import) return 'import';
  if (options.backup) return 'backup';
  if (options.listBackups) return 'list-backups';
  if (options.stats) return 'stats';
  if (options.exportStats) return 'export-stats';
  if (options.resetStats) return 'reset-stats';
  return 'switch';
}

/**
 * 处理未捕获的异常
 */
process.on('uncaughtException', (error) => {
  console.error('❌ 程序发生未捕获的异常:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ 程序发生未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

// 启动应用
main();
