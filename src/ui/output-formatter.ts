import type { Provider, TestResult } from '../types';
import { ValidationUtils } from '../utils/validation.js';
import { PlatformUtils } from '../utils/platform-utils.js';

/**
 * 输出格式化工具
 * 负责格式化各种输出内容
 */
export class OutputFormatter {
  /**
   * 格式化Provider列表
   */
  static formatProviderList(providers: Provider[], showDetails: boolean = false): string {
    if (providers.length === 0) {
      return '📭 没有配置任何 providers';
    }

    const lines: string[] = [];
    lines.push('📋 Provider 列表:\n');

    providers.forEach((provider, index) => {
      const defaultMark = provider.default ? ' 🌟 [默认]' : '';
      const maskedKey = ValidationUtils.maskSensitiveData(provider.key, 12);

      lines.push(`${index + 1}. ${provider.name}${defaultMark}`);

      if (showDetails) {
        lines.push(`   📍 URL: ${provider.baseUrl}`);
        lines.push(`   🔑 Key: ${maskedKey}`);
        lines.push('');
      }
    });

    return lines.join('\n');
  }

  /**
   * 格式化测试结果
   */
  static formatTestResults(results: Map<string, TestResult>, verbose: boolean = false): string {
    const lines: string[] = [];
    const available: string[] = [];
    const unavailable: string[] = [];

    for (const [providerName, result] of results) {
      if (result.available) {
        const responseTime = result.responseTime ? ` (${result.responseTime}ms)` : '';
        const models =
          result.supportedModels.length > 0 ? ` [${result.supportedModels.join(', ')}]` : '';
        available.push(`✅ ${providerName}${responseTime}${models}`);
      } else {
        const error = verbose && result.error ? ` - ${result.error}` : '';
        unavailable.push(`❌ ${providerName}${error}`);
      }
    }

    if (available.length > 0) {
      lines.push('🟢 可用的 Providers:');
      lines.push(...available.map((line) => `  ${line}`));
      lines.push('');
    }

    if (unavailable.length > 0) {
      lines.push('🔴 不可用的 Providers:');
      lines.push(...unavailable.map((line) => `  ${line}`));
      lines.push('');
    }

    if (available.length === 0 && unavailable.length === 0) {
      lines.push('⚪ 没有测试结果');
    }

    return lines.join('\n');
  }

  /**
   * 格式化帮助信息
   */
  static formatHelpMessage(version?: string): string {
    return `
📚 Switch Claude CLI - Claude API Provider 切换工具${version ? ` (v${version})` : ''}

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
  --edit <编号>       编辑指定编号的 provider
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
  switch-claude --edit 2  # 编辑编号为 2 的 provider
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
`;
  }

  /**
   * 格式化版本信息
   */
  static formatVersionInfo(
    version: string,
    hasUpdate: boolean = false,
    latestVersion?: string
  ): string {
    const lines: string[] = [];
    lines.push(`Switch Claude CLI v${version}`);

    if (hasUpdate && latestVersion) {
      lines.push('');
      lines.push(`🚀 发现新版本 v${latestVersion}！`);
      lines.push('更新命令: npm update -g switch-claude-cli');
    }

    return lines.join('\n');
  }

  /**
   * 格式化备份列表
   */
  static formatBackupList(backups: Array<{ name: string; path: string; time: Date }>): string {
    if (backups.length === 0) {
      return '📭 没有找到备份文件';
    }

    const lines: string[] = [];
    lines.push('📋 备份文件列表:\n');

    backups.forEach((backup, index) => {
      lines.push(`${index + 1}. ${backup.name}`);
      lines.push(`   📅 时间: ${backup.time.toLocaleString()}`);
      lines.push(`   📁 路径: ${backup.path}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * 格式化配置目录信息
   */
  static formatConfigInfo(configDir: string, configExists: boolean): string {
    const lines: string[] = [];
    const displayPath = PlatformUtils.formatConfigDirForDisplay(configDir);

    lines.push('📂 配置信息:');
    lines.push(`   目录: ${displayPath}`);
    lines.push(`   状态: ${configExists ? '✅ 已配置' : '❌ 未配置'}`);

    return lines.join('\n');
  }

  /**
   * 格式化系统信息
   */
  static formatSystemInfo(): string {
    const info = PlatformUtils.getSystemInfo();
    const lines: string[] = [];

    lines.push('🖥️  系统信息:');
    lines.push(`   平台: ${info.platform} (${info.arch})`);
    lines.push(`   Node.js: ${info.nodeVersion}`);
    if (info.osRelease) {
      lines.push(`   系统版本: ${info.osRelease}`);
    }

    return lines.join('\n');
  }

  /**
   * 格式化错误信息
   */
  static formatError(error: Error | string, context?: string): string {
    const message = error instanceof Error ? error.message : error;
    const lines: string[] = [];

    lines.push('❌ 错误信息:');
    if (context) {
      lines.push(`   上下文: ${context}`);
    }
    lines.push(`   详情: ${message}`);

    return lines.join('\n');
  }

  /**
   * 格式化成功消息
   */
  static formatSuccess(message: string, details?: string): string {
    const lines: string[] = [];
    lines.push(`✅ ${message}`);

    if (details) {
      lines.push(`   ${details}`);
    }

    return lines.join('\n');
  }

  /**
   * 格式化表格
   */
  static formatTable(
    headers: string[],
    rows: string[][],
    options: { maxWidth?: number; padding?: number } = {}
  ): string {
    const { maxWidth = PlatformUtils.getTerminalWidth(), padding = 2 } = options;

    if (rows.length === 0) {
      return '';
    }

    // 计算每列的最大宽度
    const colWidths = headers.map((header, colIndex) => {
      const headerWidth = header.length;
      const maxDataWidth = Math.max(...rows.map((row) => (row[colIndex] || '').length));
      return Math.max(headerWidth, maxDataWidth);
    });

    // 调整列宽以适应终端宽度
    const totalWidth = colWidths.reduce((sum, width) => sum + width + padding, 0);
    if (totalWidth > maxWidth) {
      const availableWidth = maxWidth - colWidths.length * padding;
      const ratio = availableWidth / colWidths.reduce((sum, width) => sum + width, 0);
      colWidths.forEach((_, index) => {
        colWidths[index] = Math.floor(colWidths[index] * ratio);
      });
    }

    const lines: string[] = [];

    // 表头
    const headerLine = headers
      .map((header, index) => header.padEnd(colWidths[index] || 0))
      .join(' '.repeat(padding));
    lines.push(headerLine);

    // 分隔线
    const separatorLine = colWidths.map((width) => '-'.repeat(width)).join(' '.repeat(padding));
    lines.push(separatorLine);

    // 数据行
    rows.forEach((row) => {
      const dataLine = row
        .map((cell, index) => {
          const width = colWidths[index] || 0;
          const truncated = cell.length > width ? `${cell.substring(0, width - 3)}...` : cell;
          return truncated.padEnd(width);
        })
        .join(' '.repeat(padding));
      lines.push(dataLine);
    });

    return lines.join('\n');
  }

  /**
   * 格式化进度条
   */
  static formatProgressBar(completed: number, total: number, width: number = 30): string {
    const percentage = Math.min(100, Math.max(0, (completed / total) * 100));
    const filledWidth = Math.floor((percentage / 100) * width);
    const emptyWidth = width - filledWidth;

    const filled = '█'.repeat(filledWidth);
    const empty = '░'.repeat(emptyWidth);
    const percentText = `${percentage.toFixed(1)}%`;

    return `[${filled}${empty}] ${percentText}`;
  }
}
