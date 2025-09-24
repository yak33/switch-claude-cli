/**
 * 核心类型定义
 */

export interface Provider {
  /** Provider 名称 */
  name: string;
  /** API Base URL */
  baseUrl: string;
  /** API Key */
  key: string;
  /** 是否为默认 Provider */
  default?: boolean;
}

export interface TestResult {
  /** 是否可用 */
  available: boolean;
  /** HTTP 状态码 */
  status: number | null;
  /** 测试的端点 */
  endpoint: string;
  /** 响应时间（毫秒） */
  responseTime: number | null;
  /** 支持的模型类型 */
  supportedModels: string[];
  /** 错误信息 */
  error: string | null;
}

export interface CacheData {
  /** 缓存时间戳 */
  timestamp: number;
  /** 缓存结果 */
  results: Record<string, TestResult>;
}

export interface CliOptions {
  help?: boolean;
  version?: boolean;
  refresh?: boolean;
  verbose?: boolean;
  list?: boolean;
  envOnly?: boolean;
  add?: boolean;
  remove?: boolean;
  setDefault?: boolean;
  clearDefault?: boolean;
  checkUpdate?: boolean;
  export?: boolean;
  import?: boolean;
  backup?: boolean;
  listBackups?: boolean;
  merge?: boolean;
  stats?: boolean;
  exportStats?: boolean;
  resetStats?: boolean;
  providerIndex?: string;
  exportPath?: string;
  importPath?: string;
}

export interface CommandResult {
  /** 是否成功 */
  success: boolean;
  /** 消息 */
  message?: string;
  /** 错误信息 */
  error?: string;
  /** 退出码 */
  exitCode?: number;
}

export interface ProgressOptions {
  /** 总数 */
  total: number;
  /** 消息 */
  message?: string;
}

export interface BackupMetadata {
  /** 版本号 */
  version: string;
  /** 备份时间 */
  backupTime: string;
  /** Provider 数量 */
  providerCount: number;
}

export interface ExportData {
  /** 版本号 */
  version: string;
  /** 导出时间 */
  exportTime: string;
  /** Provider 配置 */
  providers: Provider[];
}

export interface ImportOptions {
  /** 是否合并模式 */
  merge?: boolean;
  /** 是否备份原配置 */
  backup?: boolean;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}
