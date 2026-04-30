import type { PostmanClient } from './client.js';

export interface SpecMigrationOptions {
  workspaceName: string;
  gitPath: string;
}

export interface TaskResult {
  status: 'completed' | 'pending' | 'failed';
  error?: string;
}

export interface PollOptions {
  intervalMs?: number;
}

export async function startSpecMigration(
  client: PostmanClient,
  apiId: string,
  options: SpecMigrationOptions
): Promise<{ taskId: string }> {
  return client.post(`/apis/${apiId}/spec-migrations`, {
    workspaceInfo: { name: options.workspaceName },
    gitInfo: { path: options.gitPath },
  });
}

export async function pollMigrationTask(
  client: PostmanClient,
  apiId: string,
  taskId: string,
  options: PollOptions = {}
): Promise<TaskResult> {
  const { intervalMs = 3000 } = options;

  while (true) {
    const result = await client.get<TaskResult>(`/apis/${apiId}/tasks/${taskId}`);

    if (result.status === 'failed') {
      throw new Error(result.error ?? 'Migration task failed');
    }

    if (result.status === 'completed') {
      return result;
    }

    if (intervalMs > 0) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
}
