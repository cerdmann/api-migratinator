import { describe, it, expect, vi } from 'vitest';
import { getSchemaFiles } from '../../src/postman/schemas.js';
import type { PostmanClient } from '../../src/postman/client.js';

function makeClient(responses: Record<string, unknown>): PostmanClient {
  return {
    get: vi.fn(async (path: string) => {
      if (path in responses) return responses[path];
      throw new Error(`Unexpected GET ${path}`);
    }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getDefaultHeaders: vi.fn(() => ({})),
    getRateLimiterType: vi.fn(() => 'general' as const),
  };
}

describe('getSchemaFiles', () => {
  it('fetches file listing then content for each file', async () => {
    const client = makeClient({
      '/apis/api-1/schemas/schema-1/files': { files: [{ path: 'openapi.yaml' }] },
      '/apis/api-1/schemas/schema-1/files/openapi.yaml': { path: 'openapi.yaml', content: 'openapi: 3.1.0' },
    });

    const result = await getSchemaFiles(client, 'api-1', 'schema-1');
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('openapi.yaml');
    expect(result[0].content).toBe('openapi: 3.1.0');
  });

  it('fetches content for each file in a multi-file schema', async () => {
    const client = makeClient({
      '/apis/api-1/schemas/schema-1/files': {
        files: [{ path: 'index.yaml' }, { path: 'components/schemas.yaml' }],
      },
      '/apis/api-1/schemas/schema-1/files/index.yaml': { path: 'index.yaml', content: 'openapi: 3.1.0' },
      '/apis/api-1/schemas/schema-1/files/components/schemas.yaml': { path: 'components/schemas.yaml', content: 'schemas: {}' },
    });

    const result = await getSchemaFiles(client, 'api-1', 'schema-1');
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('openapi: 3.1.0');
    expect(result[1].content).toBe('schemas: {}');
  });

  it('returns empty array when schema has no files', async () => {
    const client = makeClient({
      '/apis/api-1/schemas/schema-1/files': { files: [] },
    });

    const result = await getSchemaFiles(client, 'api-1', 'schema-1');
    expect(result).toEqual([]);
  });
});
