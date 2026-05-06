import { describe, it, expect, vi } from 'vitest';
import { migratePathB } from '../../src/migration/pathB.js';
import type { PostmanClient } from '../../src/postman/client.js';
import type { DiscoveredApi } from '../../src/migration/discovery.js';

const nonGitApi: DiscoveredApi = {
  id: 'api-nogit',
  name: 'Billing API',
  workspaceId: 'ws-1',
  workspaceName: 'Alpha Team',
  resolvedWorkspaceName: 'Alpha Team - Billing API',
  schemas: [{ id: 'schema-1', type: 'openapi:3_1' }],
};

function makeClient(
  postResponses: Record<string, unknown> = {},
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

describe('migratePathB', () => {
  it('posts to spec-migrations with workspaceInfo only (no gitInfo)', async () => {
    const client = makeClient(
      { '/apis/api-nogit/spec-migrations': { message: 'Moving to Spec Hub started successfully', success: true } },
      { '/apis/api-nogit/spec-migrations': { status: 'completed' } }
    );

    await migratePathB(client, nonGitApi, { pollIntervalMs: 0 });

    expect(client.post).toHaveBeenCalledWith(
      '/apis/api-nogit/spec-migrations',
      { workspaceInfo: { name: 'Alpha Team - Billing API' } }
    );
    const body = (client.post as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(body).not.toHaveProperty('gitInfo');
  });

  it('polls until completed', async () => {
    let pollCount = 0;
    const client: PostmanClient = {
      get: vi.fn(async () => {
        pollCount++;
        if (pollCount < 3) return { status: 'running' };
        return { status: 'completed' };
      }),
      post: vi.fn(async () => ({ message: 'Moving to Spec Hub started successfully', success: true })),
      put: vi.fn(),
      delete: vi.fn(),
      getDefaultHeaders: vi.fn(() => ({})),
      getRateLimiterType: vi.fn(() => 'general' as const),
    };

    await migratePathB(client, nonGitApi, { pollIntervalMs: 0 });

    expect(pollCount).toBe(3);
  });

  it('returns immediately when API has no definition', async () => {
    const client = makeClient(
      { '/apis/api-nogit/spec-migrations': { message: "doesn't have any API Definition", success: true } },
    );

    const result = await migratePathB(client, nonGitApi, { pollIntervalMs: 0 });

    expect(client.get).not.toHaveBeenCalled();
    expect(result.status).toBe('completed');
  });

  it('throws when migration fails during polling', async () => {
    const client = makeClient(
      { '/apis/api-nogit/spec-migrations': { message: 'Moving to Spec Hub started successfully', success: true } },
      { '/apis/api-nogit/spec-migrations': { status: 'failed', error: 'Something went wrong' } }
    );

    await expect(migratePathB(client, nonGitApi, { pollIntervalMs: 0 }))
      .rejects.toThrow('Something went wrong');
  });

  it('throws when API has no schemas', async () => {
    const apiWithNoSchemas: DiscoveredApi = { ...nonGitApi, schemas: [] };
    const client = makeClient();

    await expect(migratePathB(client, apiWithNoSchemas)).rejects.toThrow('no schemas');
  });
});
