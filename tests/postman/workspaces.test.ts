import { describe, it, expect, vi } from 'vitest';
import { listAllWorkspaces } from '../../src/postman/workspaces.js';
import type { PostmanClient } from '../../src/postman/client.js';

function makeClient(pages: unknown[]): PostmanClient {
  let call = 0;
  return {
    get: vi.fn(async () => pages[call++]),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getDefaultHeaders: vi.fn(() => ({})),
    getRateLimiterType: vi.fn(() => 'general' as const),
  };
}

describe('listAllWorkspaces', () => {
  it('returns workspaces from a single page', async () => {
    const client = makeClient([
      { workspaces: [{ id: 'ws-1', name: 'Alpha', type: 'team' }] },
    ]);
    const result = await listAllWorkspaces(client);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ws-1');
  });

  it('paginates through multiple pages', async () => {
    const client = makeClient([
      {
        workspaces: [{ id: 'ws-1', name: 'Alpha', type: 'team' }],
        nextCursor: 'cursor-1',
      },
      {
        workspaces: [{ id: 'ws-2', name: 'Beta', type: 'team' }],
      },
    ]);
    const result = await listAllWorkspaces(client);
    expect(result).toHaveLength(2);
    expect(result.map(w => w.id)).toEqual(['ws-1', 'ws-2']);
  });

  it('returns empty array when no workspaces exist', async () => {
    const client = makeClient([{ workspaces: [] }]);
    const result = await listAllWorkspaces(client);
    expect(result).toEqual([]);
  });

  it('stops paginating when nextCursor is absent', async () => {
    const client = makeClient([
      { workspaces: [{ id: 'ws-1', name: 'Alpha', type: 'team' }] },
    ]);
    const result = await listAllWorkspaces(client);
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });
});
