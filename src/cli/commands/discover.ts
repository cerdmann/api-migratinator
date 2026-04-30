import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { loadConfig } from '../../config/loader.js';
import { createPostmanClient } from '../../postman/client.js';
import { runDiscover } from '../../migration/discover.js';

export const discoverCommand = new Command('discover')
  .description('Discover all API Builder APIs across all team workspaces and check for naming collisions')
  .option('--workspace-pattern <pattern>', 'Workspace naming pattern (overrides moat.config.json)')
  .action(async (options) => {
    let configFile: Record<string, unknown> = {};
    try {
      const raw = await readFile('moat.config.json', 'utf-8');
      configFile = JSON.parse(raw);
    } catch {
      // no config file — rely on env vars
    }

    const config = await loadConfig({
      configFile,
      cliArgs: options.workspacePattern
        ? { workspacePattern: options.workspacePattern }
        : undefined,
    });

    const client = createPostmanClient({ apiKey: config.postmanApiKey });

    console.log('Discovering workspaces and APIs...\n');
    const result = await runDiscover(client, config.workspacePattern);

    console.log(`Workspaces found:   ${result.workspaces.length}`);
    console.log(`Total APIs found:   ${result.apis.length}`);
    console.log(`  Git-linked:       ${result.gitLinked.length}`);
    console.log(`  Non-git-linked:   ${result.nonGitLinked.length}`);

    if (result.collisions.length > 0) {
      console.log(`\n⚠ Workspace name collisions detected (${result.collisions.length}):`);
      result.collisions.forEach(name => console.log(`  - "${name}"`));
      console.log('\n  Adjust --workspace-pattern to resolve before migrating.');
    } else {
      console.log('\n✓ No workspace name collisions detected.');
    }

    console.log('\nAPI breakdown:\n');
    for (const api of result.apis) {
      const tag = api.gitInfo ? '[git]    ' : '[no-git] ';
      console.log(`  ${tag} ${api.workspaceName} / ${api.name}  →  "${api.resolvedWorkspaceName}"`);
    }
  });
