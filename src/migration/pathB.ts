import type { PostmanClient } from '../postman/client.js';
import { startSpecMigration, pollMigrationTask } from '../postman/migrations.js';
import type { DiscoveredApi } from './discovery.js';
import { SkipError } from './errors.js';

export interface PathBResult {
  status: 'completed';
  workspaceId?: string;
}

export interface PathBOptions {
  pollIntervalMs?: number;
}

export async function migratePathB(
  client: PostmanClient,
  api: DiscoveredApi,
  options: PathBOptions = {}
): Promise<PathBResult> {
  const { pollIntervalMs = 3000 } = options;

  const schemas = api.schemas ?? [];
  if (schemas.length === 0) {
    throw new SkipError(`API "${api.name}" has no schemas`);
  }

  console.log(`Beginning migration of API ${api.id} to workspace "${api.resolvedWorkspaceName}"`);

  const migrationResult = await startSpecMigration(client, api.id, {
    workspaceInfo: { name: api.resolvedWorkspaceName },
  });

  if (migrationResult.empty) {
    console.log(`Successfully migrated API ${api.id}`);
    return { status: 'completed' };
  }

  const { workspaceId } = await pollMigrationTask(client, api.id, { intervalMs: pollIntervalMs });

  console.log(`Successfully migrated API ${api.id}`);
  return { status: 'completed', workspaceId };
}
