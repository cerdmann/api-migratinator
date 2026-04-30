import { describe, it, expect } from 'vitest';
import { resolveWorkspaceName, checkCollisions } from '../../src/migration/naming.js';

const base = {
  workspace: 'Payments Team',
  spec: 'Payments API',
  repo: 'payments-api',
  org: 'acme-corp',
  branch: 'main',
};

describe('resolveWorkspaceName', () => {
  it('resolves {workspace} - {spec} pattern', () => {
    expect(resolveWorkspaceName('{workspace} - {spec}', base)).toBe('Payments Team - Payments API');
  });

  it('resolves {org}/{repo} pattern', () => {
    expect(resolveWorkspaceName('{org}/{repo}', base)).toBe('acme-corp/payments-api');
  });

  it('resolves {repo} pattern', () => {
    expect(resolveWorkspaceName('{repo}', base)).toBe('payments-api');
  });

  it('resolves {branch} token', () => {
    expect(resolveWorkspaceName('{repo}-{branch}', base)).toBe('payments-api-main');
  });

  it('resolves {spec} only pattern', () => {
    expect(resolveWorkspaceName('{spec}', base)).toBe('Payments API');
  });

  it('leaves unknown tokens as-is', () => {
    expect(resolveWorkspaceName('{unknown}', base)).toBe('{unknown}');
  });

  it('handles pattern with no tokens', () => {
    expect(resolveWorkspaceName('Static Name', base)).toBe('Static Name');
  });

  it('handles missing token values gracefully', () => {
    const partial = { ...base, org: '' };
    expect(resolveWorkspaceName('{org}/{repo}', partial)).toBe('/payments-api');
  });
});

describe('checkCollisions', () => {
  it('returns empty array when no collisions', () => {
    const names = ['Workspace A', 'Workspace B', 'Workspace C'];
    expect(checkCollisions(names)).toEqual([]);
  });

  it('returns duplicate names when collisions exist', () => {
    const names = ['Workspace A', 'Workspace B', 'Workspace A'];
    const collisions = checkCollisions(names);
    expect(collisions).toContain('Workspace A');
    expect(collisions).toHaveLength(1);
  });

  it('reports each colliding name once even if it appears 3+ times', () => {
    const names = ['Foo', 'Foo', 'Foo', 'Bar'];
    expect(checkCollisions(names)).toEqual(['Foo']);
  });

  it('returns empty array for empty input', () => {
    expect(checkCollisions([])).toEqual([]);
  });

  it('is case-sensitive', () => {
    const names = ['workspace a', 'Workspace A'];
    expect(checkCollisions(names)).toEqual([]);
  });
});
