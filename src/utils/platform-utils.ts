// import type { Provider } from '../types/index.js';

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
    const { execSync } = await import('child_process');

    // 1) 常规方式：系统 PATH 中的可执行文件
    try {
      const cmd = platform === 'windows' ? 'where claude' : 'which claude';
      const out = execSync(cmd, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000,
      }).trim();
      if (out && out.startsWith('/') && out.includes('/')) return out;
    } catch {
      // ignore
    }

    // 2) 更强的方式：在用户默认 shell 的“登录+交互”环境里解析别名/函数
    if (platform !== 'windows') {
      try {
        const userShell = this.getUserShell();
        // 优先解析 alias，其次解析 type/whence 输出中的绝对路径
        const probe = `${userShell} -l -i -c "alias claude || type -a claude || whence -a claude || which claude || command -v claude"`;
        const out = execSync(probe, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 4000,
        }).trim();

        // 可能的输出样例（不同 shell 会有差异）
        // 策略：从每一行中提取第一个绝对路径返回
        const lines = out
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        for (const line of lines) {
          const pathMatch = line.match(/(\/[^\s'"`]+)/);
          if (pathMatch && pathMatch[1]) {
            return pathMatch[1];
          }

          // 部分 shell（如 bash）会输出 `claude=...`，此时 path 可能被引号包裹
          const aliasMatch = line.match(/^(?:alias\s+)?claude=(.*)$/);
          if (aliasMatch) {
            const rhsRaw = aliasMatch[1]!.trim();
            const firstToken = rhsRaw.split(/\s+/)[0] || '';
            const candidate = firstToken.replace(/^['"`]/, '').replace(/['"`]$/, '');
            if (candidate.startsWith('/')) {
              return candidate;
            }
          }
        }
      } catch {
        // ignore
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
          'claude.exe',
        ];
      case 'macos':
        return [
          '/Applications/Claude.app/Contents/MacOS/claude',
          '/usr/local/bin/claude',
          '/opt/homebrew/bin/claude',
          `${process.env.HOME}/.local/bin/claude`,
          '/usr/bin/claude',
        ];
      case 'linux':
        return [
          '/usr/local/bin/claude',
          '/usr/bin/claude',
          `${process.env.HOME}/.local/bin/claude`,
          '/snap/bin/claude',
          '/opt/claude/bin/claude',
        ];
      default:
        return ['/usr/local/bin/claude', '/usr/bin/claude'];
    }
  }

  /**
   * 获取用户的默认 Shell 路径
   * 用于在无法直接找到可执行文件时，回退到交互式登录 shell 启动命令
   */
  static getUserShell(): string {
    const platform = this.getPlatform();
    const envShell = process.env.SHELL;

    if (envShell && envShell.trim() !== '') return envShell;

    if (platform === 'windows') {
      // 在 Windows 上优先使用 ComSpec（通常为 cmd.exe），后续由调用方决定是否使用 PowerShell
      return process.env.ComSpec || 'cmd.exe';
    }

    // macOS 默认 zsh，Linux 默认 bash，最后回退到 /bin/sh
    if (platform === 'macos') return '/bin/zsh';
    if (platform === 'linux') return '/bin/bash';
    return '/bin/sh';
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
      return platform === 'windows' ? `%USERPROFILE%${relativePath}` : `~${relativePath}`;
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
      // 使用动态 require 来避免 ESM 导入问题
      const os = eval('require')('os');
      osRelease = os.release();
    } catch {
      // os模块可能不可用
    }

    return {
      platform,
      arch,
      nodeVersion,
      osRelease,
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
          shell: this.getPlatform() === 'windows',
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
            error: error.trim() || undefined,
          });
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          resolve({
            success: false,
            error: err.message,
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }
}
