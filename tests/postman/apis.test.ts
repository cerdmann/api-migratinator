import { describe, it, expect, vi } from 'vitest';
import { listApisForWorkspace, getApiWithGitInfo } from '../../src/postman/apis.js';
import type { PostmanClient } from '../../src/postman/client.js';

function makeClient(responses: unknown[]): PostmanClient {
  let call = 0;
  return {
    get: vi.fn(async () => responses[call++]),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getDefaultHeaders: vi.fn(() => ({})),
    getRateLimiterType: vi.fn(() => 'general' as const),
  };
}

describe('listApisForWorkspace', () => {
  it('returns APIs for a workspace', async () => {
    const client = makeClient([
      { apis: [{ id: 'api-1', name: 'Payments API', uid: '123-api-1' }] },
    ]);
    const result = await listApisForWorkspace(client, 'ws-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('api-1');
  });

  it('returns empty array when workspace has no APIs', async () => {
    const client = makeClient([{ apis: [] }]);
    const result = await listApisForWorkspace(client, 'ws-1');
    expect(result).toEqual([]);
  });

  it('passes workspaceId as query param', async () => {
    const client = makeClient([{ apis: [] }]);
    await listApisForWorkspace(client, 'ws-42');
    expect(client.get).toHaveBeenCalledWith('/apis', { workspaceId: 'ws-42' });
  });
});

describe('getApiWithGitInfo', () => {
  it('returns API with gitInfo when present', async () => {
    const client = makeClient([
      {
        api: {
          id: 'api-1',
          name: 'Payments API',
          gitInfo: {
            domain: 'github.com',
            repository: 'payments-api',
            organization: 'acme-corp',
            schemaFolder: '/',
            collectionFolder: 'postman/collections',
            branch: 'main',
          },
        },
      },
    ]);
    const result = await getApiWithGitInfo(client, 'api-1');
    expect(result.gitInfo).toBeDefined();
    expect(result.gitInfo?.repository).toBe('payments-api');
  });

  it('returns API without gitInfo when not git-linked', async () => {
    const client = makeClient([
      { api: { id: 'api-2', name: 'Billing API' } },
    ]);
    const result = await getApiWithGitInfo(client, 'api-2');
    expect(result.gitInfo).toBeUndefined();
  });

  it('requests gitInfo include param', async () => {
    const client = makeClient([{ api: { id: 'api-1', name: 'Test' } }]);
    await getApiWithGitInfo(client, 'api-1');
    expect(client.get).toHaveBeenCalledWith('/apis/api-1', { include: 'gitInfo' });
  });
});
