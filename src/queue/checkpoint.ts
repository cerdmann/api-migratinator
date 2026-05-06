import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

interface FailedEntry {
  id: string;
  error: string;
}

interface SkippedEntry {
  id: string;
  reason: string;
}

interface CheckpointData {
  pending: string[];
  completed: string[];
  failed: FailedEntry[];
  skipped: SkippedEntry[];
}

export interface Progress {
  total: number;
  pending: number;
  completed: number;
  failed: number;
}

export class Checkpoint {
  private path: string;
  private data: CheckpointData = { pending: [], completed: [], failed: [], skipped: [] };

  constructor(path: string) {
    this.path = path;
  }

  async init(apiIds: string[]): Promise<void> {
    this.data = { pending: [...apiIds], completed: [], failed: [], skipped: [] };
    await this.persist();
  }

  async load(): Promise<void> {
    if (!existsSync(this.path)) throw new Error(`Checkpoint not found: ${this.path}`);
    const raw = await readFile(this.path, 'utf-8');
    this.data = JSON.parse(raw);
  }

  async markCompleted(id: string): Promise<void> {
    this.data.pending = this.data.pending.filter(p => p !== id);
    if (!this.data.completed.includes(id)) this.data.completed.push(id);
    await this.persist();
  }

  async markFailed(id: string, error: string): Promise<void> {
    this.data.pending = this.data.pending.filter(p => p !== id);
    this.data.failed.push({ id, error });
    await this.persist();
  }

  async requeueFailed(): Promise<void> {
    const failedIds = this.data.failed.map(f => f.id);
    this.data.failed = [];
    this.data.pending.push(...failedIds);
    await this.persist();
  }

  async getPending(): Promise<string[]> {
    return [...this.data.pending];
  }

  async getCompleted(): Promise<string[]> {
    return [...this.data.completed];
  }

  async getFailed(): Promise<FailedEntry[]> {
    return [...this.data.failed];
  }

  async markSkipped(id: string, reason: string): Promise<void> {
    this.data.pending = this.data.pending.filter(p => p !== id);
    this.data.skipped.push({ id, reason });
    await this.persist();
  }

  async getSkipped(): Promise<SkippedEntry[]> {
    return [...(this.data.skipped ?? [])];
  }

  async getProgress(): Promise<Progress> {
    const total = this.data.pending.length + this.data.completed.length + this.data.failed.length;
    return {
      total,
      pending: this.data.pending.length,
      completed: this.data.completed.length,
      failed: this.data.failed.length,
    };
  }

  private async persist(): Promise<void> {
    await writeFile(this.path, JSON.stringify(this.data, null, 2), 'utf-8');
  }
}
