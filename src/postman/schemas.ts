import type { PostmanClient } from './client.js';

export interface SchemaFile {
  path: string;
  content: string;
}

interface FileListingEntry {
  path: string;
}

interface FileListingResponse {
  files: FileListingEntry[];
}

interface FileContentResponse {
  path: string;
  content: string;
}

const SCHEMA_ACCEPT = { Accept: 'application/vnd.api.v10+json' };

export async function getSchemaFiles(
  client: PostmanClient,
  apiId: string,
  schemaId: string
): Promise<SchemaFile[]> {
  const listing = await client.get<FileListingResponse>(
    `/apis/${apiId}/schemas/${schemaId}/files`,
    undefined,
    SCHEMA_ACCEPT
  );

  if (!listing.files || listing.files.length === 0) return [];

  return Promise.all(
    listing.files.map(async (file) => {
      const content = await client.get<FileContentResponse>(
        `/apis/${apiId}/schemas/${schemaId}/files/${file.path}`,
        undefined,
        SCHEMA_ACCEPT
      );
      return { path: file.path, content: content.content };
    })
  );
}
