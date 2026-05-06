import { Command } from 'commander';
import { spawn } from 'child_process';
import { loadConfig } from '../../config/loader.js';
import { resolveConfigFile } from '../../config/file.js';
import { createPostmanClient } from '../../postman/client.js';
import { runDiscover } from '../../migration/discovery.js';
import { runMigrate } from '../../migration/runner.js';
import { checkPostmanCli } from '../postman-cli.js';

function spawnCli(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('postman', args, { stdio: 'inherit' });
    proc.on('close', code =>
      code === 0 ? resolve() : reject(new Error(`postman ${args.join(' ')} exited with code ${code}`))
    );
  });
}

export const migrateCommand = new Command('migrate')
  .description('Migrate all API Builder APIs to V12 Spec Hub')
  .option('--workspace-pattern <pattern>', 'Workspace naming pattern (overrides moat.config.json)')
  .option('--api-id <id>', 'Migrate a single API by ID')
  .option('--concurrency <n>', 'Number of APIs to migrate in parallel', '5')
  .option('--checkpoint <path>', 'Path to checkpoint file for resume support', '.moat-checkpoint.json')
  .option('--non-git', 'Migrate only non-git-linked APIs (Path B)')
  .option('--dry-run', 'Preview what would be migrated without making changes')
  .action(async (options) => {
    const configFile = await resolveConfigFile();

    let config;
    try {
      config = await loadConfig({
        configFile,
        cliArgs: options.workspacePattern ? { workspacePattern: options.workspacePattern } : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n${message}`);
      console.error('\nCreate a moat.config.json (see moat.config.json.example) or set POSTMAN_API_KEY and GIT_TOKEN env vars.');
      process.exit(1);
    }

    const client = createPostmanClient({ apiKey: config.postmanApiKey });

    console.log('Discovering APIs...\n');
    let discovery;
    try {
      discovery = await runDiscover(client, config.workspacePattern);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nFailed to discover APIs: ${message}`);
      console.error('Check that your POSTMAN_API_KEY is valid and has admin access.');
      process.exit(1);
    }

    if (discovery.collisions.length > 0) {
      console.error(`\n⚠ Workspace name collisions detected (${discovery.collisions.length}):`);
      discovery.collisions.forEach(name => console.error(`  - "${name}"`));
      console.error('\nRun `moat discover` to review and adjust --workspace-pattern before migrating.');
      process.exit(1);
    }

    let apisToMigrate = discovery.apis;
    if (options.apiId) {
      apisToMigrate = discovery.apis.filter(a => a.id === options.apiId);
      if (apisToMigrate.length === 0) {
        console.error(`\nNo API found with ID "${options.apiId}". Run \`moat discover\` to list available APIs.`);
        process.exit(1);
      }
      console.log(`Found API: ${apisToMigrate[0].name} (${options.apiId})\n`);
    } else if (options.nonGit) {
      apisToMigrate = discovery.nonGitLinked;
      console.log(`Found ${apisToMigrate.length} non-git-linked APIs\n`);
    } else {
      console.log(`Found ${discovery.apis.length} APIs (${discovery.gitLinked.length} git-linked, ${discovery.nonGitLinked.length} non-git-linked)\n`);
    }

    if (options.dryRun) {
      console.log('Dry run — no changes will be made.\n');
      for (const api of apisToMigrate) {
        const path = api.gitInfo ? 'Path A (git)' : 'Path B (no-git)';
        console.log(`  [${path}] ${api.workspaceName} / ${api.name}  →  "${api.resolvedWorkspaceName}"`);
      }
      process.exit(0);
    }

    const hasGitLinked = apisToMigrate.some(a => a.gitInfo);

    if (hasGitLinked) {
      if (!config.gitToken) {
        console.error('\nA git token is required for git-linked APIs. Set GIT_TOKEN or add "gitToken" to moat.config.json.');
        process.exit(1);
      }
      try {
        await checkPostmanCli();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`\n${message}`);
        process.exit(1);
      }
    }

    const result = await runMigrate(client, apisToMigrate, {
      spawnCli,
      checkpointPath: options.checkpoint,
      concurrency: parseInt(options.concurrency, 10),
    });

    console.log(`\nMigration complete.`);
    console.log(`  Completed: ${result.completed.length}`);
    console.log(`  Skipped:   ${result.skipped.length}`);
    console.log(`  Failed:    ${result.failed.length}`);

    if (result.skipped.length > 0) {
      console.log('\nSkipped APIs (no spec to migrate):');
      result.skipped.forEach(s => console.log(`  - ${s.id}: ${s.reason}`));
    }

    if (result.failed.length > 0) {
      console.log('\nFailed APIs:');
      result.failed.forEach(f => console.log(`  - ${f.id}: ${f.error}`));
      console.log(`\nRun \`moat status\` for details. Re-run \`moat migrate\` to retry failed APIs.`);
    }

    process.exit(0);
  });
