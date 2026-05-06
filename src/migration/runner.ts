import PQueue from 'p-queue';
import { Checkpoint } from '../queue/checkpoint.js';
import { migratePathA, type PathAOptions } from './pathA.js';
import { migratePathB } from './pathB.js';
import { SkipError } from './errors.js';
import type { PostmanClient } from '../postman/client.js';
import type { DiscoveredApi } from './discovery.js';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';

export interface MigrateOptions {
  spawnCli: PathAOptions['spawnCli'];
  checkpointPath: string;
  workspaceLogPath?: string;
  concurrency?: number;
  pollIntervalMs?: number;
}

export interface MigrateResult {
  completed: string[];
  failed: { id: string; error: string }[];
  skipped: { id: string; reason: string }[];
}

export async function runMigrate(
  client: PostmanClient,
  apis: DiscoveredApi[],
  options: MigrateOptions
): Promise<MigrateResult> {
  const { spawnCli, checkpointPath, workspaceLogPath = '.moat-workspaces.json', concurrency = 5, pollIntervalMs = 3000 } = options;

  const checkpoint = new Checkpoint(checkpointPath);

  if (existsSync(checkpointPath)) {
    await checkpoint.load();
    await checkpoint.requeueFailed();
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
          const result = await migratePathB(client, api, { pollIntervalMs });
          if (result.workspaceId) {
            await appendWorkspaceLog(workspaceLogPath, {
              workspaceId: result.workspaceId,
              workspaceName: api.resolvedWorkspaceName,
              apiId: api.id,
            });
          }
        }
        await checkpoint.markCompleted(api.id);
      } catch (err) {
        if (err instanceof SkipError) {
          await checkpoint.markSkipped(api.id, err.message);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          await checkpoint.markFailed(api.id, message);
        }
      }
    });
  }

  await queue.onIdle();


  return {
    completed: await checkpoint.getCompleted(),
    failed: await checkpoint.getFailed(),
    skipped: await checkpoint.getSkipped(),
  };
}

interface WorkspaceLogEntry {
  workspaceId: string;
  workspaceName: string;
  apiId: string;
}

async function appendWorkspaceLog(path: string, entry: WorkspaceLogEntry): Promise<void> {
  let entries: WorkspaceLogEntry[] = [];
  try {
    entries = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    // file doesn't exist yet
  }
  entries.push(entry);
  await writeFile(path, JSON.stringify(entries, null, 2));
}
