import type { Provider } from '../types/index.js';

/**
 * 平台工具类
 * 处理跨平台兼容性问题
 */
export class PlatformUtils {
  /**
   * 获取当前平台类型
   */
  static getPlatform(): 'windows' | 'macos' | 'linux' | 'unknown' {
    const platform = process.platform;
    switch (platform) {
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'macos';
      case 'linux':
        return 'linux';
      default:
        return 'unknown';
    }
  }

  /**
   * 获取平台相关的配置编辑命令
   */
  static getConfigEditCommand(configPath: string): string {
    const platform = this.getPlatform();

    switch (platform) {
      case 'windows':
        return `notepad "${configPath}"`;
      case 'macos':
        return `open "${configPath}"`;
      case 'linux':
        return `${process.env.EDITOR || 'nano'} "${configPath}"`;
      default:
        return `${process.env.EDITOR || 'vi'} "${configPath}"`;
    }
  }

  /**
   * 查找Claude命令的路径
   */
  static async findClaudeCommand(): Promise<string | null> {
    const platform = this.getPlatform();
    const commands = platform === 'windows' ? ['where claude'] : ['which claude', 'command -v claude'];

    for (const cmd of commands) {
      try {
        const { execSync } = await import('child_process');
        const result = execSync(cmd, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 5000
        });

        const claudePath = result.trim();
        if (claudePath && claudePath !== '') {
          return claudePath;
        }
      } catch {
        // 继续尝试下一个命令
      }
    }

    // 尝试常见安装路径
    const commonPaths = this.getCommonClaudePaths();
    const { existsSync } = await import('fs');

    for (const path of commonPaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    // 检查环境变量
    const claudePath = process.env.CLAUDE_PATH;
    if (claudePath && existsSync(claudePath)) {
      return claudePath;
    }

    return null;
  }

  /**
   * 获取常见的Claude安装路径
   */
  private static getCommonClaudePaths(): string[] {
    const platform = this.getPlatform();

    switch (platform) {
      case 'windows':
        return [
          'C:\\Program Files\\Claude\\claude.exe',
          'C:\\Program Files (x86)\\Claude\\claude.exe',
          `${process.env.USERPROFILE}\\AppData\\Local\\Claude\\claude.exe`,
          `${process.env.USERPROFILE}\\AppData\\Roaming\\npm\\claude.cmd`,
          'claude.exe'
        ];
      case 'macos':
        return [
          '/Applications/Claude.app/Contents/MacOS/claude',
          '/usr/local/bin/claude',
          '/opt/homebrew/bin/claude',
          `${process.env.HOME}/.local/bin/claude`,
          '/usr/bin/claude'
        ];
      case 'linux':
        return [
          '/usr/local/bin/claude',
          '/usr/bin/claude',
          `${process.env.HOME}/.local/bin/claude`,
          '/snap/bin/claude',
          '/opt/claude/bin/claude'
        ];
      default:
        return ['/usr/local/bin/claude', '/usr/bin/claude'];
    }
  }

  /**
   * 检查终端是否支持颜色
   */
  static supportsColor(): boolean {
    return !!(
      process.stdout.isTTY &&
      (process.env.COLORTERM ||
        process.env.TERM === 'truecolor' ||
        process.env.TERM === 'xterm-256color' ||
        process.env.TERM === 'screen-256color')
    );
  }

  /**
   * 获取终端宽度
   */
  static getTerminalWidth(): number {
    return process.stdout.columns || 80;
  }

  /**
   * 检查是否在TTY环境中
   */
  static isTTY(): boolean {
    return process.stdout.isTTY;
  }

  /**
   * 格式化配置目录路径显示
   */
  static formatConfigDirForDisplay(configDir: string): string {
    const platform = this.getPlatform();
    const home = process.env.HOME || process.env.USERPROFILE || '';

    if (configDir.startsWith(home)) {
      const relativePath = configDir.substring(home.length);
      return platform === 'windows'
        ? `%USERPROFILE%${relativePath}`
        : `~${relativePath}`;
    }

    return configDir;
  }

  /**
   * 获取系统信息
   */
  static getSystemInfo(): {
    platform: string;
    arch: string;
    nodeVersion: string;
    osRelease?: string;
  } {
    const { arch, platform } = process;
    const nodeVersion = process.version;
    let osRelease: string | undefined;

    try {
      const os = require('os');
      osRelease = os.release();
    } catch {
      // os模块可能不可用
    }

    return {
      platform,
      arch,
      nodeVersion,
      osRelease
    };
  }

  /**
   * 安全地启动外部命令
   */
  static async spawnCommand(
    command: string,
    args: string[] = [],
    options: { cwd?: string; timeout?: number } = {}
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const { spawn } = await import('child_process');

      return new Promise((resolve) => {
        const child = spawn(command, args, {
          cwd: options.cwd || process.cwd(),
          stdio: ['inherit', 'pipe', 'pipe'],
          shell: this.getPlatform() === 'windows'
        });

        let output = '';
        let error = '';

        child.stdout?.on('data', (data) => {
          output += data.toString();
        });

        child.stderr?.on('data', (data) => {
          error += data.toString();
        });

        // 设置超时
        const timeout = options.timeout || 30000;
        const timer = setTimeout(() => {
          child.kill();
          resolve({ success: false, error: '命令执行超时' });
        }, timeout);

        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({
            success: code === 0,
            output: output.trim(),
            error: error.trim() || undefined
          });
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          resolve({
            success: false,
            error: err.message
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }
}