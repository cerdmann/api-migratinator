export interface NameTokens {
  workspace: string;
  spec: string;
  repo: string;
  org: string;
  branch: string;
}

export function resolveWorkspaceName(pattern: string, tokens: NameTokens): string {
  return pattern
    .replace('{workspace}', tokens.workspace)
    .replace('{spec}', tokens.spec)
    .replace('{repo}', tokens.repo)
    .replace('{org}', tokens.org)
    .replace('{branch}', tokens.branch);
}

export function checkCollisions(names: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) duplicates.add(name);
    else seen.add(name);
  }
  return [...duplicates];
}
