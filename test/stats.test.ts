import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { StatsManager } from '../src/core/stats-manager.js';

const originalStatsPath = (StatsManager as unknown as { statsFile: string }).statsFile;
let tempDir: string;
let tempStatsFile: string;

afterAll(() => {
  (StatsManager as unknown as { statsFile: string }).statsFile = originalStatsPath;
});

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'switch-claude-stats-'));
  tempStatsFile = path.join(tempDir, 'usage-stats.json');
  (StatsManager as unknown as { statsFile: string }).statsFile = tempStatsFile;
  StatsManager.resetStats();
});

afterEach(() => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('StatsManager', () => {
  it('records command usage', () => {
    StatsManager.recordCommand('list');
    StatsManager.recordCommand('list');
    StatsManager.recordCommand('switch');

    const summary = StatsManager.getSummary();

    expect(summary.totalUses).toBe(3);
    expect(summary.topCommands[0]?.command).toBe('list');
    expect(summary.topCommands[0]?.count).toBe(2);
  });

  it('records provider checks and updates averages', () => {
    StatsManager.recordProviderUse('provider-1', true, 120);
    StatsManager.recordProviderUse('provider-1', false);

    const summary = StatsManager.getSummary();
    const providerStats = summary.topProviders.find((p) => p.name === 'provider-1');

    expect(providerStats).toBeDefined();
    expect(providerStats?.uses).toBe(2);
    expect(providerStats?.successRate).toBe('50.0');
  });

  it('exports stats to a file', () => {
    StatsManager.recordCommand('stats');
    const exportPath = path.join(tempDir, 'stats-output.json');

    const resultPath = StatsManager.exportStats(exportPath);

    expect(resultPath).toBe(exportPath);
    expect(fs.existsSync(exportPath)).toBe(true);

    const exported = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
    expect(exported.summary.totalUses).toBe(1);
  });
});
