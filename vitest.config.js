import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '*.config.js',
        'coverage/',
        'index.js' // 主文件暂时排除，因为它包含太多交互逻辑
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});