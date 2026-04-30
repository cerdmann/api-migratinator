import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.POSTMAN_API_KEY;
    delete process.env.GIT_TOKEN;
  });

  afterEach(() => {
    delete process.env.POSTMAN_API_KEY;
    delete process.env.GIT_TOKEN;
  });

  it('loads config from a file', async () => {
    const config = await loadConfig({
      configFile: {
        postmanApiKey: 'file-key',
        gitToken: 'file-token',
        workspacePattern: '{repo}',
      },
    });
    expect(config.postmanApiKey).toBe('file-key');
    expect(config.gitToken).toBe('file-token');
    expect(config.workspacePattern).toBe('{repo}');
  });

  it('env vars override config file', async () => {
    process.env.POSTMAN_API_KEY = 'env-key';
    process.env.GIT_TOKEN = 'env-token';
    const config = await loadConfig({
      configFile: {
        postmanApiKey: 'file-key',
        gitToken: 'file-token',
      },
    });
    expect(config.postmanApiKey).toBe('env-key');
    expect(config.gitToken).toBe('env-token');
  });

  it('CLI args override env vars', async () => {
    process.env.POSTMAN_API_KEY = 'env-key';
    const config = await loadConfig({
      configFile: { postmanApiKey: 'file-key', gitToken: 'file-token' },
      cliArgs: { workspacePattern: '{org}/{repo}' },
    });
    expect(config.workspacePattern).toBe('{org}/{repo}');
  });

  it('applies default workspacePattern when not set anywhere', async () => {
    const config = await loadConfig({
      configFile: { postmanApiKey: 'pk', gitToken: 'gt' },
    });
    expect(config.workspacePattern).toBe('{workspace} - {spec}');
  });

  it('throws when postmanApiKey is missing from all sources', async () => {
    await expect(
      loadConfig({ configFile: { gitToken: 'gt' } })
    ).rejects.toThrow();
  });

  it('throws when gitToken is missing from all sources', async () => {
    await expect(
      loadConfig({ configFile: { postmanApiKey: 'pk' } })
    ).rejects.toThrow();
  });
});
