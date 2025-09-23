import type { ProgressOptions } from '../types';

/**
 * 进度显示组件
 * 提供旋转动画和进度信息显示
 */
export class ProgressIndicator {
  private readonly total: number;
  private completed: number = 0;
  private readonly message: string;
  private readonly spinners: string[] = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
  private spinnerIndex: number = 0;
  private readonly completedItems: string[] = [];
  private interval: NodeJS.Timeout | null = null;
  private lastLine: string = '';

  constructor(options: ProgressOptions) {
    this.total = options.total;
    this.message = options.message ?? '正在处理';
  }

  /**
   * 开始显示进度
   */
  start(): void {
    if (process.stdout.isTTY) {
      this.interval = setInterval(() => {
        this.render();
      }, 100);
    }
    this.render();
  }

  /**
   * 更新进度
   * @param completedItem 完成的项目名称
   */
  update(completedItem?: string): void {
    if (completedItem) {
      this.completedItems.push(completedItem);
    }
    this.completed++;
    this.render();
  }

  /**
   * 渲染进度显示
   */
  private render(): void {
    const spinner = this.spinners[this.spinnerIndex % this.spinners.length];
    this.spinnerIndex++;

    let line = `🔍 检测API ${spinner} [${this.completed}/${this.total}]`;

    // 显示当前正在处理的API完整名称
    if (this.completedItems.length > 0) {
      // 显示最新完成的一个项目的完整名称
      const latestItem = this.completedItems[this.completedItems.length - 1];
      line += ` 当前: ${latestItem}`;
    }

    // 控制整行长度，如果太长则优先保留API名称，缩短其他部分
    const maxLineLength = process.stdout.columns ? Math.min(process.stdout.columns - 2, 100) : 100;
    if (line.length > maxLineLength) {
      // 如果行太长，尝试缩短消息部分但保留API名称
      const baseMessage = `🔍 检测中 ${spinner} [${this.completed}/${this.total}]`;
      if (this.completedItems.length > 0) {
        const latestItem = this.completedItems[this.completedItems.length - 1];
        const remainingSpace = maxLineLength - baseMessage.length - 5; // 5 for " 当前: "
        if (remainingSpace > 10) {
          line = `${baseMessage} 当前: ${latestItem}`;
        } else {
          // 如果空间不够，只显示基本信息
          line = baseMessage;
        }
      }
    }

    if (process.stdout.isTTY) {
      // TTY环境：清除上一行并打印新行
      if (this.lastLine) {
        process.stdout.write(`\r${' '.repeat(this.lastLine.length)}\r`);
      }
      process.stdout.write(line);
      this.lastLine = line;
    } else {
      // 非TTY环境：每2个完成项显示一次状态
      if (this.completed % 2 === 0 || this.completed === this.total) {
        console.log(line);
      }
    }
  }

  /**
   * 完成进度显示
   * @param finalMessage 最终消息
   */
  finish(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (process.stdout.isTTY) {
      // TTY环境：清除进度行
      process.stdout.write(`\r${' '.repeat(this.lastLine.length)}\r`);
      if (finalMessage) {
        console.log(finalMessage);
      }
    } else {
      // 非TTY环境：显示完成信息
      if (finalMessage) {
        console.log(finalMessage);
      }
    }
  }

  /**
   * 获取当前进度
   */
  getProgress(): { completed: number; total: number; percentage: number } {
    return {
      completed: this.completed,
      total: this.total,
      percentage: Math.round((this.completed / this.total) * 100),
    };
  }

  /**
   * 是否已完成
   */
  isCompleted(): boolean {
    return this.completed >= this.total;
  }
}
