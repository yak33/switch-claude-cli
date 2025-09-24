import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';

import { ApiTester } from '../src/core/api-tester.ts';
import type { Provider } from '../src/types/index.ts';

let server: http.Server;
let serverUrl: string;

function createMockServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const key = auth.replace('Bearer ', '');

    if (url.pathname === '/v1/messages') {
      if (key === 'sk-valid-key') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            id: 'msg_test',
            content: [{ text: 'test response' }],
          })
        );
      } else if (key === 'sk-invalid-key') {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'Invalid API key' }));
      } else if (key === 'sk-rate-limited') {
        res.statusCode = 429;
        res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      } else if (key === 'sk-model-not-supported') {
        res.statusCode = 422;
        res.end(JSON.stringify({ error: 'Model not supported' }));
      } else {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });
}

describe('ApiTester', () => {
  const tester = new ApiTester(0, 1000);

  beforeAll(async () => {
    server = createMockServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (typeof address === 'object' && address) {
          serverUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  const buildProvider = (key: string): Provider => ({
    name: 'TestProvider',
    baseUrl: serverUrl,
    key,
  });

  it('returns success details for a reachable provider', async () => {
    const result = await tester.testProvider(buildProvider('sk-valid-key'));

    expect(result.available).toBe(true);
    expect(result.status).toBe(200);
    expect(result.error).toBeNull();
    expect(result.supportedModels).toContain('Claude');
  });

  it('marks invalid credentials as reachable with authentication error', async () => {
    const result = await tester.testProvider(buildProvider('sk-invalid-key'));

    expect(result.available).toBe(true);
    expect(result.status).toBe(401);
    expect(result.error).toBe('认证失败，请检查API Key');
    expect(result.supportedModels).toHaveLength(0);
  });

  it('reports rate limiting while keeping provider available', async () => {
    const result = await tester.testProvider(buildProvider('sk-rate-limited'));

    expect(result.available).toBe(true);
    expect(result.status).toBe(429);
    expect(result.error).toBe('请求频率超限，服务可用');
  });

  it('indicates unsupported model responses', async () => {
    const result = await tester.testProvider(buildProvider('sk-model-not-supported'));

    expect(result.available).toBe(true);
    expect(result.status).toBe(422);
    expect(result.error).toBe('模型不支持');
  });

  it('treats connection failures as unavailable providers', async () => {
    const result = await tester.testProvider({
      name: 'OfflineProvider',
      baseUrl: 'http://non-existent-host:9999',
      key: 'sk-test',
    });

    expect(result.available).toBe(false);
    expect(result.status).toBeNull();
    expect(result.error).toBeDefined();
  });
});
