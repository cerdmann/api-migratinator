import type { PostmanClient } from './client.js';

export interface GitInfo {
  domain: string | null;
  repository: string;
  organization: string;
  schemaFolder: string;
  collectionFolder: string;
  branch?: string;
}

export interface ApiSchema {
  id: string;
  type: string;
}

export interface ApiBuilderApi {
  id: string;
  name: string;
  uid?: string;
  workspaceId?: string;
  gitInfo?: GitInfo;
  schemas?: ApiSchema[];
}

interface ApisResponse {
  apis: ApiBuilderApi[];
}

export async function listApisForWorkspace(
  client: PostmanClient,
  workspaceId: string
): Promise<ApiBuilderApi[]> {
  const response = await client.get<ApisResponse>('/apis', { workspaceId });
  return response.apis;
}

export async function getApiWithGitInfo(
  client: PostmanClient,
  apiId: string
): Promise<ApiBuilderApi> {
  const response = await client.get<ApiBuilderApi>(
    `/apis/${apiId}?include=schemas,collections,versions,gitInfo`,
    undefined,
    { Accept: 'application/vnd.api.v10+json' }
  );
  if (process.env.MOAT_DEBUG) console.error('[debug] getApiWithGitInfo', JSON.stringify(response, null, 2));
  if (Array.isArray(response.gitInfo)) {
    response.gitInfo = undefined;
  }
  return response;
}
