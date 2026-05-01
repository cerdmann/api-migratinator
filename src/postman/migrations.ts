import type { PostmanClient } from './client.js';

const MIGRATION_ACCEPT = { Accept: 'application/vnd.api.v10+json' };

export type SpecMigrationBody =
  | { workspaceId: string }
  | { workspaceInfo: { name: string }; gitInfo?: { path: string } };

export interface SpecMigrationResult {
  started: boolean;
  empty: boolean;
  message: string;
}

export interface TaskResult {
  status: 'completed' | 'pending' | 'failed';
  error?: string;
}

export interface PollOptions {
  intervalMs?: number;
}

export function validateGitPath(path: string): void {
  if (!path.startsWith('/')) {
    throw new Error('gitInfo.path must be an absolute path starting with /');
  }
  if (path.includes('..')) {
    throw new Error('gitInfo.path must not contain path traversal sequences (..)');
  }
  if (!/^[a-zA-Z0-9/_\-.]+$/.test(path)) {
    throw new Error('gitInfo.path contains invalid characters (only alphanumeric, /, -, _, . allowed)');
  }
}

export async function startSpecMigration(
  client: PostmanClient,
  apiId: string,
  body: SpecMigrationBody
): Promise<SpecMigrationResult> {
  let response: { message: string; success: boolean };
  try {
    response = await client.post(
      `/apis/${apiId}/spec-migrations`,
      body,
      MIGRATION_ACCEPT
    );
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: { error?: { title?: string; message?: string } } } };
    const errMsg = axiosErr.response?.data?.error?.message ?? axiosErr.response?.data?.error?.title ?? (err instanceof Error ? err.message : String(err));
    if (errMsg.toLowerCase().includes('unsupported definition type') || errMsg.toLowerCase().includes('unsupported')) {
      throw new Error(`Migration failed: unsupported definition type — ${errMsg}`);
    }
    if (errMsg.toLowerCase().includes('already linked to another workspace')) {
      throw new Error(`Migration failed: git repository is already linked to another workspace`);
    }
    throw err;
  }

  const empty = response.message.includes("doesn't have any API Definition");
  const started = !empty && response.message.includes('started successfully');

  return { started, empty, message: response.message };
}

export async function pollMigrationTask(
  client: PostmanClient,
  apiId: string,
  options: PollOptions = {}
): Promise<TaskResult> {
  const { intervalMs = 3000 } = options;

  while (true) {
    const result = await client.get<{ status: string; error?: string }>(
      `/apis/${apiId}/spec-migrations`,
      undefined,
      MIGRATION_ACCEPT
    );

    const { status, error } = result;

    if (status === 'failed' || status === 'error') {
      throw new Error(error ?? `Migration ${status}`);
    }

    if (status === 'completed' || status === 'success') {
      return { status: 'completed' };
    }

    if (intervalMs > 0) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
}
