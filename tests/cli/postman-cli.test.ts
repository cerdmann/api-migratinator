import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'child_process';
import { checkPostmanCli } from '../../src/cli/postman-cli.js';

const mockExecFile = vi.mocked(execFile);

describe('checkPostmanCli', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it('resolves when postman CLI is present', async () => {
    mockExecFile.mockImplementation((_cmd, _args, cb: any) => {
      cb(null, '1.0.0', '');
      return {} as any;
    });

    await expect(checkPostmanCli()).resolves.toBeUndefined();
  });

  it('throws with a helpful message when postman CLI is not found', async () => {
    const err = Object.assign(new Error('spawn postman ENOENT'), { code: 'ENOENT' });
    mockExecFile.mockImplementation((_cmd, _args, cb: any) => {
      cb(err, '', '');
      return {} as any;
    });

    await expect(checkPostmanCli()).rejects.toThrow(
      'Postman CLI not found. Install it with: npm install -g postman'
    );
  });

  it('throws with a helpful message when the command exits with non-zero code', async () => {
    const err = Object.assign(new Error('Command failed'), { code: 1 });
    mockExecFile.mockImplementation((_cmd, _args, cb: any) => {
      cb(err, '', '');
      return {} as any;
    });

    await expect(checkPostmanCli()).rejects.toThrow(
      'Postman CLI not found. Install it with: npm install -g postman'
    );
  });
});
