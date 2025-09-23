import type { Provider } from '../types';

/**
 * 数据验证工具类
 * 提供各种数据验证功能
 */
export class ValidationUtils {
  /**
   * 验证单个 Provider 配置
   */
  static validateProvider(provider: unknown, index: number): string[] {
    const errors: string[] = [];

    if (!provider || typeof provider !== 'object') {
      errors.push(`Provider [${index}]: 必须是对象`);
      return errors;
    }

    const p = provider as Record<string, unknown>;

    if (!p.name || typeof p.name !== 'string') {
      errors.push(`Provider [${index}]: 缺少有效的 name 字段`);
    }

    if (!p.baseUrl || typeof p.baseUrl !== 'string') {
      errors.push(`Provider [${index}]: 缺少有效的 baseUrl 字段`);
    } else {
      try {
        const url = new URL(p.baseUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push(`Provider [${index}]: baseUrl 必须是 HTTP 或 HTTPS 协议`);
        }
      } catch {
        errors.push(`Provider [${index}]: baseUrl 格式无效`);
      }
    }

    if (!p.key || typeof p.key !== 'string') {
      errors.push(`Provider [${index}]: 缺少有效的 key 字段`);
    } else if (p.key.length < 10) {
      errors.push(`Provider [${index}]: key 长度太短，请检查是否完整`);
    }

    return errors;
  }

  /**
   * 验证 Providers 配置数组
   */
  static validateProviders(providers: unknown): string[] {
    if (!Array.isArray(providers)) {
      return ['配置文件格式错误：providers 必须是数组'];
    }

    if (providers.length === 0) {
      return ['配置文件为空：至少需要一个 provider'];
    }

    const errors: string[] = [];
    const names = new Set<string>();

    providers.forEach((provider, index) => {
      const providerErrors = this.validateProvider(provider, index);
      errors.push(...providerErrors);

      // 检查名称重复
      if (provider && typeof provider === 'object') {
        const p = provider as Record<string, unknown>;
        if (typeof p.name === 'string') {
          if (names.has(p.name)) {
            errors.push(`Provider [${index}]: name "${p.name}" 重复`);
          } else {
            names.add(p.name);
          }
        }
      }
    });

    return errors;
  }

  /**
   * 验证 Provider 索引
   */
  static validateProviderIndex(index: string, maxIndex: number): { valid: boolean; value?: number; error?: string } {
    const num = parseInt(index, 10);

    if (isNaN(num)) {
      return { valid: false, error: '索引必须是数字' };
    }

    if (num < 1 || num > maxIndex) {
      return { valid: false, error: `索引必须在 1-${maxIndex} 之间` };
    }

    return { valid: true, value: num - 1 }; // 转换为0基础索引
  }

  /**
   * 验证文件路径
   */
  static validateFilePath(filePath: string): { valid: boolean; error?: string } {
    if (!filePath || filePath.trim() === '') {
      return { valid: false, error: '文件路径不能为空' };
    }

    // 检查路径中的非法字符
    const invalidChars = /[<>"|?*]/;
    if (invalidChars.test(filePath)) {
      return { valid: false, error: '文件路径包含非法字符' };
    }

    return { valid: true };
  }

  /**
   * 验证API Key格式
   */
  static validateApiKey(key: string): { valid: boolean; error?: string } {
    if (!key || key.trim() === '') {
      return { valid: false, error: 'API Key 不能为空' };
    }

    if (key.length < 10) {
      return { valid: false, error: 'API Key 长度太短' };
    }

    // 检查是否是示例Key
    const exampleKeys = [
      'sk-your-api-key-here',
      'cr_your-api-key-here',
      'custom_your-api-key-here'
    ];

    if (exampleKeys.some(example => key.includes(example))) {
      return { valid: false, error: '请替换为真实的 API Key' };
    }

    return { valid: true };
  }

  /**
   * 验证URL格式
   */
  static validateUrl(url: string): { valid: boolean; error?: string } {
    if (!url || url.trim() === '') {
      return { valid: false, error: 'URL 不能为空' };
    }

    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, error: 'URL 必须是 HTTP 或 HTTPS 协议' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'URL 格式无效' };
    }
  }

  /**
   * 验证Provider名称
   */
  static validateProviderName(name: string, existingNames: string[] = []): { valid: boolean; error?: string } {
    if (!name || name.trim() === '') {
      return { valid: false, error: 'Provider 名称不能为空' };
    }

    const trimmedName = name.trim();

    if (trimmedName.length > 50) {
      return { valid: false, error: 'Provider 名称不能超过50个字符' };
    }

    if (existingNames.includes(trimmedName)) {
      return { valid: false, error: 'Provider 名称已存在' };
    }

    return { valid: true };
  }

  /**
   * 掩码显示敏感信息（如API Key）
   */
  static maskSensitiveData(data: string, showChars: number = 12): string {
    if (data.length <= showChars) {
      return '*'.repeat(data.length);
    }
    return data.substring(0, showChars) + '*'.repeat(data.length - showChars);
  }

  /**
   * 检查是否为示例配置
   */
  static isExampleConfig(providers: Provider[]): boolean {
    return providers.some(provider =>
      provider.baseUrl.includes('example') ||
      provider.key.includes('your-api-key-here')
    );
  }
}