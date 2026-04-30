import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { getStatus } from '../../src/migration/status.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'moat-status-test-'));
});

async function cleanup() {
  await rm(dir, { recursive: true, force: true });
}

function writeCheckpoint(path: string, data: object) {
  return writeFile(path, JSON.stringify(data), 'utf-8');
}

describe('getStatus', () => {
  it('reports a clean run with all completed', async () => {
    const cp = join(dir, 'cp.json');
    await writeCheckpoint(cp, {
      pending: [],
      completed: ['api-1', 'api-2'],
      failed: [],
    });

    const status = await getStatus(cp);
    expect(status.total).toBe(2);
    expect(status.completed).toBe(2);
    expect(status.failed).toBe(0);
    expect(status.pending).toBe(0);
    expect(status.isComplete).toBe(true);
    await cleanup();
  });

  it('reports an in-progress run', async () => {
    const cp = join(dir, 'cp.json');
    await writeCheckpoint(cp, {
      pending: ['api-3'],
      completed: ['api-1', 'api-2'],
      failed: [],
    });

    const status = await getStatus(cp);
    expect(status.total).toBe(3);
    expect(status.completed).toBe(2);
    expect(status.pending).toBe(1);
    expect(status.isComplete).toBe(false);
    await cleanup();
  });

  it('reports failures with their error messages', async () => {
    const cp = join(dir, 'cp.json');
    await writeCheckpoint(cp, {
      pending: [],
      completed: ['api-1'],
      failed: [{ id: 'api-2', error: 'Repo not found' }],
    });

    const status = await getStatus(cp);
    expect(status.failed).toBe(1);
    expect(status.failures[0]).toEqual({ id: 'api-2', error: 'Repo not found' });
    expect(status.isComplete).toBe(true);
    await cleanup();
  });

  it('throws when checkpoint file does not exist', async () => {
    await expect(getStatus(join(dir, 'missing.json'))).rejects.toThrow();
    await cleanup();
  });

  it('computes percent complete correctly', async () => {
    const cp = join(dir, 'cp.json');
    await writeCheckpoint(cp, {
      pending: ['api-4'],
      completed: ['api-1', 'api-2'],
      failed: [{ id: 'api-3', error: 'err' }],
    });

    const status = await getStatus(cp);
    expect(status.total).toBe(4);
    expect(status.percentComplete).toBe(75);
    await cleanup();
  });
});
