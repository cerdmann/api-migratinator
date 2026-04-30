import type { PostmanClient } from './client.js';

export interface Workspace {
  id: string;
  name: string;
  type: string;
}

interface WorkspacesPage {
  workspaces: Workspace[];
  nextCursor?: string;
}

export async function listAllWorkspaces(client: PostmanClient): Promise<Workspace[]> {
  const all: Workspace[] = [];
  let cursor: string | undefined;

  do {
    const page = await client.get<WorkspacesPage>('/workspaces', cursor ? { cursor } : undefined);
    all.push(...page.workspaces);
    cursor = page.nextCursor;
  } while (cursor);

  return all;
}
