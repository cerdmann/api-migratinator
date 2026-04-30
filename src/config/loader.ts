import { configSchema, type Config } from './schema.js';

interface LoadConfigOptions {
  configFile?: Record<string, unknown>;
  cliArgs?: Partial<Config>;
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<Config> {
  const { configFile = {}, cliArgs = {} } = options;

  const merged = {
    ...configFile,
    ...(process.env.POSTMAN_API_KEY ? { postmanApiKey: process.env.POSTMAN_API_KEY } : {}),
    ...(process.env.GIT_TOKEN ? { gitToken: process.env.GIT_TOKEN } : {}),
    ...Object.fromEntries(Object.entries(cliArgs).filter(([, v]) => v !== undefined)),
  };

  const result = configSchema.safeParse(merged);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`);
  }

  return result.data;
}
