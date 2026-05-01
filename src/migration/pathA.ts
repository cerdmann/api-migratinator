import type { PostmanClient } from '../postman/client.js';
import { startSpecMigration, pollMigrationTask, validateGitPath, type TaskResult } from '../postman/migrations.js';
import type { DiscoveredApi } from './discover.js';

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

  const gitPath = api.gitInfo?.schemaFolder ?? '/';
  validateGitPath(gitPath);

  const migrationResult = await startSpecMigration(client, api.id, {
    workspaceInfo: { name: api.resolvedWorkspaceName },
    gitInfo: { path: gitPath },
  });

  if (migrationResult.empty) {
    return { status: 'completed', taskResult: { status: 'completed' } };
  }

  const taskResult = await pollMigrationTask(client, api.id, {
    intervalMs: pollIntervalMs,
  });

  await spawnCli(['workspace', 'push', '--yes']);

  return { status: 'completed', taskResult };
}
