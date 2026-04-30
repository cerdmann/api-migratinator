import type { PostmanClient } from './client.js';

export interface GitInfo {
  domain: string;
  repository: string;
  organization: string;
  schemaFolder: string;
  collectionFolder: string;
  branch: string;
}

export interface ApiBuilderApi {
  id: string;
  name: string;
  uid?: string;
  workspaceId?: string;
  gitInfo?: GitInfo;
}

interface ApisResponse {
  apis: ApiBuilderApi[];
}

interface ApiResponse {
  api: ApiBuilderApi;
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
  const response = await client.get<ApiResponse>(`/apis/${apiId}`, { include: 'gitInfo' });
  return response.api;
}
