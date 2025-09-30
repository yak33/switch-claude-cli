/**
 * 代理工具类
 * 用于检测和处理系统代理配置
 * 
 * @author ZHANGCHAO
 */

/**
 * 从环境变量中获取代理配置
 * @returns 代理地址或 null
 */
export function getProxyFromEnv(): string | null {
  // 检查 HTTPS_PROXY（优先）
  const httpsProxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;

  if (httpsProxy) {
    return normalizeProxyUrl(httpsProxy);
  }

  return null;
}

/**
 * 标准化代理 URL
 * @param proxy 代理地址
 * @returns 标准化后的代理地址
 */
export function normalizeProxyUrl(proxy: string): string {
  const trimmed = proxy.trim();

  // 如果没有协议前缀，默认添加 http://
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `http://${trimmed}`;
  }

  return trimmed;
}

/**
 * 验证代理地址格式
 * @param proxy 代理地址
 * @returns 是否有效
 */
export function isValidProxy(proxy: string): boolean {
  if (!proxy || proxy.trim() === '') {
    return false;
  }

  const trimmed = proxy.trim();

  // 支持两种格式：
  // 1. 完整 URL: http://127.0.0.1:7897 或 https://proxy.com:8080
  // 2. IP:端口 或 域名:端口: 127.0.0.1:7897 或 proxy.com:8080

  try {
    // 尝试作为完整 URL 解析
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    // 如果不是完整 URL，检查是否是 IP:端口 或 域名:端口 格式
    // 简单验证：包含冒号，冒号后是数字
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const [host, port] = parts;
      const portNum = parseInt(port || '', 10);
      // host 不为空，port 是有效的端口号（1-65535）
      return host!.length > 0 && !isNaN(portNum) && portNum > 0 && portNum <= 65535;
    }
    return false;
  }
}

/**
 * 获取代理信息摘要
 * @returns 代理信息描述
 */
export function getProxyInfo(): { detected: boolean; proxy: string | null; source: string } {
  const proxy = getProxyFromEnv();

  if (proxy) {
    // 判断来源
    let source = 'unknown';
    if (process.env.HTTPS_PROXY || process.env.https_proxy) {
      source = 'HTTPS_PROXY 环境变量';
    } else if (process.env.HTTP_PROXY || process.env.http_proxy) {
      source = 'HTTP_PROXY 环境变量';
    }

    return {
      detected: true,
      proxy,
      source,
    };
  }

  return {
    detected: false,
    proxy: null,
    source: 'none',
  };
}
