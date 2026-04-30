import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

interface ResolveOptions {
  cwd?: string;
  home?: string;
}

export async function resolveConfigFile(options: ResolveOptions = {}): Promise<Record<string, unknown>> {
  const cwd = options.cwd ?? process.cwd();
  const home = options.home ?? homedir();

  const candidates = [
    join(cwd, 'moat.config.json'),
    join(home, '.moat.config.json'),
  ];

  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, 'utf-8');
      return JSON.parse(raw);
    } catch {
      // not found or not valid JSON — try next
    }
  }

  return {};
}
