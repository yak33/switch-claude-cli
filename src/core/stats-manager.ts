import fs from 'fs';
import path from 'path';
import { FileUtils } from '../utils/file-utils.js';

interface ProviderStats {
  uses: number;
  successes: number;
  failures: number;
  avgResponseTime: number;
  totalResponseTime: number;
  lastUsed: string | null;
}

interface ErrorTypeStats {
  count: number;
  lastOccurred: string | null;
  messages: string[];
}

interface StatsData {
  version: number;
  firstUse: string;
  lastUse: string;
  totalUses: number;
  providers: Record<string, ProviderStats>;
  commands: Record<string, number>;
  hourlyDistribution: number[];
  dailyDistribution: number[];
  errors: {
    total: number;
    types: Record<string, ErrorTypeStats>;
  };
  performance: {
    avgResponseTime: number;
    totalResponseTime: number;
    checks: number;
  };
}

export interface StatsSummary {
  totalUses: number;
  daysUsed: number;
  avgUsesPerDay: number | string;
  topProviders: Array<{
    name: string;
    uses: number;
    successRate: string | number;
    avgResponseTime: number;
  }>;
  topCommands: Array<{
    command: string;
    count: number;
  }>;
  peakHour: string;
  peakDay: string;
  errors: number;
  avgResponseTime: number;
  lastUse: string;
}

export class StatsManager {
  private static readonly statsFile = path.join(FileUtils.configDir, 'usage-stats.json');

  private static initStats(): StatsData {
    const timestamp = new Date().toISOString();
    return {
      version: 1,
      firstUse: timestamp,
      lastUse: timestamp,
      totalUses: 0,
      providers: {},
      commands: {},
      hourlyDistribution: Array(24).fill(0),
      dailyDistribution: Array(7).fill(0),
      errors: {
        total: 0,
        types: {},
      },
      performance: {
        avgResponseTime: 0,
        totalResponseTime: 0,
        checks: 0,
      },
    };
  }

  private static loadStats(): StatsData {
    try {
      if (!fs.existsSync(this.statsFile)) {
        const fresh = this.initStats();
        this.saveStats(fresh);
        return fresh;
      }

      const raw = fs.readFileSync(this.statsFile, 'utf-8');
      const parsed = JSON.parse(raw) as StatsData;

      if (!parsed.version || parsed.version < 1) {
        return this.initStats();
      }

      if (!Array.isArray(parsed.hourlyDistribution) || parsed.hourlyDistribution.length !== 24) {
        parsed.hourlyDistribution = Array(24).fill(0);
      }
      if (!Array.isArray(parsed.dailyDistribution) || parsed.dailyDistribution.length !== 7) {
        parsed.dailyDistribution = Array(7).fill(0);
      }

      return parsed;
    } catch {
      console.warn('⚠️ 加载统计数据失败，已重置统计文件');
      const fallback = this.initStats();
      this.saveStats(fallback);
      return fallback;
    }
  }

  private static saveStats(stats: StatsData): boolean {
    try {
      const statsDir = path.dirname(this.statsFile);
      if (!fs.existsSync(statsDir)) {
        fs.mkdirSync(statsDir, { recursive: true });
      }

      fs.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  static recordCommand(command: string): void {
    const stats = this.loadStats();
    stats.totalUses += 1;
    stats.lastUse = new Date().toISOString();

    if (!stats.commands[command]) {
      stats.commands[command] = 0;
    }
    stats.commands[command] += 1;

    const now = new Date();
    stats.hourlyDistribution[now.getHours()] += 1;
    stats.dailyDistribution[now.getDay()] += 1;

    this.saveStats(stats);
  }

  static recordProviderUse(identifier: string, success: boolean = true, responseTime?: number | null): void {
    const stats = this.loadStats();

    if (!stats.providers[identifier]) {
      stats.providers[identifier] = {
        uses: 0,
        successes: 0,
        failures: 0,
        avgResponseTime: 0,
        totalResponseTime: 0,
        lastUsed: null,
      };
    }

    const provider = stats.providers[identifier];
    provider.uses += 1;
    provider.lastUsed = new Date().toISOString();
    if (success) {
      provider.successes += 1;
    } else {
      provider.failures += 1;
    }

    if (responseTime !== undefined && responseTime !== null && responseTime > 0) {
      provider.totalResponseTime += responseTime;
      provider.avgResponseTime = provider.totalResponseTime / provider.uses;

      stats.performance.totalResponseTime += responseTime;
      stats.performance.checks += 1;
      stats.performance.avgResponseTime =
        stats.performance.totalResponseTime / stats.performance.checks;
    }

    this.saveStats(stats);
  }

  static recordError(type: string, message: string): void {
    const stats = this.loadStats();
    stats.errors.total += 1;

    if (!stats.errors.types[type]) {
      stats.errors.types[type] = {
        count: 0,
        lastOccurred: null,
        messages: [],
      };
    }

    const errorStats = stats.errors.types[type];
    errorStats.count += 1;
    errorStats.lastOccurred = new Date().toISOString();

    if (!errorStats.messages.includes(message)) {
      errorStats.messages.unshift(message);
      if (errorStats.messages.length > 10) {
        errorStats.messages.pop();
      }
    }

    this.saveStats(stats);
  }

  static getSummary(): StatsSummary {
    const stats = this.loadStats();
    const now = new Date();

    const topProviders = Object.entries(stats.providers)
      .sort((a, b) => b[1].uses - a[1].uses)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        uses: data.uses,
        successRate: data.uses > 0 ? ((data.successes / data.uses) * 100).toFixed(1) : '0.0',
        avgResponseTime: data.avgResponseTime ? Math.round(data.avgResponseTime) : 0,
      }));

