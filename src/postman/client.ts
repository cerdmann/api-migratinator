import axios, { type AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import PQueue from 'p-queue';

const BASE_URL = 'https://api.getpostman.com';

const GENERAL_INTERVAL_MS = 60_000;
const GENERAL_CONCURRENCY = 300;
const WORKSPACE_INTERVAL_MS = 10_000;
const WORKSPACE_CONCURRENCY = 10;

const WORKSPACE_PATH_RE = /^\/workspaces/;

export interface PostmanClient {
  get: <T>(path: string, params?: Record<string, string>) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
  getDefaultHeaders: () => Record<string, string>;
  getRateLimiterType: (method: string, path: string) => 'general' | 'workspace';
}

export function createPostmanClient({ apiKey }: { apiKey: string }): PostmanClient {
  const headers = { 'X-API-Key': apiKey, 'Accept': 'application/json' };

  const instance: AxiosInstance = axios.create({ baseURL: BASE_URL, headers });
  axiosRetry(instance, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (err) =>
      axiosRetry.isNetworkError(err) ||
      (err.response?.status === 429) ||
      (err.response?.status !== undefined && err.response.status >= 500),
  });

  const generalQueue = new PQueue({ intervalCap: GENERAL_CONCURRENCY, interval: GENERAL_INTERVAL_MS });
  const workspaceQueue = new PQueue({ intervalCap: WORKSPACE_CONCURRENCY, interval: WORKSPACE_INTERVAL_MS });

  function getRateLimiterType(_method: string, path: string): 'general' | 'workspace' {
    return WORKSPACE_PATH_RE.test(path) ? 'workspace' : 'general';
  }

  function queue<T>(path: string, fn: () => Promise<T>): Promise<T> {
    const q = getRateLimiterType('', path) === 'workspace' ? workspaceQueue : generalQueue;
    return q.add(fn) as Promise<T>;
  }

  return {
    get: <T>(path: string, params?: Record<string, string>) =>
      queue(path, () => instance.get<T>(path, { params }).then(r => r.data)),

    post: <T>(path: string, body?: unknown) =>
      queue(path, () => instance.post<T>(path, body).then(r => r.data)),

    put: <T>(path: string, body?: unknown) =>
      queue(path, () => instance.put<T>(path, body).then(r => r.data)),

    delete: <T>(path: string) =>
      queue(path, () => instance.delete<T>(path).then(r => r.data)),

    getDefaultHeaders: () => ({ ...headers }),
    getRateLimiterType,
  };
}
