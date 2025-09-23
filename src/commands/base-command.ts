import type { CommandResult } from '../types';

/**
 * 基础命令抽象类
 * 所有命令都继承自此类
 */
export abstract class BaseCommand {
  protected readonly name: string;
  protected readonly description: string;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  /**
   * 执行命令
   */
  abstract execute(...args: unknown[]): Promise<CommandResult>;

  /**
   * 获取命令名称
   */
  getName(): string {
    return this.name;
  }

  /**
   * 获取命令描述
   */
  getDescription(): string {
    return this.description;
  }

  /**
   * 验证命令参数
   */
  protected validateArgs(args: unknown[], expectedTypes: string[]): CommandResult | null {
    if (args.length < expectedTypes.length) {
      return {
        success: false,
        error: `命令 ${this.name} 需要 ${expectedTypes.length} 个参数，但只提供了 ${args.length} 个`,
        exitCode: 1,
      };
    }

    for (let i = 0; i < expectedTypes.length; i++) {
      const arg = args[i];
      const expectedType = expectedTypes[i];

      if (expectedType === 'string' && typeof arg !== 'string') {
        return {
          success: false,
          error: `参数 ${i + 1} 应该是字符串类型`,
          exitCode: 1,
        };
      }

      if (expectedType === 'number' && typeof arg !== 'number') {
        return {
          success: false,
          error: `参数 ${i + 1} 应该是数字类型`,
          exitCode: 1,
        };
      }

      if (expectedType === 'boolean' && typeof arg !== 'boolean') {
        return {
          success: false,
          error: `参数 ${i + 1} 应该是布尔类型`,
          exitCode: 1,
        };
      }
    }

    return null;
  }

  /**
   * 创建成功结果
   */
  protected createSuccessResult(message?: string): CommandResult {
    return {
      success: true,
      message,
      exitCode: 0,
    };
  }

  /**
   * 创建错误结果
   */
  protected createErrorResult(error: string, exitCode: number = 1): CommandResult {
    return {
      success: false,
      error,
      exitCode,
    };
  }

  /**
   * 处理异步操作的错误
   */
  protected async handleAsyncOperation<T>(
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
   * 安全地执行可能抛出异常的操作
   */
  protected safeExecute<T>(
    operation: () => T,
    errorMessage: string = '操作失败'
  ): { success: boolean; result?: T; error?: string } {
    try {
      const result = operation();
      return { success: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `${errorMessage}: ${message}`,
      };
    }
  }
}