    const topCommands = Object.entries(stats.commands)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([command, count]) => ({ command, count }));

    const peakHourIndex = stats.hourlyDistribution.indexOf(Math.max(...stats.hourlyDistribution));
    const peakDayIndex = stats.dailyDistribution.indexOf(Math.max(...stats.dailyDistribution));
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    const firstUseDate = new Date(stats.firstUse);
    const daysUsed = Math.max(1, Math.ceil((now.getTime() - firstUseDate.getTime()) / 86_400_000));

    return {
      totalUses: stats.totalUses,
      daysUsed,
      avgUsesPerDay: daysUsed > 0 ? (stats.totalUses / daysUsed).toFixed(1) : '0.0',
      topProviders,
      topCommands,
      peakHour: peakHourIndex >= 0 ? `${peakHourIndex}:00-${peakHourIndex + 1}:00` : '未知',
      peakDay: peakDayIndex >= 0 ? dayNames[peakDayIndex] : '未知',
      errors: stats.errors.total,
      avgResponseTime: stats.performance.avgResponseTime
        ? Math.round(stats.performance.avgResponseTime)
        : 0,
      lastUse: stats.lastUse,
    };
  }

  static displayStats(verbose: boolean = false): void {
    const summary = this.getSummary();

    console.log('\n📊 Switch Claude CLI 使用统计');
    console.log('═'.repeat(50));
    console.log('\n📈 基本统计：');
    console.log(`  • 总使用次数: ${summary.totalUses} 次`);
    console.log(`  • 使用天数: ${summary.daysUsed} 天`);
    console.log(`  • 日均使用: ${summary.avgUsesPerDay} 次`);
    console.log(`  • 最后使用: ${summary.lastUse ? new Date(summary.lastUse).toLocaleString('zh-CN') : '未知'}`);

    if (summary.topProviders.length > 0) {
      console.log('\n🏆 最常用的 Providers：');
      summary.topProviders.forEach((p, index) => {
        console.log(`  ${index + 1}. ${p.name}`);
        console.log(`     使用 ${p.uses} 次 | 成功率 ${p.successRate}% | 平均响应 ${p.avgResponseTime}ms`);
      });
    }

    if (summary.topCommands.length > 0) {
      console.log('\n⚡ 最常用的命令：');
      summary.topCommands.forEach((cmd, index) => {
        console.log(`  ${index + 1}. ${cmd.command} (${cmd.count} 次)`);
      });
    }

    console.log('\n🕐 使用模式：');
    console.log(`  • 最活跃时段: ${summary.peakHour}`);
    console.log(`  • 最活跃日期: ${summary.peakDay}`);

    console.log('\n⚡ 性能统计：');
    console.log(`  • 平均响应时间: ${summary.avgResponseTime}ms`);
    console.log(`  • 错误总数: ${summary.errors} 个`);

    if (verbose) {
      const stats = this.loadStats();
      const maxHour = Math.max(...stats.hourlyDistribution);
      console.log('\n📊 24小时使用分布：');
      stats.hourlyDistribution.forEach((count, hour) => {
        const barLength = maxHour > 0 ? Math.round((count / maxHour) * 20) : 0;
        const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
        console.log(`  ${hour.toString().padStart(2, '0')}:00 ${bar} ${count}`);
      });

      if (Object.keys(stats.errors.types).length > 0) {
        console.log('\n❌ 错误类型：');
        Object.entries(stats.errors.types).forEach(([type, data]) => {
          console.log(`  • ${type}: ${data.count} 次`);
          if (data.lastOccurred) {
            console.log(`    最后发生: ${new Date(data.lastOccurred).toLocaleString('zh-CN')}`);
          }
        });
      }
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log('💡 提示: 使用 --stats -v 查看详细统计');
  }

  static cleanupOldStats(days: number = 90): void {
    const stats = this.loadStats();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    Object.entries(stats.providers).forEach(([name, data]) => {
      if (data.lastUsed && new Date(data.lastUsed) < cutoff) {
        delete stats.providers[name];
      }
    });

    Object.entries(stats.errors.types).forEach(([type, data]) => {
      if (data.lastOccurred && new Date(data.lastOccurred) < cutoff) {
        delete stats.errors.types[type];
      }
    });

    this.saveStats(stats);
  }

  static exportStats(outputPath: string): string | null {
    const absolutePath = path.resolve(outputPath);
    const exportData = {
      exportTime: new Date().toISOString(),
      summary: this.getSummary(),
      rawData: this.loadStats(),
    };

    try {
      fs.writeFileSync(absolutePath, JSON.stringify(exportData, null, 2));
      console.log(`✅ 统计数据已导出到: ${absolutePath}`);
      return absolutePath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ 导出失败: ${message}`);
      return null;
    }
  }

  static resetStats(): void {
    const fresh = this.initStats();
    this.saveStats(fresh);
    console.log('✅ 统计数据已重置');
  }

  static generateExportFilename(prefix = 'stats'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${prefix}-${timestamp}.json`;
  }
}
