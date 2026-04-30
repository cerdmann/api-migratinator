import { describe, it, expect, vi } from 'vitest';
import { runDiscover } from '../../src/migration/discover.js';
import type { PostmanClient } from '../../src/postman/client.js';

const wsAlpha = { id: 'ws-1', name: 'Alpha Team', type: 'team' };
const wsBeta  = { id: 'ws-2', name: 'Beta Team',  type: 'team' };

const apiGit = {
  id: 'api-git',
  name: 'Payments API',
  uid: '123-api-git',
};

const apiNoGit = {
  id: 'api-nogit',
  name: 'Billing API',
  uid: '123-api-nogit',
};

const gitInfoFull = {
  domain: 'github.com',
  repository: 'payments-api',
  organization: 'acme-corp',
  schemaFolder: '/',
  collectionFolder: 'postman/collections',
  branch: 'main',
};

function makeClient(responses: Record<string, unknown>): PostmanClient {
  return {
    get: vi.fn(async (path: string, params?: Record<string, string>) => {
      const key = params ? `${path}?${new URLSearchParams(params).toString()}` : path;
      if (key in responses) return responses[key];
      throw new Error(`Unexpected GET ${key}`);
    }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getDefaultHeaders: vi.fn(() => ({})),
    getRateLimiterType: vi.fn(() => 'general' as const),
  };
}

describe('runDiscover', () => {
  it('returns all workspaces and APIs', async () => {
    const client = makeClient({
      '/workspaces': { workspaces: [wsAlpha] },
      '/apis?workspaceId=ws-1': { apis: [apiGit] },
      '/apis/api-git?include=gitInfo': { api: { ...apiGit, gitInfo: gitInfoFull } },
    });

    const result = await runDiscover(client, '{workspace} - {spec}');
    expect(result.workspaces).toHaveLength(1);
    expect(result.apis).toHaveLength(1);
  });

  it('separates git-linked and non-git-linked APIs', async () => {
    const client = makeClient({
      '/workspaces': { workspaces: [wsAlpha] },
      '/apis?workspaceId=ws-1': { apis: [apiGit, apiNoGit] },
      '/apis/api-git?include=gitInfo': { api: { ...apiGit, gitInfo: gitInfoFull } },
      '/apis/api-nogit?include=gitInfo': { api: { ...apiNoGit } },
    });

    const result = await runDiscover(client, '{workspace} - {spec}');
    expect(result.gitLinked).toHaveLength(1);
    expect(result.nonGitLinked).toHaveLength(1);
    expect(result.gitLinked[0].id).toBe('api-git');
    expect(result.nonGitLinked[0].id).toBe('api-nogit');
  });

  it('aggregates APIs across multiple workspaces', async () => {
    const client = makeClient({
      '/workspaces': { workspaces: [wsAlpha, wsBeta] },
      '/apis?workspaceId=ws-1': { apis: [apiGit] },
      '/apis?workspaceId=ws-2': { apis: [apiNoGit] },
      '/apis/api-git?include=gitInfo': { api: { ...apiGit, gitInfo: gitInfoFull } },
      '/apis/api-nogit?include=gitInfo': { api: { ...apiNoGit } },
    });

    const result = await runDiscover(client, '{workspace} - {spec}');
    expect(result.apis).toHaveLength(2);
  });

  it('detects workspace name collisions', async () => {
    const apiGit2 = { id: 'api-git-2', name: 'Payments API', uid: '123-api-git-2' };
    const client = makeClient({
      '/workspaces': { workspaces: [wsAlpha, wsBeta] },
      '/apis?workspaceId=ws-1': { apis: [apiGit] },
      '/apis?workspaceId=ws-2': { apis: [apiGit2] },
      '/apis/api-git?include=gitInfo': { api: { ...apiGit, gitInfo: gitInfoFull } },
      '/apis/api-git-2?include=gitInfo': { api: { ...apiGit2, gitInfo: { ...gitInfoFull, repository: 'payments-api-2' } } },
    });

    const result = await runDiscover(client, '{spec}');
    expect(result.collisions).toContain('Payments API');
  });

  it('returns empty collisions when all names are unique', async () => {
    const client = makeClient({
      '/workspaces': { workspaces: [wsAlpha] },
      '/apis?workspaceId=ws-1': { apis: [apiGit] },
      '/apis/api-git?include=gitInfo': { api: { ...apiGit, gitInfo: gitInfoFull } },
    });

    const result = await runDiscover(client, '{workspace} - {spec}');
    expect(result.collisions).toEqual([]);
  });

  it('attaches resolved workspace name to each API result', async () => {
    const client = makeClient({
      '/workspaces': { workspaces: [wsAlpha] },
      '/apis?workspaceId=ws-1': { apis: [apiGit] },
      '/apis/api-git?include=gitInfo': { api: { ...apiGit, gitInfo: gitInfoFull } },
    });

    const result = await runDiscover(client, '{workspace} - {spec}');
    expect(result.apis[0].resolvedWorkspaceName).toBe('Alpha Team - Payments API');
  });
});
