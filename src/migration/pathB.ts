import type { PostmanClient } from '../postman/client.js';
import { getSchemas, getSchemaFiles } from '../postman/schemas.js';
import type { DiscoveredApi } from './discovery.js';

export interface PathBResult {
  specId: string;
  workspaceId: string;
}

interface WorkspaceResponse {
  id: string;
  name: string;
}

interface SpecResponse {
  id: string;
}

export async function migratePathB(
  client: PostmanClient,
  api: DiscoveredApi
): Promise<PathBResult> {
  const schemas = await getSchemas(client, api.id);
  if (schemas.length === 0) {
    throw new Error(`API "${api.name}" (${api.id}) has no schemas — cannot migrate via Path B`);
  }

  const schema = schemas[0];
  const files = await getSchemaFiles(client, api.id, schema.id);

  const workspace = await client.post<WorkspaceResponse>('/workspaces', {
    workspace: {
      name: api.resolvedWorkspaceName,
      type: 'team',
      description: `Migrated from API Builder: ${api.name}`,
    },
  });

  const spec = await client.post<SpecResponse>('/specs', {
    workspaceId: workspace.id,
    name: api.name,
    type: schemaTypeToSpecType(schema.type),
    files,
  });

  return { specId: spec.id, workspaceId: workspace.id };
}

function schemaTypeToSpecType(schemaType: string): string {
  const map: Record<string, string> = {
    'openapi:3_1': 'OPENAPI:3.1',
    'openapi:3':   'OPENAPI:3.0',
    'openapi:2':   'OPENAPI:2.0',
    'asyncapi:2':  'ASYNCAPI:2.0',
    'proto:2':     'PROTOBUF:2',
    'proto:3':     'PROTOBUF:3',
    'graphql':     'GRAPHQL',
  };
  return map[schemaType] ?? 'OPENAPI:3.0';
}
