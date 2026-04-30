import { describe, it, expect, vi } from 'vitest';
import { migratePathB } from '../../src/migration/pathB.js';
import type { PostmanClient } from '../../src/postman/client.js';
import type { DiscoveredApi } from '../../src/migration/discover.js';

const nonGitApi: DiscoveredApi = {
  id: 'api-nogit',
  name: 'Billing API',
  workspaceId: 'ws-1',
  workspaceName: 'Alpha Team',
  resolvedWorkspaceName: 'Alpha Team - Billing API',
};

const schemaFiles = [
  { path: 'openapi.yaml', content: 'openapi: 3.1.0\ninfo:\n  title: Billing API' },
];

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

describe('migratePathB', () => {
  it('creates a new workspace', async () => {
    const client = makeClient({
      '/apis/api-nogit/schemas': { schemas: [{ id: 'schema-1', type: 'openapi:3_1' }] },
      '/apis/api-nogit/schemas/schema-1/files': { files: schemaFiles },
      '/workspaces': { id: 'new-ws-1', name: 'Alpha Team - Billing API' },
      '/specs': { id: 'spec-1' },
    });

    await migratePathB(client, nonGitApi);

    expect(client.post).toHaveBeenCalledWith('/workspaces', expect.objectContaining({
      workspace: expect.objectContaining({ name: 'Alpha Team - Billing API' }),
    }));
  });

  it('reads schema files from the source API', async () => {
    const client = makeClient({
      '/apis/api-nogit/schemas': { schemas: [{ id: 'schema-1', type: 'openapi:3_1' }] },
      '/apis/api-nogit/schemas/schema-1/files': { files: schemaFiles },
      '/workspaces': { id: 'new-ws-1' },
      '/specs': { id: 'spec-1' },
    });

    await migratePathB(client, nonGitApi);

    expect(client.get).toHaveBeenCalledWith('/apis/api-nogit/schemas');
    expect(client.get).toHaveBeenCalledWith('/apis/api-nogit/schemas/schema-1/files');
  });

  it('creates a spec in the new workspace', async () => {
    const client = makeClient({
      '/apis/api-nogit/schemas': { schemas: [{ id: 'schema-1', type: 'openapi:3_1' }] },
      '/apis/api-nogit/schemas/schema-1/files': { files: schemaFiles },
      '/workspaces': { id: 'new-ws-1' },
      '/specs': { id: 'spec-1' },
    });

    const result = await migratePathB(client, nonGitApi);

    expect(client.post).toHaveBeenCalledWith('/specs', expect.objectContaining({
      workspaceId: 'new-ws-1',
      name: 'Billing API',
    }));
    expect(result.specId).toBe('spec-1');
  });

  it('throws when API has no schemas', async () => {
    const client = makeClient({
      '/apis/api-nogit/schemas': { schemas: [] },
    });

    await expect(migratePathB(client, nonGitApi)).rejects.toThrow('no schemas');
  });
});
