import type { PostmanClient } from '../postman/client.js';
import { listAllWorkspaces, type Workspace } from '../postman/workspaces.js';
import { listApisForWorkspace, getApiWithGitInfo, type ApiBuilderApi } from '../postman/apis.js';
import { resolveWorkspaceName, checkCollisions, type NameTokens } from './naming.js';

export interface DiscoveredApi extends ApiBuilderApi {
  workspaceId: string;
  workspaceName: string;
  resolvedWorkspaceName: string;
}

export interface DiscoveryResult {
  workspaces: Workspace[];
  apis: DiscoveredApi[];
  gitLinked: DiscoveredApi[];
  nonGitLinked: DiscoveredApi[];
  collisions: string[];
}

export async function runDiscover(
  client: PostmanClient,
  workspacePattern: string
): Promise<DiscoveryResult> {
  const workspaces = await listAllWorkspaces(client);

  const apis: DiscoveredApi[] = [];

  await Promise.all(
    workspaces.map(async (ws) => {
      const found = await listApisForWorkspace(client, ws.id);
      await Promise.all(
        found.map(async (api) => {
          const full = await getApiWithGitInfo(client, api.id);
          const tokens: NameTokens = {
            workspace: ws.name,
            spec: full.name,
            repo: full.gitInfo?.repository ?? '',
            org: full.gitInfo?.organization ?? '',
            branch: full.gitInfo?.branch ?? '',
          };
          apis.push({
            ...full,
            workspaceId: ws.id,
            workspaceName: ws.name,
            resolvedWorkspaceName: resolveWorkspaceName(workspacePattern, tokens),
          });
        })
      );
    })
  );

  const gitLinked = apis.filter(a => a.gitInfo !== undefined);
  const nonGitLinked = apis.filter(a => a.gitInfo === undefined);
  const collisions = checkCollisions(apis.map(a => a.resolvedWorkspaceName));

  return { workspaces, apis, gitLinked, nonGitLinked, collisions };
}
