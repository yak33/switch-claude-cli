import { ConfigManager } from '../core/config-manager.js';
import { ApiTester } from '../core/api-tester.js';
import { CacheManager } from '../core/cache-manager.js';
import { StatsManager } from '../core/stats-manager.js';
import { CliInterface } from '../ui/cli-interface.js';
import { OutputFormatter } from '../ui/output-formatter.js';
import { ProgressIndicator } from '../ui/progress-indicator.js';
import { ValidationUtils } from '../utils/validation.js';
import { PlatformUtils } from '../utils/platform-utils.js';
import { FileUtils } from '../utils/file-utils.js';
import type { Provider, CommandResult, CliOptions, TestResult } from '../types';
import updateNotifier from 'update-notifier';
import { spawn } from 'child_process';
import path from 'node:path';

/**
 * 命令执行器
 * 负责处理所有CLI命令
 */
export class CommandExecutor {
  private readonly configManager: ConfigManager;
  private readonly apiTester: ApiTester;
  private readonly cacheManager: CacheManager;

  constructor() {
    this.configManager = new ConfigManager();
    this.apiTester = new ApiTester();
    this.cacheManager = new CacheManager();
  }

  /**
   * 执行主命令
   */
  async executeMain(options: CliOptions, providerIndex?: string): Promise<CommandResult> {
    try {
      // 检查更新
      await this.checkForUpdates();

      // 优先处理不需要配置文件的命令
      if (options.stats) {
        return this.executeStatsCommand(options.verbose);
      }

      if (options.exportStats) {
        return this.executeExportStatsCommand(options.exportPath);
      }

      if (options.resetStats) {
        return this.executeResetStatsCommand();
      }

      // 确保配置目录存在
      const isFirstRun = FileUtils.ensureConfigDir();

      if (isFirstRun || !FileUtils.fileExists(FileUtils.configPath)) {
        const firstRunResult = await this.handleFirstRun();
        // 只有在用户选择继续时才继续执行主逻辑
        if (firstRunResult.success && firstRunResult.message === 'continue') {
          // 检查配置文件是否已创建且有效
          if (!FileUtils.fileExists(FileUtils.configPath)) {
            return this.createErrorResult('配置文件创建失败');
          }
          // 配置已创建，继续执行主逻辑
        } else {
          return firstRunResult; // 其他情况直接退出
        }
      }

      // 加载配置
      const loadResult = await this.handleAsyncOperation(
        () => this.configManager.loadProviders(),
        '加载配置失败'
      );

      if (!loadResult.success || !loadResult.result) {
        return this.createErrorResult(loadResult.error || '无法加载配置');
      }

      const providers = loadResult.result;

      // 处理不需要显示provider列表的命令
      if (options.export) {
        return this.executeExportCommand(providers, options.exportPath);
      }

      if (options.import && options.importPath) {
        return this.executeImportCommand(options.importPath, options.merge);
      }

      if (options.backup) {
        return this.executeBackupCommand(providers);
      }

      if (options.listBackups) {
        return this.executeListBackupsCommand();
      }

      // 选择性显示 provider 列表：
      // - --list: 必须显示
      // - --add: 作为参考显示（与原版一致）
      // - --remove/--set-default: 仅当未提供索引时显示，便于用户查看编号
      // - 主流程（无子命令时）依旧显示列表，再进入检测/选择流程
      const shouldShowList =
        options.list ||
        options.add ||
        ((options.remove || options.setDefault) && !options.providerIndex) ||
        (!options.list &&
          !options.add &&
          !options.remove &&
          !options.setDefault &&
          !options.clearDefault);

      if (shouldShowList) {
        console.log('📋 配置的 Provider 列表：\n');
        providers.forEach((p, i) => {
          console.log(`[${i + 1}] ${p.name} (${p.baseUrl})${p.default ? ' ⭐默认' : ''}`);
        });
      }

      // 处理需要显示provider列表的命令
      if (options.list) {
        return this.createSuccessResult();
      }

      if (options.add) {
        return this.executeAddCommand(providers);
      }

      if (options.remove && options.providerIndex) {
        return this.executeRemoveCommand(providers, options.providerIndex);
      }

      if (options.setDefault && options.providerIndex) {
        return this.executeSetDefaultCommand(providers, options.providerIndex);
      }

      if (options.clearDefault) {
        return this.executeClearDefaultCommand(providers);
      }

      // 主要功能：批量检测并选择Provider
      return await this.executeMainFlow(providers, providerIndex, options);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 处理首次运行
   */
  private async handleFirstRun(): Promise<CommandResult> {
    // 显示完整的欢迎信息和帮助
    const pkg = await this.getPackageInfo();
    CliInterface.showWelcomeAndHelp(pkg?.version || '1.0.0');

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔧 首次运行，正在初始化配置...`);

    // 询问用户是否使用交互式配置
    try {
      const useInteractive = await CliInterface.askUseInteractiveSetup();

      if (useInteractive) {
        const setupResult = await CliInterface.interactiveSetup();
        if (!setupResult) {
          // 用户取消了配置，回退到手动方式
          const createResult = await this.handleAsyncOperation(
            () => this.configManager.createExampleConfig(),
            '创建示例配置失败'
          );

          if (!createResult.success) {
            return this.createErrorResult(createResult.error || '初始化失败');
          }

          CliInterface.showManualConfigInstructions(FileUtils.configPath);
          return { success: true, message: '', exitCode: 0 };
        }

        // 保存交互式配置的结果
        const saveResult = await this.handleAsyncOperation(
          () => this.configManager.saveProviders([setupResult.provider]),
          '保存配置失败'
        );

        if (!saveResult.success) {
          return this.createErrorResult(saveResult.error || '保存配置失败');
        }

        console.log(`\n✅ 配置已保存到: ${FileUtils.configPath}`);

        if (setupResult.continueSetup) {
          console.log(`\n🎉 配置完成！现在开始检测 API 可用性...\n`);
          // 返回特殊的成功状态，让程序继续执行主逻辑
          return { success: true, message: 'continue', exitCode: 0 };
        } else {
          console.log(`\n💡 配置已完成，你可以随时运行 switch-claude 开始使用！`);
          return { success: true, message: '', exitCode: 0 };
        }
      } else {
        // 用户选择手动配置
        const createResult = await this.handleAsyncOperation(
          () => this.configManager.createExampleConfig(),
          '创建示例配置失败'
        );

        if (!createResult.success) {
          return this.createErrorResult(createResult.error || '初始化失败');
        }

        CliInterface.showManualConfigInstructions(FileUtils.configPath);
        return { success: true, message: '', exitCode: 0 };
      }
    } catch {
      // 如果交互式询问失败，回退到原来的方式
      const createResult = await this.handleAsyncOperation(
        () => this.configManager.createExampleConfig(),
        '创建示例配置失败'
      );

      if (!createResult.success) {
        return this.createErrorResult(createResult.error || '初始化失败');
      }

      CliInterface.showManualConfigInstructions(FileUtils.configPath);
      return { success: true, message: '', exitCode: 0 };
    }
  }

  /**
   * 执行主流程 - 完全按照原版逻辑
   */
  private async executeMainFlow(
    providers: Provider[],
    providerIndex?: string,
    options: CliOptions = {}
  ): Promise<CommandResult> {
    // 注意：Provider列表已经在调用此方法之前显示了

    // 1. 检查缓存
    const cache = options.refresh ? {} : this.cacheManager.getCache();
    const cacheKeys = Object.keys(cache);
    const hasCachedResults = cacheKeys.length > 0;

    let testResults: TestResult[] = [];

    // 检查是否所有provider都有缓存
    const allProvidersHaveCache = providers.every((p) => {
      const cacheKey = `${p.baseUrl}:${p.key.slice(-8)}`;
      return cache[cacheKey];
    });

    if (allProvidersHaveCache && hasCachedResults && !options.refresh) {
      console.log('\n💾 使用缓存结果 (5分钟内有效，使用 --refresh 强制刷新)：\n');

      // 所有provider都有缓存，直接使用
      testResults = providers.map((p) => {
        const cacheKey = `${p.baseUrl}:${p.key.slice(-8)}`;
        return cache[cacheKey];
      });
    } else {
      // 2. 混合使用缓存和实时检测
      if (hasCachedResults && !options.refresh) {
        console.log('\n💾 部分使用缓存结果 (5分钟内有效，使用 --refresh 强制刷新)：\n');
      } else {
        console.log('\n🔍 正在检测 API 可用性...\n');
      }

      if (!options.verbose) {
        // 非详细模式下显示进度条
        const progress = new ProgressIndicator({
          total: providers.length,
          message: '正在检测 API 可用性',
        });
        progress.start();

        const testPromises = providers.map(async (p, _i) => {
          const cacheKey = `${p.baseUrl}:${p.key.slice(-8)}`;
          if (cache[cacheKey] && !options.refresh) {
            if (progress) {
              progress.update(`${p.name}📋`);
            }
            return cache[cacheKey];
          }

          const result = await this.apiTester.testProvider(p, false);

          // 更新进度
          if (progress) {
            const status = result.available ? '✓' : '✗';
            progress.update(`${p.name}${status}`);
          }

          return result;
        });

        testResults = await Promise.all(testPromises);
        progress.finish();
      } else {
        // 详细模式下显示传统信息
        const testPromises = providers.map(async (p, i) => {
          const cacheKey = `${p.baseUrl}:${p.key.slice(-8)}`;
          if (cache[cacheKey] && !options.refresh) {
            console.log(`🔍 [${i + 1}] ${p.name}: 使用缓存结果`);
            return cache[cacheKey];
          }

          console.log(`🔍 [${i + 1}] ${p.name}: 开始检测...`);
          const result = await this.apiTester.testProvider(p, true);
          console.log(
            `🔍 [${i + 1}] ${p.name}: 检测完成 - ${result.available ? '可用' : '不可用'}`
          );

          return result;
        });

        testResults = await Promise.all(testPromises);
      }
    }

    // 3. 更新缓存
    const newCache: Record<string, TestResult> = {};
    providers.forEach((p, i) => {
      const cacheKey = `${p.baseUrl}:${p.key.slice(-8)}`;
      const result = testResults[i];
      if (result) {
        newCache[cacheKey] = result;
      }
    });
    this.cacheManager.saveCache(newCache);

    // 4. 显示检测结果
    const results = providers.map((p, i) => {
      const testResult = testResults[i];
      if (!testResult) {
        // 如果测试结果不存在，创建一个默认的失败结果
        console.log(`❌ [${i + 1}] ${p.name} 不可用 - 测试结果缺失`);
        StatsManager.recordProviderUse(p.baseUrl, false);
        return {
          ...p,
          ok: false,
          testResult: {
            available: false,
            status: null,
            endpoint: '/v1/messages',
            responseTime: null,
            supportedModels: [],
            error: '测试结果缺失',
          },
        };
      }

      const isAvailable = testResult.available;
      const cacheKey = `${p.baseUrl}:${p.key.slice(-8)}`;
      const fromCache = cache[cacheKey] && !options.refresh;

      let statusText = '';
      if (isAvailable) {
        statusText = `✅ [${i + 1}] ${p.name} 可用`;

        // 添加支持的模型类型显示
        if (testResult.supportedModels && testResult.supportedModels.length > 0) {
          statusText += ` (支持: ${testResult.supportedModels.join(', ')})`;
        }

        if (options.verbose && testResult.responseTime) {
          statusText += ` - (${testResult.status}) ${testResult.responseTime}ms`;
        }
        if (fromCache) statusText += ' 📋';
      } else {
        statusText = `❌ [${i + 1}] ${p.name} 不可用 - ${testResult.error}`;
        if (fromCache) statusText += ' 📋';
      }

      console.log(statusText);
      StatsManager.recordProviderUse(p.baseUrl, isAvailable, testResult.responseTime ?? null);
      return { ...p, ok: isAvailable, testResult };
    });

    // 5. 检查是否有可用的Provider
    const available = results.filter((p) => p.ok);
    if (available.length === 0) {
      return this.createErrorResult('🚨 没有可用的服务！');
    }

    // 6. 选择Provider
    let selected;

    if (providerIndex !== undefined) {
      const index = parseInt(providerIndex, 10) - 1; // 转换为 0-based index
      if (!isNaN(index) && index >= 0 && results[index] && results[index]!.ok) {
        selected = results[index]!;
        console.log(`\n👉 已通过编号选择: ${selected.name} (${selected.baseUrl})`);
      } else {
        return this.createErrorResult(`编号 ${providerIndex} 无效或该 provider 不可用`);
      }
    } else {
      const defaultProvider = results.find((p) => p.default && p.ok);
      if (defaultProvider) {
        selected = defaultProvider;
        console.log(`\n⭐ 已自动选择默认 provider: ${selected.name} (${selected.baseUrl})`);
      } else {
        // 没有默认 provider，总是显示交互式选择
        const _choices = available.map((p) => {
          // 通过 name 和 baseUrl 找到原始索引
          const originalIndex = providers.findIndex(
            (provider) => provider.name === p.name && provider.baseUrl === p.baseUrl
          );
          const displayIndex = originalIndex + 1;
          return {
            name: `[${displayIndex}] ${p.name} (${p.baseUrl})`,
            value: p,
          };
        });

        // 构造选择菜单
        const answer = await CliInterface.selectProvider(available);
        if (answer === null) {
          return this.createErrorResult('未选择 Provider', 0);
        }
        selected = available[answer]!;
      }
    }

    // 7. 启动Claude
    return this.launchClaude(selected, options.envOnly);
  }

  /**
   * 启动 Claude
   */
  private async launchClaude(
    provider: Provider & { testResult?: TestResult },
    envOnly: boolean = false
  ): Promise<CommandResult> {
    // 设置环境变量 - 使用原版的环境变量名称
    process.env.ANTHROPIC_BASE_URL = provider.baseUrl;
    process.env.ANTHROPIC_AUTH_TOKEN = provider.key;

    console.log(`\n✅ 已切换到: ${provider.name} (${provider.baseUrl})`);
    console.log(`\n🔧 环境变量已设置:`);
    console.log(`   ANTHROPIC_BASE_URL=${provider.baseUrl}`);
    console.log(`   ANTHROPIC_AUTH_TOKEN=${provider.key.slice(0, 12)}...`);

    const responseTime = provider.testResult?.responseTime ?? null;
    StatsManager.recordProviderUse(provider.name, true, responseTime);

    if (envOnly) {
      console.log(`\n📋 环境变量设置完成！你可以手动运行 claude 命令`);
      console.log(`\n💡 在当前会话中，你也可以使用这些命令：`);
      console.log(`   $env:ANTHROPIC_BASE_URL="${provider.baseUrl}"`);
      console.log(`   $env:ANTHROPIC_AUTH_TOKEN="${provider.key}"`);
      console.log(`   claude`);
      return { success: true, message: '', exitCode: 0 };
    }

    // 尝试启动 claude
    console.log(`\n🚀 正在启动 Claude Code...`);

    // 优先查找绝对路径，其次回退到用户登录 shell 执行
    const foundPath = await PlatformUtils.findClaudeCommand();
    const isAbs = foundPath
      ? PlatformUtils.getPlatform() === 'windows'
        ? true
        : path.isAbsolute(foundPath)
      : false;
    const claudePath = isAbs ? foundPath : null;
    if (claudePath) {
      console.log(`🔍 使用 claude 命令路径: ${claudePath}`);
    } else {
      console.log('🔍 使用 claude 命令路径: 未解析到二进制，尝试通过登录 shell 执行');
    }

    try {
      // 根据是否找到绝对路径，决定启动方式
      let command = claudePath || '';
      let args: string[] = [];
      let useShell = false;

      if (claudePath) {
        const platform = PlatformUtils.getPlatform();
        if (platform === 'windows') {
          const ext = path.extname(claudePath).toLowerCase();
          if (ext === '.cmd' || ext === '.bat') {
            command = 'cmd.exe';
            args = ['/c', 'claude'];
          } else if (ext === '.ps1') {
            command = 'powershell.exe';
            args = [
              '-NoProfile',
              '-ExecutionPolicy',
              'Bypass',
              '-File',
              claudePath,
            ];
          }
        } else {
          command = claudePath;
        }
      } else {
        // 回退：通过用户的默认 shell 以“登录 + 交互”方式执行，确保加载别名/函数
        const userShell = PlatformUtils.getUserShell();
        const platform = PlatformUtils.getPlatform();
        if (platform === 'windows') {
          // 在 Windows 上使用 cmd 执行（尽量避免对 PowerShell 的依赖）
          command = userShell; // 通常为 cmd.exe
          const winCmd = `set "ANTHROPIC_BASE_URL=${provider.baseUrl}" && set "ANTHROPIC_AUTH_TOKEN=${provider.key}" && claude`;
          args = ['/c', winCmd];
          useShell = false;
        } else {
          command = userShell;
          // -l 登录 shell（读取 zprofile/profile），-i 交互式（读取 zshrc/bashrc），-c 执行命令
          const exportCmd = `export ANTHROPIC_BASE_URL="${provider.baseUrl}"; export ANTHROPIC_AUTH_TOKEN="${provider.key}"; claude`;
          args = ['-l', '-i', '-c', exportCmd];
          useShell = false;
        }

        console.log(`🔁 通过登录 shell 启动: ${command} ${args.join(' ')}`);
      }

      const childEnv = { ...process.env };
      delete childEnv.NODE_OPTIONS;
      delete (childEnv as Record<string, unknown>).VSCODE_INSPECTOR_OPTIONS;

      // 为 Claude Code 设置正确的 stdin 配置以支持交互
      const claude = spawn(command || 'claude', args, {
        stdio: ['inherit', 'inherit', 'inherit'], // 继承 stdin, stdout, stderr
        env: childEnv,
        shell: useShell,
      });

      claude.on('error', (error: unknown) => {
        const err = error as { code?: string; message?: string };
        if (err && err.code === 'ENOENT') {
          console.error(`\n❌ 找不到 'claude' 命令！`);
          console.log(`\n💡 解决方案：`);
          console.log(`   1. 确保 Claude Code 已正确安装`);
          console.log(`   2. 检查 claude 命令是否在 PATH 环境变量中`);
          console.log(`   3. 或者手动设置环境变量后运行 claude：`);
          console.log(`      $env:ANTHROPIC_BASE_URL="${provider.baseUrl}"`);
          console.log(`      $env:ANTHROPIC_AUTH_TOKEN="${provider.key}"`);
          console.log(`      claude`);
          console.log(`\n🔍 当前 PATH 包含的目录：`);
          const paths = (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':');
          paths.slice(0, 5).forEach((p) => console.log(`   - ${p}`));
          if (paths.length > 5) {
            console.log(`   ... 还有 ${paths.length - 5} 个目录`);
          }
          if (!claudePath) {
            console.log('\n🔁 备用方案：你也可以运行 "switch-claude -e <编号>"');
            console.log('   然后在你的终端手动输入 "claude" 启动。');
          }
        } else {
          const msg = err && err.message ? err.message : String(error);
          console.error(`\n❌ 启动 claude 时出错: ${msg}`);
        }
        process.exit(1);
      });

      claude.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.log(`\n⚠️  Claude Code 退出，退出码: ${code}`);
        }
        process.exit(code || 0);
      });

      // 不返回结果，让程序继续运行等待Claude进程结束
      console.log('✅ Claude 已启动');

      // 返回一个永不resolve的Promise，让程序等待Claude进程结束
      return new Promise(() => {
        // 这个Promise永远不会resolve，程序会一直等待直到Claude进程退出并调用process.exit()
      });
    } catch (error) {
      return this.createErrorResult(
        `启动 Claude 失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 执行列表命令
   */
  private executeListCommand(providers: Provider[], verbose: boolean = false): CommandResult {
    const output = OutputFormatter.formatProviderList(providers, verbose);
    console.log(output);
    return this.createSuccessResult();
  }

  /**
   * 执行添加命令
   */
  private async executeAddCommand(providers: Provider[]): Promise<CommandResult> {
    const newProvider = await CliInterface.addProvider(providers);
    if (!newProvider) {
      return this.createErrorResult('添加操作已取消', 0);
    }

    // 如果设置为默认，清除其他默认设置
    if (newProvider.default) {
      providers.forEach((p) => (p.default = false));
    }

    providers.push(newProvider);

    const saveResult = await this.handleAsyncOperation(
      () => this.configManager.saveProviders(providers),
      '保存配置失败'
    );

    if (!saveResult.success) {
      return this.createErrorResult(saveResult.error || '保存失败');
    }

    return this.createSuccessResult(`Provider "${newProvider.name}" 添加成功`);
  }

  /**
   * 执行删除命令
   */
  private async executeRemoveCommand(
    providers: Provider[],
    indexStr: string
  ): Promise<CommandResult> {
    // 不允许删除最后一个 Provider，避免保存时报“配置文件为空”且信息重复
    if (providers.length <= 1) {
      return this.createErrorResult(
        '无法删除：至少需要一个 provider（请先添加新的 provider 后再删除）'
      );
    }

    const validation = ValidationUtils.validateProviderIndex(indexStr, providers.length);
    if (!validation.valid) {
      return this.createErrorResult(validation.error || '无效索引');
    }

    const index = validation.value!;
    const provider = providers[index]!;

    const confirmed = await CliInterface.confirmRemoveProvider(provider);
    if (!confirmed) {
      return this.createErrorResult('删除操作已取消', 0);
    }

    providers.splice(index, 1);

    const saveResult = await this.handleAsyncOperation(
      () => this.configManager.saveProviders(providers),
      '保存配置失败'
    );

    if (!saveResult.success) {
      return this.createErrorResult(saveResult.error || '保存失败');
    }

    return this.createSuccessResult(`Provider "${provider.name}" 删除成功`);
  }

  /**
   * 执行设置默认命令
   */
  private async executeSetDefaultCommand(
    providers: Provider[],
    indexStr: string
  ): Promise<CommandResult> {
    const validation = ValidationUtils.validateProviderIndex(indexStr, providers.length);
    if (!validation.valid) {
      return this.createErrorResult(validation.error || '无效索引');
    }

    const index = validation.value!;
    const provider = providers[index]!;

    // 清除所有默认设置
    providers.forEach((p) => (p.default = false));
    // 设置新的默认
    provider.default = true;

    const saveResult = await this.handleAsyncOperation(
      () => this.configManager.saveProviders(providers),
      '保存配置失败'
    );

    if (!saveResult.success) {
      return this.createErrorResult(saveResult.error || '保存失败');
    }

    return this.createSuccessResult(`Provider "${provider.name}" 已设置为默认`);
  }

  /**
   * 执行清除默认命令
   */
  private async executeClearDefaultCommand(providers: Provider[]): Promise<CommandResult> {
    providers.forEach((p) => (p.default = false));

    const saveResult = await this.handleAsyncOperation(
      () => this.configManager.saveProviders(providers),
      '保存配置失败'
    );

    if (!saveResult.success) {
      return this.createErrorResult(saveResult.error || '保存失败');
    }

    return this.createSuccessResult('已清除默认 Provider 设置');
  }

  /**
   * 执行导出命令
   */
  private async executeExportCommand(
    providers: Provider[],
    filePath?: string
  ): Promise<CommandResult> {
    const exportResult = await this.handleAsyncOperation(
      () => this.configManager.exportConfig(providers, filePath),
      '导出配置失败'
    );

    if (!exportResult.success) {
      return this.createErrorResult(exportResult.error || '导出失败');
    }

    return this.createSuccessResult(`配置已导出到: ${exportResult.result}`);
  }

  /**
   * 执行导入命令
   */
  private async executeImportCommand(
    filePath: string,
    merge: boolean = false
  ): Promise<CommandResult> {
    const importResult = await this.handleAsyncOperation(
      () => this.configManager.importConfig(filePath, { merge }),
      '导入配置失败'
    );

    if (!importResult.success) {
      return this.createErrorResult(importResult.error || '导入失败');
    }

    const mode = merge ? '合并' : '替换';
    return this.createSuccessResult(`配置已${mode}导入，共 ${importResult.result} 个 Provider`);
  }

  /**
   * 执行备份命令
   */
  private async executeBackupCommand(providers: Provider[]): Promise<CommandResult> {
    const backupResult = await this.handleAsyncOperation(
      () => this.configManager.backupConfig(providers),
      '备份配置失败'
    );

    if (!backupResult.success) {
      return this.createErrorResult(backupResult.error || '备份失败');
    }

    return this.createSuccessResult(`配置已备份到: ${backupResult.result}`);
  }

  /**
   * 执行列出备份命令
   */
  private executeListBackupsCommand(): CommandResult {
    const backups = FileUtils.getBackupFiles();
    const output = OutputFormatter.formatBackupList(backups);
    console.log(output);
    return this.createSuccessResult();
  }

  /**
   * 检查更新
   */
  private async checkForUpdates(): Promise<void> {
    try {
      const pkg = await this.getPackageInfo();

      if (!pkg) {
        return;
      }

      const notifier = updateNotifier({
        pkg,
        updateCheckInterval: 0,
        shouldNotifyInNpmScript: false,
      });

      const update = notifier.update;
      if (
        update &&
        update.latest &&
        update.current &&
        this.isVersionNewer(update.latest, update.current)
      ) {
        CliInterface.showUpdateNotification(update.current, update.latest);
        return;
      }

      try {
        const info = await notifier.fetchInfo();

        if (
          info.latest &&
          info.current &&
          this.isVersionNewer(info.latest, info.current)
        ) {
          CliInterface.showUpdateNotification(info.current, info.latest);
        }
      } catch {
        // 忽略细节错误，避免影响主流程
      }
    } catch {
      // 忽略更新检查错误
    }
  }

  private isVersionNewer(latest: string, current: string): boolean {
    const latestInfo = this.parseSemver(latest);
    const currentInfo = this.parseSemver(current);

    if (!latestInfo || !currentInfo) {
      return latest !== current;
    }

    const maxLength = Math.max(latestInfo.core.length, currentInfo.core.length);
    for (let i = 0; i < maxLength; i++) {
      const latestPart = latestInfo.core[i] ?? 0;
      const currentPart = currentInfo.core[i] ?? 0;
      if (latestPart > currentPart) {
        return true;
      }
      if (latestPart < currentPart) {
        return false;
      }
    }

    const latestPre = latestInfo.prerelease;
    const currentPre = currentInfo.prerelease;

    if (latestPre.length === 0 && currentPre.length === 0) {
      return false;
    }
    if (latestPre.length === 0) {
      return true;
    }
    if (currentPre.length === 0) {
      return false;
    }

    const len = Math.max(latestPre.length, currentPre.length);
    for (let i = 0; i < len; i++) {
      const latestId = latestPre[i];
      const currentId = currentPre[i];

      if (latestId === undefined) {
        return false;
      }
      if (currentId === undefined) {
        return true;
      }

      const latestIsNum = /^[0-9]+$/.test(latestId);
      const currentIsNum = /^[0-9]+$/.test(currentId);

      if (latestIsNum && currentIsNum) {
        const latestNum = Number.parseInt(latestId, 10);
        const currentNum = Number.parseInt(currentId, 10);
        if (latestNum > currentNum) {
          return true;
        }
        if (latestNum < currentNum) {
          return false;
        }
        continue;
      }

      if (latestIsNum !== currentIsNum) {
        return !latestIsNum;
      }

      const comparison = latestId.localeCompare(currentId);
      if (comparison > 0) {
        return true;
      }
      if (comparison < 0) {
        return false;
      }
    }

    return false;
  }

  private parseSemver(
    version: string
  ): { core: number[]; prerelease: string[] } | null {
    if (!version || typeof version !== 'string') {
      return null;
    }

    const cleaned = version.split('+')[0]?.trim();
    if (!cleaned) {
      return null;
    }

    const [corePart, prereleasePart] = cleaned.split('-');
    const coreSegments = corePart
      .split('.')
      .map((segment) => Number.parseInt(segment, 10))
      .map((value) => (Number.isNaN(value) ? 0 : value));

    const prereleaseSegments = prereleasePart
      ? prereleasePart.split('.').filter((segment) => segment.length > 0)
      : [];

    return {
      core: coreSegments,
      prerelease: prereleaseSegments,
    };
  }

  /**
   * 处理异步操作的错误
   */
  private async handleAsyncOperation<T>(
    operation: () => Promise<T>,
    errorMessage: string = '操作失败'
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    try {
      const result = await operation();
      return { success: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `${errorMessage}: ${message}`,
      };
    }
  }

  /**
   * 创建成功结果
   */
  private createSuccessResult(message?: string): CommandResult {
    return {
      success: true,
      message,
      exitCode: 0,
    };
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(error: string, exitCode: number = 1): CommandResult {
    return {
      success: false,
      error,
      exitCode,
    };
  }

  /**
   * 执行统计命令
   */
  private executeStatsCommand(verbose: boolean = false): CommandResult {
    StatsManager.cleanupOldStats();
    StatsManager.displayStats(verbose);
    return this.createSuccessResult();
  }

  /**
   * 执行导出统计命令
   */
  private executeExportStatsCommand(filePath?: string): CommandResult {
    const targetPath =
      filePath && filePath.trim() !== '' ? filePath : StatsManager.generateExportFilename();
    const exportedPath = StatsManager.exportStats(targetPath);

    if (exportedPath) {
      return this.createSuccessResult(`统计数据已导出到: ${exportedPath}`);
    }

    return this.createErrorResult('导出统计数据失败');
  }

  /**
   * 执行重置统计命令
   */
  private executeResetStatsCommand(): CommandResult {
    StatsManager.resetStats();
    return this.createSuccessResult('统计数据已重置');
  }

  /**
   * 获取包信息
   */
  private async getPackageInfo(): Promise<{ version: string; name: string } | null> {
    return FileUtils.getPackageInfo();
  }
}
