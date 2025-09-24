import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { ValidationUtils } from '../src/utils/validation.js';
import { CliParser } from '../src/cli/cli-parser.js';
import { FileUtils } from '../src/utils/file-utils.js';
import { CacheManager } from '../src/core/cache-manager.js';
import type { TestResult } from '../src/types/index.js';

describe('ValidationUtils', () => {
  it('accepts a valid provider', () => {
    const provider = {
      name: 'TestProvider',
      baseUrl: 'https://api.test.com',
      key: 'sk-test1234567890',
    };

    const errors = ValidationUtils.validateProvider(provider, 0);
    expect(errors).toHaveLength(0);
  });

  it('flags invalid provider details', () => {
    const errors = ValidationUtils.validateProvider({
      name: '',
      baseUrl: 'not-a-url',
      key: 'short',
    }, 1);

    expect(errors.some((msg) => msg.includes('name'))).toBe(true);
    expect(errors.some((msg) => msg.includes('baseUrl'))).toBe(true);
    expect(errors.some((msg) => msg.includes('key'))).toBe(true);
  });

  it('validates provider collections', () => {
    const valid = [
      { name: 'One', baseUrl: 'https://a.example.com', key: 'sk-1234567890' },
      { name: 'Two', baseUrl: 'https://b.example.com', key: 'sk-0987654321' },
    ];
    expect(ValidationUtils.validateProviders(valid)).toHaveLength(0);

    const invalid: unknown[] = [];
    const invalidResult = ValidationUtils.validateProviders(invalid);
    expect(invalidResult.some((msg) => msg.includes('配置文件为空'))).toBe(true);
  });

  it('parses provider indices with bounds checking', () => {
    const ok = ValidationUtils.validateProviderIndex('2', 3);
    expect(ok.valid).toBe(true);
    expect(ok.value).toBe(1);

    const bad = ValidationUtils.validateProviderIndex('10', 2);
    expect(bad.valid).toBe(false);
  });

  it('masks sensitive API keys', () => {
    const masked = ValidationUtils.maskSensitiveData('sk-test-very-secret-key', 5);
    expect(masked.startsWith('sk-te')).toBe(true);
    expect(masked.endsWith('***')).toBe(true);
  });
});

describe('CliParser', () => {
  it('extracts flags, paths and provider indices', () => {
    const { options, providerIndex, showHelp, showVersion } = CliParser.parseArgs([
      '--help',
      '--version',
      '--export',
      'output.json',
      '3',
    ]);

    expect(showHelp).toBe(true);
    expect(showVersion).toBe(true);
    expect(options.export).toBe(true);
    expect(options.exportPath).toBe('output.json');
    expect(providerIndex).toBe('3');
  });

  it('validates mutually exclusive options', () => {
    const validation = CliParser.validateOptions({ list: true, add: true });
    expect(validation.valid).toBe(false);
  });
});

describe('FileUtils', () => {
  it('generates timestamped filenames without illegal characters', () => {
    const filename = FileUtils.generateTimestampedFilename('backup');
    expect(filename.startsWith('backup-')).toBe(true);
    expect(filename.endsWith('.json')).toBe(true);
    expect(filename.includes(':')).toBe(false);
  });
});

describe('CacheManager', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'switch-claude-test-'));
  const cachePath = path.join(tempDir, 'cache.json');
  const cacheKey = 'https://api.example.com:retained';
  const cacheResult: TestResult = {
    available: true,
    status: 200,
    endpoint: '/v1/messages',
    responseTime: 120,
    supportedModels: ['Claude'],
    error: null,
  };

  let manager: CacheManager;

  beforeEach(() => {
    manager = new CacheManager();
    (manager as unknown as { cacheFile: string }).cacheFile = cachePath;
    (manager as unknown as { cacheDuration: number }).cacheDuration = 5 * 60 * 1000;
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns an empty cache when no file exists', () => {
    expect(manager.loadCache()).toEqual({});
  });

  it('persists and retrieves cache entries', () => {
    manager.saveCache({ [cacheKey]: cacheResult });
    const loaded = manager.loadCache();
    expect(loaded[cacheKey]).toMatchObject(cacheResult);
  });

  it('ignores expired cache entries', () => {
    const staleData = {
      timestamp: Date.now() - 10 * 60 * 1000,
      results: { [cacheKey]: cacheResult },
    };
    fs.writeFileSync(cachePath, JSON.stringify(staleData));

    expect(manager.loadCache()).toEqual({});
  });
});
