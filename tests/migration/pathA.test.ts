import { describe, it, expect, vi } from 'vitest';
import { migratePathA } from '../../src/migration/pathA.js';
import type { PostmanClient } from '../../src/postman/client.js';
import type { DiscoveredApi } from '../../src/migration/discover.js';

const gitApi: DiscoveredApi = {
  id: 'api-git',
  name: 'Payments API',
  workspaceId: 'ws-1',
  workspaceName: 'Alpha Team',
  resolvedWorkspaceName: 'Alpha Team - Payments API',
  gitInfo: {
    domain: 'github.com',
    repository: 'payments-api',
    organization: 'acme-corp',
    schemaFolder: '/',
    collectionFolder: 'postman/collections',
    branch: 'main',
  },
};

function makeClient(
  postResponses: Record<string, unknown>,
  getResponses: Record<string, unknown> = {}
): PostmanClient {
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

describe('migratePathA', () => {
  it('starts spec migration and polls to completion', async () => {
    const spawnCli = vi.fn().mockResolvedValue(undefined);
    const client = makeClient(
      { '/apis/api-git/spec-migrations': { message: 'Moving to Spec Hub started successfully', success: true } },
      { '/apis/api-git/spec-migrations': { status: 'completed' } }
    );

    const result = await migratePathA(client, gitApi, { spawnCli, pollIntervalMs: 0 });

    expect(result.status).toBe('completed');
    expect(client.post).toHaveBeenCalledWith(
      '/apis/api-git/spec-migrations',
      expect.objectContaining({
        workspaceInfo: { name: 'Alpha Team - Payments API' },
      }),
      expect.any(Object)
    );
  });

  it('calls postman workspace push after migration completes', async () => {
    const spawnCli = vi.fn().mockResolvedValue(undefined);
    const client = makeClient(
      { '/apis/api-git/spec-migrations': { message: 'Moving to Spec Hub started successfully', success: true } },
      { '/apis/api-git/spec-migrations': { status: 'completed' } }
    );

    await migratePathA(client, gitApi, { spawnCli, pollIntervalMs: 0 });

    expect(spawnCli).toHaveBeenCalledWith(
      expect.arrayContaining(['workspace', 'push', '--yes'])
    );
  });

  it('uses gitInfo schemaFolder as gitPath', async () => {
    const spawnCli = vi.fn().mockResolvedValue(undefined);
    const client = makeClient(
      { '/apis/api-git/spec-migrations': { message: 'Moving to Spec Hub started successfully', success: true } },
      { '/apis/api-git/spec-migrations': { status: 'completed' } }
    );

    await migratePathA(client, gitApi, { spawnCli, pollIntervalMs: 0 });

    expect(client.post).toHaveBeenCalledWith(
      '/apis/api-git/spec-migrations',
      expect.objectContaining({
        gitInfo: { path: '/' },
      }),
      expect.any(Object)
    );
  });

  it('throws when migration task fails', async () => {
    const spawnCli = vi.fn().mockResolvedValue(undefined);
    const client = makeClient(
      { '/apis/api-git/spec-migrations': { message: 'Moving to Spec Hub started successfully', success: true } },
      { '/apis/api-git/spec-migrations': { status: 'failed', error: 'Repo not accessible' } }
    );

    await expect(
      migratePathA(client, gitApi, { spawnCli, pollIntervalMs: 0 })
    ).rejects.toThrow('Repo not accessible');
  });
});
