import fs from 'fs';
import path from 'path';
import os from 'os';

const configDir = path.join(os.homedir(), '.switch-claude');
const statsFile = path.join(configDir, 'usage-stats.json');

/**
 * 初始化统计数据结构
 */
function initStats() {
  return {
    version: 1,
    firstUse: new Date().toISOString(),
    lastUse: new Date().toISOString(),
    totalUses: 0,
    providers: {},
    commands: {},
    hourlyDistribution: Array(24).fill(0),
    dailyDistribution: Array(7).fill(0), // 0=周日, 1=周一...
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

/**
 * 加载统计数据
 */
export function loadStats() {
  try {
    if (!fs.existsSync(statsFile)) {
      const newStats = initStats();
      saveStats(newStats);
      return newStats;
    }

    const data = fs.readFileSync(statsFile, 'utf-8');
    const stats = JSON.parse(data);

    // 迁移旧版本数据结构
    if (!stats.version || stats.version < 1) {
      return initStats();
    }

    return stats;
  } catch {
    console.warn('⚠️ 加载统计数据失败，使用新的统计数据');
    return initStats();
  }
}

/**
 * 保存统计数据
 */
export function saveStats(stats) {
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    return true;
  } catch {
    // 静默失败，不影响主程序
    return false;
  }
}

/**
 * 记录命令使用
 */
export function recordCommand(command) {
  const stats = loadStats();

  stats.totalUses++;
  stats.lastUse = new Date().toISOString();

  // 记录命令使用次数
  if (!stats.commands[command]) {
    stats.commands[command] = 0;
  }
  stats.commands[command]++;

  // 记录时间分布
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  stats.hourlyDistribution[hour]++;
  stats.dailyDistribution[day]++;

  saveStats(stats);
}

/**
 * 记录 Provider 使用
 */
export function recordProviderUse(providerName, success = true, responseTime = null) {
  const stats = loadStats();

  if (!stats.providers[providerName]) {
    stats.providers[providerName] = {
      uses: 0,
      successes: 0,
      failures: 0,
      avgResponseTime: 0,
      totalResponseTime: 0,
      lastUsed: null,
    };
  }

  const provider = stats.providers[providerName];
  provider.uses++;
  provider.lastUsed = new Date().toISOString();

  if (success) {
    provider.successes++;
  } else {
    provider.failures++;
  }

  // 更新响应时间
  if (responseTime !== null && responseTime > 0) {
    provider.totalResponseTime += responseTime;
    provider.avgResponseTime = provider.totalResponseTime / provider.uses;

    // 更新总体性能统计
    stats.performance.totalResponseTime += responseTime;
    stats.performance.checks++;
    stats.performance.avgResponseTime =
      stats.performance.totalResponseTime / stats.performance.checks;
  }

  saveStats(stats);
}

/**
 * 记录错误
 */
export function recordError(errorType, errorMessage) {
  const stats = loadStats();

  stats.errors.total++;

  if (!stats.errors.types[errorType]) {
    stats.errors.types[errorType] = {
      count: 0,
      lastOccurred: null,
      messages: [],
    };
  }

  const error = stats.errors.types[errorType];
  error.count++;
  error.lastOccurred = new Date().toISOString();

  // 只保留最近10条错误消息
  if (!error.messages.includes(errorMessage)) {
    error.messages.unshift(errorMessage);
    if (error.messages.length > 10) {
      error.messages.pop();
    }
  }

  saveStats(stats);
}

/**
 * 获取统计摘要
 */
export function getStatsSummary() {
  const stats = loadStats();
  const now = new Date();

  // 计算最常用的 provider
  const topProviders = Object.entries(stats.providers)
    .sort((a, b) => b[1].uses - a[1].uses)
    .slice(0, 5)
    .map(([name, data]) => ({
      name,
      uses: data.uses,
      successRate: data.uses > 0 ? ((data.successes / data.uses) * 100).toFixed(1) : 0,
      avgResponseTime: data.avgResponseTime ? Math.round(data.avgResponseTime) : 0,
    }));

  // 计算最常用的命令
  const topCommands = Object.entries(stats.commands)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([command, count]) => ({ command, count }));

  // 计算最活跃的时间段
  const peakHour = stats.hourlyDistribution.indexOf(Math.max(...stats.hourlyDistribution));
  const peakDay = stats.dailyDistribution.indexOf(Math.max(...stats.dailyDistribution));
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  // 计算使用天数
  const firstUseDate = new Date(stats.firstUse);
  const daysUsed = Math.ceil((now - firstUseDate) / (24 * 60 * 60 * 1000));

  return {
    totalUses: stats.totalUses,
    daysUsed,
    avgUsesPerDay: daysUsed > 0 ? (stats.totalUses / daysUsed).toFixed(1) : 0,
    topProviders,
    topCommands,
    peakHour: `${peakHour}:00-${peakHour + 1}:00`,
    peakDay: dayNames[peakDay],
    errors: stats.errors.total,
    avgResponseTime: stats.performance.avgResponseTime
      ? Math.round(stats.performance.avgResponseTime)
      : 0,
    lastUse: stats.lastUse,
  };
}

