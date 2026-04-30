import type { PostmanClient } from './client.js';

export interface Schema {
  id: string;
  type: string;
}

export interface SchemaFile {
  path: string;
  content: string;
}

interface SchemasResponse {
  schemas: Schema[];
}

interface SchemaFilesResponse {
  files: SchemaFile[];
}

export async function getSchemas(client: PostmanClient, apiId: string): Promise<Schema[]> {
  const response = await client.get<SchemasResponse>(`/apis/${apiId}/schemas`);
  return response.schemas;
}

export async function getSchemaFiles(
  client: PostmanClient,
  apiId: string,
  schemaId: string
): Promise<SchemaFile[]> {
  const response = await client.get<SchemaFilesResponse>(
    `/apis/${apiId}/schemas/${schemaId}/files`
  );
  return response.files;
}
