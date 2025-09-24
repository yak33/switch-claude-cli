import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * 文件操作工具类
 * 提供配置目录管理和文件操作功能
 */
export class FileUtils {
  static readonly configDir = path.join(os.homedir(), '.switch-claude');
  static readonly configPath = path.join(FileUtils.configDir, 'providers.json');
  static readonly cacheFile = path.join(FileUtils.configDir, 'cache.json');
  static readonly backupDir = path.join(FileUtils.configDir, 'backups');

  /**
   * 确保配置目录存在
   * @returns 是否是新创建的目录
   */
  static ensureConfigDir(): boolean {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
      return true;
    }
    return false;
  }

  /**
   * 确保备份目录存在
   */
  static ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * 检查文件是否存在
   */
  static fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * 读取JSON文件
   */
  static readJsonFile<T>(filePath: string): T {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  }

  /**
   * 写入JSON文件
   */
  static writeJsonFile<T>(filePath: string, data: T): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * 获取备份文件列表
   */
  static getBackupFiles(): Array<{ name: string; path: string; time: Date }> {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }

    return fs
      .readdirSync(this.backupDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          time: stats.mtime,
        };
      })
      .sort((a, b) => b.time.getTime() - a.time.getTime());
  }

  /**
   * 清理旧备份文件（保留最近10个）
   */
  static cleanOldBackups(): void {
    const backups = this.getBackupFiles();
    if (backups.length > 10) {
      const filesToDelete = backups.slice(10);
      filesToDelete.forEach((backup) => {
        try {
          fs.unlinkSync(backup.path);
        } catch (error) {
          console.warn(`清理备份文件失败: ${backup.name}`, error);
        }
      });
    }
  }

  /**
   * 生成带时间戳的文件名
   */
  static generateTimestampedFilename(prefix: string, extension: string = 'json'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
    return `${prefix}-${timestamp}.${extension}`;
  }

  /**
   * 复制文件
   */
  static copyFile(source: string, destination: string): void {
    fs.copyFileSync(source, destination);
  }

  /**
   * 删除文件
   */
  static deleteFile(filePath: string): void {
    fs.unlinkSync(filePath);
  }

  /**
   * 获取文件大小（字节）
   */
  static getFileSize(filePath: string): number {
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  /**
   * 获取文件修改时间
   */
  static getFileModTime(filePath: string): Date {
    const stats = fs.statSync(filePath);
    return stats.mtime;
  }

  /**
   * 获取package.json信息
   * 使用与原版相同的方式，避免动态导入的路径问题
   */
  static getPackageInfo(): { version: string; name: string } | null {
    try {
      // 获取当前模块的目录路径
      const currentDir = path.dirname(new URL(import.meta.url).pathname);

      // 在Windows上，需要处理路径格式
      const normalizedDir =
        process.platform === 'win32' && currentDir.startsWith('/')
          ? currentDir.slice(1)
          : currentDir;

      // 从当前文件位置向上查找package.json
      let packagePath = path.resolve(normalizedDir, '../..', 'package.json');

      // 如果第一个路径不存在，尝试其他可能的路径
      if (!fs.existsSync(packagePath)) {
        // 可能在构建后的dist目录中运行
        packagePath = path.resolve(normalizedDir, '../../..', 'package.json');
      }

      if (fs.existsSync(packagePath)) {
        const content = fs.readFileSync(packagePath, 'utf-8');
        return JSON.parse(content);
      }

      return null;
    } catch {
      return null;
    }
  }
}
