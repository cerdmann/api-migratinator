import type { PostmanClient } from '../postman/client.js';
import { startSpecMigration, pollMigrationTask, validateGitPath, type TaskResult } from '../postman/migrations.js';
import type { DiscoveredApi } from './discovery.js';

export interface PathAOptions {
  spawnCli: (args: string[]) => Promise<void>;
  pollIntervalMs?: number;
}

export interface PathAResult {
  status: 'completed';
  taskResult: TaskResult;
}

export async function migratePathA(
  client: PostmanClient,
  api: DiscoveredApi,
  options: PathAOptions
): Promise<PathAResult> {
  const { spawnCli, pollIntervalMs = 3000 } = options;

  const gitPath = api.gitInfo?.schemaFolder || '/';
  validateGitPath(gitPath);

  console.log(`Beginning migration of API ${api.id} to workspace "${api.resolvedWorkspaceName}"`);

  const migrationResult = await startSpecMigration(client, api.id, {
    workspaceInfo: { name: api.resolvedWorkspaceName },
    gitInfo: { path: gitPath },
  });

  if (migrationResult.empty) {
    console.log(`Successfully migrated API ${api.id}`);
    return { status: 'completed', taskResult: { status: 'completed' } };
  }

  const taskResult = await pollMigrationTask(client, api.id, {
    intervalMs: pollIntervalMs,
  });

  await spawnCli(['workspace', 'push', '--yes']);

  console.log(`Successfully migrated API ${api.id}`);
  return { status: 'completed', taskResult };
}
