import { Command } from 'commander';
import { loadConfig } from '../../config/loader.js';
import { resolveConfigFile } from '../../config/file.js';
import { createPostmanClient } from '../../postman/client.js';
import { runDiscover } from '../../migration/discovery.js';

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
      console.error(JSON.stringify({ error: message }));
      process.exit(1);
    }

    const client = createPostmanClient({ apiKey: config.postmanApiKey });

    let result;
    try {
      result = await runDiscover(client, config.workspacePattern);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ error: `Failed to discover APIs: ${message}` }));
      process.exit(1);
    }

    const output = {
      summary: {
        workspacesFound: result.workspaces.length,
        totalApis: result.apis.length,
        gitLinked: result.gitLinked.length,
        nonGitLinked: result.nonGitLinked.length,
        collisions: result.collisions,
      },
      apis: result.apis.map(api => ({
        id: api.id,
        name: api.name,
        workspaceName: api.workspaceName,
        resolvedWorkspaceName: api.resolvedWorkspaceName,
        gitLinked: !!api.gitInfo,
      })),
    };

    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
  });
