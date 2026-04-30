import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { resolveConfigFile } from '../../config/file.js';
import { createPostmanClient } from '../../postman/client.js';
import { runDiscover } from '../../migration/discover.js';

export const discoverCommand = new Command('discover')
  .description('Discover all API Builder APIs across all team workspaces and check for naming collisions')
  .option('--workspace-pattern <pattern>', 'Workspace naming pattern (overrides moat.config.json)')
  .action(async (options) => {
    const configFile = await resolveConfigFile();

    let config;
    try {
      config = await loadConfig({
        configFile,
        cliArgs: options.workspacePattern
          ? { workspacePattern: options.workspacePattern }
          : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n${message}`);
      console.error('\nCreate a moat.config.json (see moat.config.json.example) or set POSTMAN_API_KEY and GIT_TOKEN env vars.');
      process.exit(1);
    }

    const client = createPostmanClient({ apiKey: config.postmanApiKey });

    console.log('Discovering workspaces and APIs...\n');

    let result;
    try {
      result = await runDiscover(client, config.workspacePattern);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nFailed to discover APIs: ${message}`);
      console.error('Check that your POSTMAN_API_KEY is valid and has admin access.');
      process.exit(1);
    }

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
