import type { Provider, TestResult } from '../types';

/**
 * API 测试器
 * 负责检测 Provider 的可用性
 */
export class ApiTester {
  private readonly maxRetries: number;
  private readonly timeout: number;

  constructor(maxRetries: number = 2, timeout: number = 8000) {
    this.maxRetries = maxRetries;
    this.timeout = timeout;
  }

  /**
   * 测试单个 Provider
   * @param provider Provider 配置
   * @param verbose 是否显示详细信息
   * @returns 测试结果
   */
  async testProvider(provider: Provider, verbose: boolean = false): Promise<TestResult> {
    // 测试多种模型以支持不同类型的第三方服务
    const testModels = [
      { model: 'claude-sonnet-4-20250514', type: 'Claude' },
      { model: 'gpt-5', type: 'GPT' },
    ];

    const supportedModels: string[] = [];
    let bestResult: TestResult | null = null;

    // 测试每种模型
    for (const modelInfo of testModels) {
      if (verbose) {
        console.log(`    🔍 测试 ${modelInfo.type} 模型: ${modelInfo.model}`);
      }

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          const startTime = Date.now();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.timeout);

          if (verbose) {
            console.log(
              `    🌐 尝试 POST ${provider.baseUrl}/v1/messages (${modelInfo.type}, 尝试 ${attempt + 1}/${this.maxRetries + 1})`
            );
          }

          const options: RequestInit = {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${provider.key}`,
              'Content-Type': 'application/json',
              'User-Agent': 'switch-claude-cli/1.0.0',
            },
            signal: controller.signal,
            body: JSON.stringify({
              model: modelInfo.model,
              messages: [{ role: 'user', content: 'test' }],
              max_tokens: 1,
            }),
          };

          const res = await fetch(`${provider.baseUrl}/v1/messages`, options);
          clearTimeout(timeoutId);
          const responseTime = Date.now() - startTime;

          if (verbose) {
            console.log(
              `    ⏱️  响应时间: ${responseTime}ms, 状态: ${res.status} ${res.statusText}`
            );
          }

          // 扩展状态码处理：200/400/401/403/422/429 都说明服务可达
          if (res.ok || [400, 401, 403, 422, 429].includes(res.status)) {
            const isModelSupported = res.ok;

            if (isModelSupported) {
              supportedModels.push(modelInfo.type);
              if (verbose) {
                console.log(`    ✅ ${modelInfo.type} 模型支持`);
              }
            } else if (verbose) {
              console.log(`    ❌ ${modelInfo.type} 模型不支持 (${res.status})`);
            }

            // 记录最好的结果（优先选择成功的）
            if (!bestResult || res.ok) {
              bestResult = {
                available: true,
                status: res.status,
                endpoint: '/v1/messages',
                responseTime,
                supportedModels: [...supportedModels],
                error: res.ok ? null : this.getErrorMessage(res.status),
              };
            }

            // 如果成功了就跳到下一个模型
            if (res.ok) break;
          } else if (verbose) {
            console.log(`    ❌ 端点失败: ${res.status} ${res.statusText}`);
          }
        } catch (error) {
          const errorMsg = this.parseError(error);

          if (verbose) {
            console.log(`    ❌ 请求失败: ${errorMsg}`);
          }

          // 如果是最后一次尝试且没有任何成功结果，返回错误
          if (attempt === this.maxRetries && !bestResult) {
            return {
              available: false,
              status: null,
              endpoint: '/v1/messages',
              responseTime: null,
              supportedModels: [],
              error: errorMsg,
            };
          }

          if (attempt < this.maxRetries) {
            if (verbose) {
              console.log(`    ⏳ 等待1秒后重试...`);
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
    }

    // 返回最好的结果，如果没有任何成功就返回失败
    if (bestResult) {
      bestResult.supportedModels = supportedModels;
      return bestResult;
    }

    return {
      available: false,
      status: null,
      endpoint: '/v1/messages',
      responseTime: null,
      supportedModels: [],
      error: 'All models failed',
    };
  }

  /**
   * 批量测试多个 Provider
   * @param providers Provider 列表
   * @param verbose 是否显示详细信息
   * @returns 测试结果列表
   */
  async testProviders(providers: Provider[], verbose: boolean = false): Promise<TestResult[]> {
    const testPromises = providers.map(async (provider) => {
      return await this.testProvider(provider, verbose);
    });

    return await Promise.all(testPromises);
  }

  /**
   * 解析错误信息
   * @param error 错误对象
   * @returns 错误消息
   */
  private parseError(error: unknown): string {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return 'Timeout (8s)';
      }

      // 检查网络错误
      const message = error.message.toLowerCase();
      if (message.includes('enotfound')) {
        return 'DNS解析失败';
      }
      if (message.includes('econnrefused')) {
        return '连接被拒绝';
      }
      if (message.includes('etimedout')) {
        return '连接超时';
      }

      return error.message;
    }

    return String(error);
  }

  /**
   * 获取HTTP状态码对应的错误消息
   * @param status HTTP状态码
   * @returns 错误消息
   */
  private getErrorMessage(status: number): string {
    switch (status) {
      case 401:
        return '认证失败，请检查API Key';
      case 403:
        return '权限不足，请检查API Key权限';
      case 429:
        return '请求频率超限，服务可用';
      case 400:
        return '请求参数错误，可能模型不支持';
      case 422:
        return '模型不支持';
      default:
        return `HTTP ${status}`;
    }
  }
}
