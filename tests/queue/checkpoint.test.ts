import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Checkpoint } from '../../src/queue/checkpoint.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'moat-test-'));
});

async function cleanup() {
  await rm(dir, { recursive: true, force: true });
}

describe('Checkpoint', () => {
  it('starts with all APIs pending', async () => {
    const cp = new Checkpoint(join(dir, 'cp.json'));
    await cp.init(['api-1', 'api-2', 'api-3']);
    expect(await cp.getPending()).toEqual(['api-1', 'api-2', 'api-3']);
    await cleanup();
  });

  it('marks an API as completed', async () => {
    const cp = new Checkpoint(join(dir, 'cp.json'));
    await cp.init(['api-1', 'api-2']);
    await cp.markCompleted('api-1');
    expect(await cp.getPending()).toEqual(['api-2']);
    expect(await cp.getCompleted()).toContain('api-1');
    await cleanup();
  });

  it('marks an API as failed', async () => {
    const cp = new Checkpoint(join(dir, 'cp.json'));
    await cp.init(['api-1', 'api-2']);
    await cp.markFailed('api-1', 'Network error');
    expect(await cp.getPending()).toEqual(['api-2']);
    expect(await cp.getFailed()).toEqual([{ id: 'api-1', error: 'Network error' }]);
    await cleanup();
  });

  it('persists state to disk and resumes', async () => {
    const path = join(dir, 'cp.json');
    const cp1 = new Checkpoint(path);
    await cp1.init(['api-1', 'api-2', 'api-3']);
    await cp1.markCompleted('api-1');

    const cp2 = new Checkpoint(path);
    await cp2.load();
    expect(await cp2.getPending()).toEqual(['api-2', 'api-3']);
    expect(await cp2.getCompleted()).toContain('api-1');
    await cleanup();
  });

  it('reports overall progress', async () => {
    const cp = new Checkpoint(join(dir, 'cp.json'));
    await cp.init(['api-1', 'api-2', 'api-3', 'api-4']);
    await cp.markCompleted('api-1');
    await cp.markCompleted('api-2');
    await cp.markFailed('api-3', 'error');

    const progress = await cp.getProgress();
    expect(progress.total).toBe(4);
    expect(progress.completed).toBe(2);
    expect(progress.failed).toBe(1);
    expect(progress.pending).toBe(1);
    await cleanup();
  });

  it('marks an API as skipped', async () => {
    const cp = new Checkpoint(join(dir, 'cp.json'));
    await cp.init(['api-1', 'api-2']);
    await cp.markSkipped('api-1', 'No schemas');
    expect(await cp.getPending()).toEqual(['api-2']);
    expect(await cp.getSkipped()).toEqual([{ id: 'api-1', reason: 'No schemas' }]);
    await cleanup();
  });

  it('returns empty pending when all APIs are done', async () => {
    const cp = new Checkpoint(join(dir, 'cp.json'));
    await cp.init(['api-1']);
    await cp.markCompleted('api-1');
    expect(await cp.getPending()).toEqual([]);
    await cleanup();
  });
});
