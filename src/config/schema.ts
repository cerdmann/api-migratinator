import { z } from 'zod';

export const configSchema = z.object({
  postmanApiKey: z.string().min(1),
  gitToken: z.string().min(1),
  workspacePattern: z.string().default('{workspace} - {spec}'),
});

export type Config = z.infer<typeof configSchema>;
