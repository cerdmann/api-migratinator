import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { spawn } from 'child_process';
import { loadConfig } from '../../config/loader.js';
import { createPostmanClient } from '../../postman/client.js';
import { runDiscover } from '../../migration/discover.js';
import { runMigrate } from '../../migration/migrate.js';

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
  .option('--concurrency <n>', 'Number of APIs to migrate in parallel', '5')
  .option('--checkpoint <path>', 'Path to checkpoint file for resume support', '.moat-checkpoint.json')
  .option('--dry-run', 'Preview what would be migrated without making changes')
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
      cliArgs: options.workspacePattern ? { workspacePattern: options.workspacePattern } : undefined,
    });

    const client = createPostmanClient({ apiKey: config.postmanApiKey });

    console.log('Discovering APIs...\n');
    const discovery = await runDiscover(client, config.workspacePattern);

    if (discovery.collisions.length > 0) {
      console.error(`⚠ Workspace name collisions detected. Run \`moat discover\` and resolve before migrating.`);
      process.exit(1);
    }

    console.log(`Found ${discovery.apis.length} APIs (${discovery.gitLinked.length} git-linked, ${discovery.nonGitLinked.length} non-git-linked)\n`);

    if (options.dryRun) {
      console.log('Dry run — no changes made.');
      return;
    }

    const result = await runMigrate(client, discovery.apis, {
      spawnCli,
      checkpointPath: options.checkpoint,
      concurrency: parseInt(options.concurrency, 10),
    });

    console.log(`\nMigration complete.`);
    console.log(`  Completed: ${result.completed.length}`);
    console.log(`  Failed:    ${result.failed.length}`);

    if (result.failed.length > 0) {
      console.log('\nFailed APIs:');
      result.failed.forEach(f => console.log(`  - ${f.id}: ${f.error}`));
    }
  });
