import { describe, it, expect } from 'vitest';
import { configSchema, type Config } from '../../src/config/schema.js';

describe('configSchema', () => {
  it('accepts a valid complete config', () => {
    const result = configSchema.safeParse({
      postmanApiKey: 'pk-123',
      gitToken: 'ghp_abc',
      workspacePattern: '{workspace} - {spec}',
    });
    expect(result.success).toBe(true);
  });

  it('uses default workspacePattern when omitted', () => {
    const result = configSchema.safeParse({
      postmanApiKey: 'pk-123',
      gitToken: 'ghp_abc',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workspacePattern).toBe('{workspace} - {spec}');
    }
  });

  it('rejects missing postmanApiKey', () => {
    const result = configSchema.safeParse({
      gitToken: 'ghp_abc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing gitToken', () => {
    const result = configSchema.safeParse({
      postmanApiKey: 'pk-123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty string postmanApiKey', () => {
    const result = configSchema.safeParse({
      postmanApiKey: '',
      gitToken: 'ghp_abc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty string gitToken', () => {
    const result = configSchema.safeParse({
      postmanApiKey: 'pk-123',
      gitToken: '',
    });
    expect(result.success).toBe(false);
  });
});
