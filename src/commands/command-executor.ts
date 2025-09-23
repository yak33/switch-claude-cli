import {BaseCommand} from './base-command.js';
import {ConfigManager} from '../core/config-manager.js';
import {ApiTester} from '../core/api-tester.js';
import {CacheManager} from '../core/cache-manager.js';
import {CliInterface} from '../ui/cli-interface.js';
import {OutputFormatter} from '../ui/output-formatter.js';
import {ProgressIndicator} from '../ui/progress-indicator.js';
import {ValidationUtils} from '../utils/validation.js';
import {PlatformUtils} from '../utils/platform-utils.js';
import {FileUtils} from '../utils/file-utils.js';
import type {Provider, CommandResult, CliOptions, TestResult} from '../types';
import updateNotifier from 'update-notifier';
import {spawn} from 'child_process';

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
            // 检查更新（后台执行）
            this.checkForUpdates();

            // 确保配置目录存在
            const isFirstRun = FileUtils.ensureConfigDir();

            if (isFirstRun || !FileUtils.fileExists(FileUtils.configPath)) {
                return await this.handleFirstRun();
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

            // 处理特殊命令
            if (options.list) {
                return this.executeListCommand(providers, options.verbose);
            }

            if (options.add) {
                return this.executeAddCommand(providers);
            }

            if (options.remove && providerIndex) {
                return this.executeRemoveCommand(providers, providerIndex);
            }

            if (options.setDefault && providerIndex) {
                return this.executeSetDefaultCommand(providers, providerIndex);
            }

            if (options.clearDefault) {
                return this.executeClearDefaultCommand(providers);
            }

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

            // 主要功能：选择并启动 Provider
            return await this.executeProviderSelection(providers, providerIndex, options);

        } catch (error) {
            return this.createErrorResult(
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    /**
     * 处理首次运行
     */
    private async handleFirstRun(): Promise<CommandResult> {
        console.log('🎉 欢迎使用 Switch Claude CLI！');
        console.log('📂 正在初始化配置...');

        // 创建示例配置
        const createResult = await this.handleAsyncOperation(
            () => this.configManager.createExampleConfig(),
            '创建示例配置失败'
        );

        if (!createResult.success) {
            return this.createErrorResult(createResult.error || '初始化失败');
        }

        // 显示欢迎信息
        const editCommand = PlatformUtils.getConfigEditCommand(FileUtils.configPath);
        CliInterface.showWelcomeMessage(FileUtils.configPath, editCommand);

        return this.createSuccessResult('配置初始化完成');
    }

    /**
     * 执行 Provider 选择和启动
     */
    private async executeProviderSelection(
        providers: Provider[],
        providerIndex?: string,
        options: CliOptions = {}
    ): Promise<CommandResult> {
        let selectedIndex: number;

        if (providerIndex) {
            // 直接指定索引
            const validation = ValidationUtils.validateProviderIndex(providerIndex, providers.length);
            if (!validation.valid) {
                return this.createErrorResult(validation.error || '无效索引');
            }
            selectedIndex = validation.value!;
        } else {
            // 查找默认 Provider 或交互式选择
            const defaultIndex = providers.findIndex(p => p.default);
            if (defaultIndex !== -1) {
                selectedIndex = defaultIndex;
                console.log(`✅ 使用默认 Provider: ${providers[defaultIndex]?.name}`);
            } else {
                const choice = await CliInterface.selectProvider(providers);
                if (choice === null) {
                    return this.createErrorResult('未选择 Provider', 0);
                }
                selectedIndex = choice;
            }
        }

        const selectedProvider = providers[selectedIndex];
        if (!selectedProvider) {
            return this.createErrorResult('Provider 不存在');
        }

        // 检测 Provider 可用性
        if (!options.refresh) {
            const cachedResult = this.cacheManager.getCachedResult(selectedProvider);
            if (cachedResult && cachedResult.available) {
                return this.launchClaude(selectedProvider, options.envOnly);
            }
        }

        // 执行检测
        console.log(`🔍 检测 ${selectedProvider.name} 可用性...`);
        const testResult = await this.apiTester.testProvider(selectedProvider, options.verbose);

        if (!testResult.available) {
            CliInterface.showError(`Provider "${selectedProvider.name}" 不可用`, testResult.error || undefined);
            return this.createErrorResult('Provider 不可用');
        }

        // 缓存结果
        this.cacheManager.cacheResult(selectedProvider, testResult);

        return this.launchClaude(selectedProvider, options.envOnly);
    }

    /**
     * 启动 Claude
     */
    private async launchClaude(provider: Provider, envOnly: boolean = false): Promise<CommandResult> {
        // 设置环境变量
        process.env.ANTHROPIC_API_URL = provider.baseUrl;
        process.env.ANTHROPIC_API_KEY = provider.key;

        console.log(`✅ 已设置环境变量:`);
        console.log(`   ANTHROPIC_API_URL=${provider.baseUrl}`);
        console.log(`   ANTHROPIC_API_KEY=${ValidationUtils.maskSensitiveData(provider.key)}`);

        if (envOnly) {
            return this.createSuccessResult('环境变量已设置，请手动运行 claude 命令');
        }

        // 查找并启动 Claude
        const claudePath = await PlatformUtils.findClaudeCommand();
        if (!claudePath) {
            CliInterface.showWarning('未找到 claude 命令，请确保 Claude Code 已正确安装');
            return this.createSuccessResult('环境变量已设置，请手动运行 claude 命令');
        }

        console.log(`🚀 启动 Claude Code...`);

        try {
            const claude = spawn(claudePath, [], {
                stdio: 'inherit',
                env: process.env
            });

            claude.on('error', (error) => {
                CliInterface.showError('启动 Claude 失败', error.message);
            });

            return this.createSuccessResult('Claude 已启动');
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
            providers.forEach(p => p.default = false);
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
    private async executeRemoveCommand(providers: Provider[], indexStr: string): Promise<CommandResult> {
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
    private async executeSetDefaultCommand(providers: Provider[], indexStr: string): Promise<CommandResult> {
        const validation = ValidationUtils.validateProviderIndex(indexStr, providers.length);
        if (!validation.valid) {
            return this.createErrorResult(validation.error || '无效索引');
        }

        const index = validation.value!;
        const provider = providers[index]!;

        // 清除所有默认设置
        providers.forEach(p => p.default = false);
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
        providers.forEach(p => p.default = false);

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
    private async executeExportCommand(providers: Provider[], filePath?: string): Promise<CommandResult> {
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
    private async executeImportCommand(filePath: string, merge: boolean = false): Promise<CommandResult> {
        const importResult = await this.handleAsyncOperation(
            () => this.configManager.importConfig(filePath, {merge}),
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
    private checkForUpdates(): void {
        try {
            // 这里需要从package.json读取版本信息
            // 由于在模块化环境中，我们需要动态导入
            import('../../package.json', {assert: {type: 'json'}})
                .then(({default: pkg}) => {
                    const notifier = updateNotifier({
                        pkg,
                        updateCheckInterval: 1000 * 60 * 60 * 6, // 6小时
                        shouldNotifyInNpmScript: false,
                    });

                    if (notifier.update) {
                        CliInterface.showUpdateNotification(
                            notifier.update.current,
                            notifier.update.latest
                        );
                    }
                })
                .catch(() => {
                    // 忽略更新检查错误
                });
        } catch {
            // 忽略更新检查错误
        }
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
            return {success: true, result};
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: `${errorMessage}: ${message}`
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
            exitCode: 0
        };
    }

    /**
     * 创建错误结果
     */
    private createErrorResult(error: string, exitCode: number = 1): CommandResult {
        return {
            success: false,
            error,
            exitCode
        };
    }
}