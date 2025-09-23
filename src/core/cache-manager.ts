import fs from 'fs';
import path from 'path';
import os from 'os';
import type { CacheData, TestResult, Provider } from '../types';

/**
 * 缓存管理器
 * 负责API检测结果的缓存管理
 */
export class CacheManager {
  private readonly cacheFile: string;
  private readonly cacheDuration: number;

  constructor(cacheDuration: number = 5 * 60 * 1000) { // 默认5分钟
    this.cacheFile = path.join(os.homedir(), '.switch-claude', 'cache.json');
    this.cacheDuration = cacheDuration;
  }

  /**
   * 生成缓存键
   * @param provider Provider配置
   * @returns 缓存键
   */
  private generateCacheKey(provider: Provider): string {
    return `${provider.baseUrl}:${provider.key.slice(-8)}`;
  }

  /**
   * 加载缓存
   * @returns 缓存结果
   */
  loadCache(): Record<string, TestResult> {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        return {};
      }
      
      const cache = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8')) as CacheData;
      
      // 检查缓存是否过期
      if (cache.timestamp && Date.now() - cache.timestamp < this.cacheDuration) {
        return cache.results;
      }
      
      return {};
    } catch (error) {
      console.warn('⚠️ 缓存加载失败:', error instanceof Error ? error.message : String(error));
      return {};
    }
  }

  /**
   * 保存缓存
   * @param results 测试结果
   */
  saveCache(results: Record<string, TestResult>): void {
    try {
      const cacheData: CacheData = {
        timestamp: Date.now(),
        results,
      };
      
      // 确保目录存在
      const cacheDir = path.dirname(this.cacheFile);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.warn('⚠️ 缓存保存失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 获取Provider的缓存结果
   * @param provider Provider配置
   * @returns 缓存的测试结果，如果没有或过期则返回null
   */
  getCachedResult(provider: Provider): TestResult | null {
    const cache = this.loadCache();
    const cacheKey = this.generateCacheKey(provider);
    return cache[cacheKey] || null;
  }

  /**
   * 设置Provider的缓存结果
   * @param provider Provider配置
   * @param result 测试结果
   */
  setCachedResult(provider: Provider, result: TestResult): void {
    const cache = this.loadCache();
    const cacheKey = this.generateCacheKey(provider);
    cache[cacheKey] = result;
    this.saveCache(cache);
  }

  /**
   * 批量获取缓存结果
   * @param providers Provider列表
   * @returns 缓存结果映射
   */
  getBatchCachedResults(providers: Provider[]): Map<string, TestResult> {
    const cache = this.loadCache();
    const results = new Map<string, TestResult>();
    
    providers.forEach((provider, index) => {
      const cacheKey = this.generateCacheKey(provider);
      const cachedResult = cache[cacheKey];
      if (cachedResult) {
        results.set(String(index), cachedResult);
      }
    });
    
    return results;
  }

  /**
   * 批量保存缓存结果
   * @param providers Provider列表
   * @param results 测试结果列表
   */
  setBatchCachedResults(providers: Provider[], results: TestResult[]): void {
    const cache = this.loadCache();
    
    providers.forEach((provider, index) => {
      if (results[index]) {
        const cacheKey = this.generateCacheKey(provider);
        cache[cacheKey] = results[index];
      }
    });
    
    this.saveCache(cache);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
      }
    } catch (error) {
      console.warn('⚠️ 缓存清除失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 清除特定Provider的缓存
   * @param provider Provider配置
   */
  clearProviderCache(provider: Provider): void {
    const cache = this.loadCache();
    const cacheKey = this.generateCacheKey(provider);
    
    if (cache[cacheKey]) {
      delete cache[cacheKey];
      this.saveCache(cache);
    }
  }

  /**
   * 检查缓存是否存在且有效
   * @returns 是否有有效缓存
   */
  hasValidCache(): boolean {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        return false;
      }
      
      const cache = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8')) as CacheData;
      return Boolean(cache.timestamp && Date.now() - cache.timestamp < this.cacheDuration);
    } catch {
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    exists: boolean;
    isValid: boolean;
    age: number;
    entryCount: number;
    sizeBytes: number;
  } {
    const stats = {
      exists: false,
      isValid: false,
      age: 0,
      entryCount: 0,
      sizeBytes: 0,
    };

    try {
      if (!fs.existsSync(this.cacheFile)) {
        return stats;
      }

      const fileStats = fs.statSync(this.cacheFile);
      stats.exists = true;
      stats.sizeBytes = fileStats.size;

      const cache = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8')) as CacheData;
      
      if (cache.timestamp) {
        stats.age = Date.now() - cache.timestamp;
        stats.isValid = stats.age < this.cacheDuration;
      }
      
      stats.entryCount = Object.keys(cache.results || {}).length;
    } catch {
      // 忽略错误，返回默认统计
    }

    return stats;
  }

  /**
   * 获取缓存文件路径
   */
  getCacheFilePath(): string {
    return this.cacheFile;
  }

  /**
   * 设置缓存持续时间
   * @param duration 持续时间（毫秒）
   */
  setCacheDuration(duration: number): void {
    if (duration > 0) {
      (this as unknown as { cacheDuration: number }).cacheDuration = duration;
    }
  }

  /**
   * 缓存Provider的测试结果（别名方法）
   * @param provider Provider配置
   * @param result 测试结果
   */
  cacheResult(provider: Provider, result: TestResult): void {
    this.setCachedResult(provider, result);
  }

  /**
   * 获取缓存持续时间
   */
  getCacheDuration(): number {
    return this.cacheDuration;
  }
}