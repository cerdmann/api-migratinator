import PQueue from 'p-queue';
import { Checkpoint } from '../queue/checkpoint.js';
import { migratePathA, type PathAOptions } from './pathA.js';
import { migratePathB } from './pathB.js';
import type { PostmanClient } from '../postman/client.js';
import type { DiscoveredApi } from './discovery.js';
import { existsSync } from 'fs';

export interface MigrateOptions {
  spawnCli: PathAOptions['spawnCli'];
  checkpointPath: string;
  concurrency?: number;
  pollIntervalMs?: number;
}

export interface MigrateResult {
  completed: string[];
  failed: { id: string; error: string }[];
}

export async function runMigrate(
  client: PostmanClient,
  apis: DiscoveredApi[],
  options: MigrateOptions
): Promise<MigrateResult> {
  const { spawnCli, checkpointPath, concurrency = 5, pollIntervalMs = 3000 } = options;

  const checkpoint = new Checkpoint(checkpointPath);

  if (existsSync(checkpointPath)) {
    await checkpoint.load();
  } else {
    await checkpoint.init(apis.map(a => a.id));
  }

  const pending = await checkpoint.getPending();
  const pendingApis = apis.filter(a => pending.includes(a.id));

  const queue = new PQueue({ concurrency });

  for (const api of pendingApis) {
    queue.add(async () => {
      try {
        if (api.gitInfo) {
          await migratePathA(client, api, { spawnCli, pollIntervalMs });
        } else {
          await migratePathB(client, api);
        }
        await checkpoint.markCompleted(api.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await checkpoint.markFailed(api.id, message);
      }
    });
  }

  await queue.onIdle();

  return {
    completed: await checkpoint.getCompleted(),
    failed: await checkpoint.getFailed(),
  };
}
