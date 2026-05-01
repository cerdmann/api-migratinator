import { describe, it, expect, vi } from 'vitest';
import {
  startSpecMigration,
  pollMigrationTask,
  validateGitPath,
} from '../../src/postman/migrations.js';
import type { PostmanClient } from '../../src/postman/client.js';

function makeClient(postResponses: Record<string, unknown>, getResponses: Record<string, unknown> = {}): PostmanClient {
  return {
    get: vi.fn(async (path: string) => {
      if (path in getResponses) return getResponses[path];
      throw new Error(`Unexpected GET ${path}`);
    }),
    post: vi.fn(async (path: string) => {
      if (path in postResponses) return postResponses[path];
      throw new Error(`Unexpected POST ${path}`);
    }),
    put: vi.fn(),
    delete: vi.fn(),
    getDefaultHeaders: vi.fn(() => ({})),
    getRateLimiterType: vi.fn(() => 'general' as const),
  };
}

describe('startSpecMigration', () => {
  it('posts to spec-migrations with workspaceInfo and gitInfo', async () => {
    const client = makeClient({
      '/apis/api-1/spec-migrations': { message: 'Moving to Spec Hub started successfully', success: true },
    });

    const result = await startSpecMigration(client, 'api-1', {
      workspaceInfo: { name: 'My Workspace' },
      gitInfo: { path: '/payments' },
    });

    expect(result.started).toBe(true);
    expect(result.empty).toBe(false);
    expect(client.post).toHaveBeenCalledWith(
      '/apis/api-1/spec-migrations',
      { workspaceInfo: { name: 'My Workspace' }, gitInfo: { path: '/payments' } },
      { Accept: 'application/vnd.api.v10+json' }
    );
  });

  it('posts with workspaceId to migrate to existing workspace', async () => {
    const client = makeClient({
      '/apis/api-1/spec-migrations': { message: 'Moving to Spec Hub started successfully', success: true },
    });

    await startSpecMigration(client, 'api-1', {
      workspaceId: 'existing-ws-uuid',
    });

    expect(client.post).toHaveBeenCalledWith(
      '/apis/api-1/spec-migrations',
      { workspaceId: 'existing-ws-uuid' },
      { Accept: 'application/vnd.api.v10+json' }
    );
  });

  it('detects empty API migration', async () => {
    const client = makeClient({
      '/apis/api-1/spec-migrations': {
        message: "This API doesn't have any API Definition or Collection",
        success: true,
      },
    });

    const result = await startSpecMigration(client, 'api-1', {
      workspaceInfo: { name: 'My Workspace' },
    });

    expect(result.empty).toBe(true);
    expect(result.started).toBe(false);
  });

  it('throws on unsupported definition type', async () => {
    const client: PostmanClient = {
      get: vi.fn(),
      post: vi.fn().mockRejectedValue(Object.assign(new Error('Definition type not supported'), {
        response: { status: 400, data: { error: { title: 'Definition type not supported', message: 'This API contains an unsupported definition type wsdl:1.0.' } } },
      })),
      put: vi.fn(),
      delete: vi.fn(),
      getDefaultHeaders: vi.fn(() => ({})),
      getRateLimiterType: vi.fn(() => 'general' as const),
    };

    await expect(startSpecMigration(client, 'api-1', { workspaceInfo: { name: 'ws' } }))
      .rejects.toThrow('unsupported definition type');
  });

  it('throws on repo already linked to another workspace', async () => {
    const client: PostmanClient = {
      get: vi.fn(),
      post: vi.fn().mockRejectedValue(Object.assign(new Error('repo linked'), {
        response: { status: 400, data: { error: { message: 'The git repository is already linked to another workspace.' } } },
      })),
      put: vi.fn(),
      delete: vi.fn(),
      getDefaultHeaders: vi.fn(() => ({})),
      getRateLimiterType: vi.fn(() => 'general' as const),
    };

    await expect(startSpecMigration(client, 'api-1', { workspaceInfo: { name: 'ws' } }))
      .rejects.toThrow('already linked to another workspace');
  });
});

describe('pollMigrationTask', () => {
  it('polls GET /apis/:apiId/spec-migrations until completed', async () => {
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

    const result = await pollMigrationTask(client, 'api-1', { intervalMs: 0 });
    expect(result.status).toBe('completed');
    expect(client.get).toHaveBeenCalledWith(
      '/apis/api-1/spec-migrations',
      undefined,
      { Accept: 'application/vnd.api.v10+json' }
    );
  });

  it('treats "success" status as completed', async () => {
    const client: PostmanClient = {
      get: vi.fn(async () => ({ status: 'success' })),
      post: vi.fn(), put: vi.fn(), delete: vi.fn(),
      getDefaultHeaders: vi.fn(() => ({})),
      getRateLimiterType: vi.fn(() => 'general' as const),
    };
    const result = await pollMigrationTask(client, 'api-1', { intervalMs: 0 });
    expect(result.status).toBe('completed');
  });

  it('treats "running" and "in_progress" as pending', async () => {
    let calls = 0;
    const statuses = ['running', 'in_progress', 'completed'];
    const client: PostmanClient = {
      get: vi.fn(async () => ({ status: statuses[calls++] })),
      post: vi.fn(), put: vi.fn(), delete: vi.fn(),
      getDefaultHeaders: vi.fn(() => ({})),
      getRateLimiterType: vi.fn(() => 'general' as const),
    };
    const result = await pollMigrationTask(client, 'api-1', { intervalMs: 0 });
    expect(result.status).toBe('completed');
    expect(calls).toBe(3);
  });

  it('throws on "failed" status', async () => {
    const client: PostmanClient = {
      get: vi.fn(async () => ({ status: 'failed', error: 'Repo not found' })),
      post: vi.fn(), put: vi.fn(), delete: vi.fn(),
      getDefaultHeaders: vi.fn(() => ({})),
      getRateLimiterType: vi.fn(() => 'general' as const),
    };
    await expect(pollMigrationTask(client, 'api-1', { intervalMs: 0 }))
      .rejects.toThrow('Repo not found');
  });

  it('throws on "error" status', async () => {
    const client: PostmanClient = {
      get: vi.fn(async () => ({ status: 'error', error: 'Internal error' })),
      post: vi.fn(), put: vi.fn(), delete: vi.fn(),
      getDefaultHeaders: vi.fn(() => ({})),
      getRateLimiterType: vi.fn(() => 'general' as const),
    };
    await expect(pollMigrationTask(client, 'api-1', { intervalMs: 0 }))
      .rejects.toThrow('Internal error');
  });
});

describe('validateGitPath', () => {
  it('accepts valid absolute paths', () => {
    expect(() => validateGitPath('/')).not.toThrow();
    expect(() => validateGitPath('/payments')).not.toThrow();
    expect(() => validateGitPath('/my-org/payments_api')).not.toThrow();
    expect(() => validateGitPath('/v1.0/specs')).not.toThrow();
  });

  it('rejects paths that do not start with /', () => {
    expect(() => validateGitPath('payments')).toThrow('absolute');
    expect(() => validateGitPath('payments/api')).toThrow('absolute');
  });

  it('rejects path traversal sequences', () => {
    expect(() => validateGitPath('/../payments')).toThrow('traversal');
    expect(() => validateGitPath('/payments/../secrets')).toThrow('traversal');
  });

  it('rejects invalid characters', () => {
    expect(() => validateGitPath('/payments api')).toThrow('invalid characters');
    expect(() => validateGitPath('/payments$api')).toThrow('invalid characters');
  });
});
