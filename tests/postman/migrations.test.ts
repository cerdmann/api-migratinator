import { describe, it, expect, vi } from 'vitest';
import { startSpecMigration, pollMigrationTask } from '../../src/postman/migrations.js';
import type { PostmanClient } from '../../src/postman/client.js';

function makeClient(responses: Record<string, unknown>): PostmanClient {
  return {
    get: vi.fn(async (path: string) => {
      if (path in responses) return responses[path];
      throw new Error(`Unexpected GET ${path}`);
    }),
    post: vi.fn(async (path: string) => {
      if (path in responses) return responses[path];
      throw new Error(`Unexpected POST ${path}`);
    }),
    put: vi.fn(),
    delete: vi.fn(),
    getDefaultHeaders: vi.fn(() => ({})),
    getRateLimiterType: vi.fn(() => 'general' as const),
  };
}

describe('startSpecMigration', () => {
  it('posts to spec-migrations and returns taskId', async () => {
    const client = makeClient({
      '/apis/api-1/spec-migrations': { taskId: 'task-abc', success: true },
    });

    const result = await startSpecMigration(client, 'api-1', {
      workspaceName: 'Payments Team - Payments API',
      gitPath: '/payments',
    });

    expect(result.taskId).toBe('task-abc');
    expect(client.post).toHaveBeenCalledWith('/apis/api-1/spec-migrations', {
      workspaceInfo: { name: 'Payments Team - Payments API' },
      gitInfo: { path: '/payments' },
    });
  });
});

describe('pollMigrationTask', () => {
  it('returns when task completes', async () => {
    const client = makeClient({
      '/apis/api-1/tasks/task-abc': { status: 'completed' },
    });

    const result = await pollMigrationTask(client, 'api-1', 'task-abc', { intervalMs: 0 });
    expect(result.status).toBe('completed');
  });

  it('polls until task completes', async () => {
    let calls = 0;
    const client: PostmanClient = {
      get: vi.fn(async () => {
        calls++;
        return calls < 3 ? { status: 'pending' } : { status: 'completed' };
      }),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      getDefaultHeaders: vi.fn(() => ({})),
      getRateLimiterType: vi.fn(() => 'general' as const),
    };

    const result = await pollMigrationTask(client, 'api-1', 'task-abc', { intervalMs: 0 });
    expect(result.status).toBe('completed');
    expect(calls).toBe(3);
  });

  it('throws when task fails', async () => {
    const client = makeClient({
      '/apis/api-1/tasks/task-fail': { status: 'failed', error: 'Something went wrong' },
    });

    await expect(
      pollMigrationTask(client, 'api-1', 'task-fail', { intervalMs: 0 })
    ).rejects.toThrow('Something went wrong');
  });
});
