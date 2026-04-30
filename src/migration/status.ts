import { readFile } from 'fs/promises';

interface CheckpointData {
  pending: string[];
  completed: string[];
  failed: { id: string; error: string }[];
}

export interface StatusResult {
  total: number;
  pending: number;
  completed: number;
  failed: number;
  percentComplete: number;
  isComplete: boolean;
  failures: { id: string; error: string }[];
}

export async function getStatus(checkpointPath: string): Promise<StatusResult> {
  const raw = await readFile(checkpointPath, 'utf-8');
  const data: CheckpointData = JSON.parse(raw);

  const total = data.pending.length + data.completed.length + data.failed.length;
  const done = data.completed.length + data.failed.length;
  const percentComplete = total === 0 ? 100 : Math.round((done / total) * 100);
  const isComplete = data.pending.length === 0;

  return {
    total,
    pending: data.pending.length,
    completed: data.completed.length,
    failed: data.failed.length,
    percentComplete,
    isComplete,
    failures: data.failed,
  };
}
