import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir, homedir } from 'os';
import { join } from 'path';
import { resolveConfigFile } from '../../src/config/file.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'moat-config-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('resolveConfigFile', () => {
  it('returns empty object when no config file exists anywhere', async () => {
    const result = await resolveConfigFile({ cwd: dir, home: dir });
    expect(result).toEqual({});
  });

  it('loads config from CWD when present', async () => {
    await writeFile(
      join(dir, 'moat.config.json'),
      JSON.stringify({ postmanApiKey: 'cwd-key', gitToken: 'cwd-token' })
    );
    const result = await resolveConfigFile({ cwd: dir, home: dir });
    expect(result.postmanApiKey).toBe('cwd-key');
  });

  it('loads config from home dir when no CWD config exists', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'moat-home-test-'));
    await writeFile(
      join(homeDir, '.moat.config.json'),
      JSON.stringify({ postmanApiKey: 'home-key', gitToken: 'home-token' })
    );
    const result = await resolveConfigFile({ cwd: dir, home: homeDir });
    expect(result.postmanApiKey).toBe('home-key');
    await rm(homeDir, { recursive: true, force: true });
  });

  it('prefers CWD config over home dir config', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'moat-home-test-'));
    await writeFile(
      join(dir, 'moat.config.json'),
      JSON.stringify({ postmanApiKey: 'cwd-key', gitToken: 'cwd-token' })
    );
    await writeFile(
      join(homeDir, '.moat.config.json'),
      JSON.stringify({ postmanApiKey: 'home-key', gitToken: 'home-token' })
    );
    const result = await resolveConfigFile({ cwd: dir, home: homeDir });
    expect(result.postmanApiKey).toBe('cwd-key');
    await rm(homeDir, { recursive: true, force: true });
  });

  it('defaults cwd to process.cwd() and home to os.homedir()', async () => {
    const result = await resolveConfigFile();
    expect(result).toBeDefined();
  });
});
