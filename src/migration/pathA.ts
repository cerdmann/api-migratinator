import type { PostmanClient } from '../postman/client.js';
import { startSpecMigration, pollMigrationTask, type TaskResult } from '../postman/migrations.js';
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

  const { taskId } = await startSpecMigration(client, api.id, {
    workspaceName: api.resolvedWorkspaceName,
    gitPath: api.gitInfo!.schemaFolder,
  });

  const taskResult = await pollMigrationTask(client, api.id, taskId, {
    intervalMs: pollIntervalMs,
  });

  await spawnCli(['workspace', 'push', '--yes']);

  return { status: 'completed', taskResult };
}
