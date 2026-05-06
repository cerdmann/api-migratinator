import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { runMigrate } from '../../src/migration/runner.js';
import type { PostmanClient } from '../../src/postman/client.js';
import type { DiscoveredApi } from '../../src/migration/discovery.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'moat-migrate-test-'));
});

async function cleanup() {
  await rm(dir, { recursive: true, force: true });
}

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

const nonGitApi: DiscoveredApi = {
  id: 'api-nogit',
  name: 'Billing API',
  workspaceId: 'ws-1',
  workspaceName: 'Alpha Team',
  resolvedWorkspaceName: 'Alpha Team - Billing API',
  schemas: [{ id: 'schema-1', type: 'openapi:3_1' }],
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

describe('runMigrate', () => {
  it('routes git-linked APIs through Path A', async () => {
    const spawnCli = vi.fn().mockResolvedValue(undefined);
    const client = makeClient(
      { '/apis/api-git/spec-migrations': { message: 'Moving to Spec Hub started successfully', success: true } },
      { '/apis/api-git/spec-migrations': { status: 'completed' } }
    );

    const result = await runMigrate(client, [gitApi], {
      spawnCli,
      checkpointPath: join(dir, 'cp.json'),
      concurrency: 1,
      pollIntervalMs: 0,
    });

    expect(result.completed).toContain('api-git');
    expect(result.failed).toHaveLength(0);
    await cleanup();
  });

  it('routes non-git APIs through Path B', async () => {
    const spawnCli = vi.fn().mockResolvedValue(undefined);
    const client = makeClient(
      { '/apis/api-nogit/spec-migrations': { message: 'Moving to Spec Hub started successfully', success: true } },
      { '/apis/api-nogit/spec-migrations': { status: 'completed' } }
    );

    const result = await runMigrate(client, [nonGitApi], {
      spawnCli,
      checkpointPath: join(dir, 'cp.json'),
      concurrency: 1,
      pollIntervalMs: 0,
    });

    expect(result.completed).toContain('api-nogit');
    expect(result.failed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    await cleanup();
  });

  it('marks APIs with no schemas as skipped, not failed', async () => {
    const spawnCli = vi.fn().mockResolvedValue(undefined);
    const noSchemaApi: DiscoveredApi = { ...nonGitApi, schemas: [] };
    const client = makeClient({}, {});

    const result = await runMigrate(client, [noSchemaApi], {
      spawnCli,
      checkpointPath: join(dir, 'cp.json'),
      concurrency: 1,
      pollIntervalMs: 0,
    });

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].id).toBe('api-nogit');
    expect(result.failed).toHaveLength(0);
    await cleanup();
  });

  it('records failed APIs without stopping the run', async () => {
    const spawnCli = vi.fn().mockResolvedValue(undefined);
    const client = makeClient(
      {
        '/apis/api-git/spec-migrations': { message: 'Moving to Spec Hub started successfully', success: true },
        '/apis/api-nogit/spec-migrations': { message: 'Moving to Spec Hub started successfully', success: true },
      },
      {
        '/apis/api-git/spec-migrations': { status: 'failed', error: 'Repo not found' },
        '/apis/api-nogit/spec-migrations': { status: 'completed' },
      }
    );

    const result = await runMigrate(client, [gitApi, nonGitApi], {
      spawnCli,
      checkpointPath: join(dir, 'cp.json'),
      concurrency: 1,
      pollIntervalMs: 0,
    });

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].id).toBe('api-git');
    expect(result.completed).toContain('api-nogit');
    await cleanup();
  });

  it('skips APIs already marked completed in checkpoint', async () => {
    const spawnCli = vi.fn().mockResolvedValue(undefined);
    const client = makeClient(
      { '/apis/api-nogit/spec-migrations': { message: 'Moving to Spec Hub started successfully', success: true } },
      { '/apis/api-nogit/spec-migrations': { status: 'completed' } }
    );

    const cpPath = join(dir, 'cp.json');

    await runMigrate(client, [nonGitApi], {
      spawnCli,
      checkpointPath: cpPath,
      concurrency: 1,
      pollIntervalMs: 0,
    });

    const callsAfterFirst = (client.post as ReturnType<typeof vi.fn>).mock.calls.length;

    await runMigrate(client, [nonGitApi], {
      spawnCli,
      checkpointPath: cpPath,
      concurrency: 1,
      pollIntervalMs: 0,
    });

    expect((client.post as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterFirst);
    await cleanup();
  });
});