/**
 * 显示详细统计报告
 */
export function displayStats(verbose = false) {
  const summary = getStatsSummary();

  console.log('\n📊 使用统计报告\n');
  console.log('═'.repeat(50));

  // 基本统计
  console.log('\n📈 基本统计：');
  console.log(`  • 总使用次数: ${summary.totalUses} 次`);
  console.log(`  • 使用天数: ${summary.daysUsed} 天`);
  console.log(`  • 日均使用: ${summary.avgUsesPerDay} 次`);
  console.log(`  • 最后使用: ${new Date(summary.lastUse).toLocaleString('zh-CN')}`);

  // Provider 统计
  if (summary.topProviders.length > 0) {
    console.log('\n🏆 最常用的 Providers：');
    summary.topProviders.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name}`);
      console.log(
        `     使用 ${p.uses} 次 | 成功率 ${p.successRate}% | 平均响应 ${p.avgResponseTime}ms`
      );
    });
  }

  // 命令统计
  if (summary.topCommands.length > 0) {
    console.log('\n⚡ 最常用的命令：');
    summary.topCommands.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.command} (${c.count} 次)`);
    });
  }

  // 使用模式
  console.log('\n🕐 使用模式：');
  console.log(`  • 最活跃时段: ${summary.peakHour}`);
  console.log(`  • 最活跃日期: ${summary.peakDay}`);

  // 性能统计
  console.log('\n⚡ 性能统计：');
  console.log(`  • 平均响应时间: ${summary.avgResponseTime}ms`);
  console.log(`  • 错误总数: ${summary.errors} 个`);

  if (verbose) {
    const stats = loadStats();

    // 时间分布图
    console.log('\n📊 24小时使用分布：');
    const maxHourCount = Math.max(...stats.hourlyDistribution);
    stats.hourlyDistribution.forEach((count, hour) => {
      const barLength = maxHourCount > 0 ? Math.round((count / maxHourCount) * 20) : 0;
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
      console.log(`  ${hour.toString().padStart(2, '0')}:00 ${bar} ${count}`);
    });

    // 错误类型
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

/**
 * 清理旧的统计数据（保留最近90天）
 */
export function cleanupOldStats() {
  const stats = loadStats();
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // 清理旧的 provider 数据
  Object.keys(stats.providers).forEach((name) => {
    const provider = stats.providers[name];
    if (provider.lastUsed) {
      const lastUsedDate = new Date(provider.lastUsed);
      if (lastUsedDate < cutoffDate) {
        delete stats.providers[name];
      }
    }
  });

  // 清理旧的错误数据
  Object.keys(stats.errors.types).forEach((type) => {
    const error = stats.errors.types[type];
    if (error.lastOccurred) {
      const lastOccurredDate = new Date(error.lastOccurred);
      if (lastOccurredDate < cutoffDate) {
        delete stats.errors.types[type];
      }
    }
  });

  saveStats(stats);
}

/**
 * 导出统计数据
 */
export function exportStats(outputPath) {
  const stats = loadStats();
  const summary = getStatsSummary();

  const exportData = {
    exportTime: new Date().toISOString(),
    summary,
    rawData: stats,
  };

  try {
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`✅ 统计数据已导出到: ${path.resolve(outputPath)}`);
    return true;
  } catch (error) {
    console.error(`❌ 导出失败: ${error.message}`);
    return false;
  }
}

/**
 * 重置统计数据
 */
export function resetStats() {
  const newStats = initStats();
  saveStats(newStats);
  console.log('✅ 统计数据已重置');
  return true;
}
