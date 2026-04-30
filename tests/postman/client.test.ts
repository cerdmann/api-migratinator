import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPostmanClient } from '../../src/postman/client.js';

describe('createPostmanClient', () => {
  it('creates a client with the provided API key', () => {
    const client = createPostmanClient({ apiKey: 'pk-test' });
    expect(client).toBeDefined();
  });

  it('exposes get, post, put, delete methods', () => {
    const client = createPostmanClient({ apiKey: 'pk-test' });
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.delete).toBe('function');
  });

  it('sets X-API-Key header on requests', async () => {
    const client = createPostmanClient({ apiKey: 'pk-test-key' });
    const headers = client.getDefaultHeaders();
    expect(headers['X-API-Key']).toBe('pk-test-key');
  });

  it('uses the general rate limiter by default', () => {
    const client = createPostmanClient({ apiKey: 'pk-test' });
    expect(client.getRateLimiterType('GET', '/apis')).toBe('general');
  });

  it('uses the workspace rate limiter for /workspaces endpoints', () => {
    const client = createPostmanClient({ apiKey: 'pk-test' });
    expect(client.getRateLimiterType('GET', '/workspaces')).toBe('workspace');
    expect(client.getRateLimiterType('GET', '/workspaces/abc/roles')).toBe('workspace');
    expect(client.getRateLimiterType('PUT', '/workspaces/abc/tags')).toBe('workspace');
  });
});
