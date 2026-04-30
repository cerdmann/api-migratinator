import { describe, it, expect, vi } from 'vitest';
import { getSchemas, getSchemaFiles } from '../../src/postman/schemas.js';
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

describe('getSchemas', () => {
  it('returns schemas for an API', async () => {
    const client = makeClient({
      '/apis/api-1/schemas': {
        schemas: [{ id: 'schema-1', type: 'openapi:3_1' }],
      },
    });

    const result = await getSchemas(client, 'api-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('schema-1');
  });

  it('returns empty array when no schemas exist', async () => {
    const client = makeClient({
      '/apis/api-1/schemas': { schemas: [] },
    });

    const result = await getSchemas(client, 'api-1');
    expect(result).toEqual([]);
  });
});

describe('getSchemaFiles', () => {
  it('returns files for a schema', async () => {
    const client = makeClient({
      '/apis/api-1/schemas/schema-1/files': {
        files: [
          { path: 'openapi.yaml', content: 'openapi: 3.1.0' },
        ],
      },
    });

    const result = await getSchemaFiles(client, 'api-1', 'schema-1');
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('openapi.yaml');
    expect(result[0].content).toBe('openapi: 3.1.0');
  });

  it('returns multiple files for a multi-file schema', async () => {
    const client = makeClient({
      '/apis/api-1/schemas/schema-1/files': {
        files: [
          { path: 'index.yaml', content: 'openapi: 3.1.0' },
          { path: 'components/schemas.yaml', content: 'schemas: {}' },
        ],
      },
    });

    const result = await getSchemaFiles(client, 'api-1', 'schema-1');
    expect(result).toHaveLength(2);
  });
});
