// Low-level HTTP core. Single place that knows about base URL, auth header,
// error envelope (§1) and idempotency keys.
import type { ApiError } from './types';

const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000/api/v1';

const TOKEN_KEY = 'organikally.admin.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class HttpError extends Error {
  status: number;
  detail: ApiError['detail'];
  constructor(status: number, detail: ApiError['detail']) {
    super(typeof detail === 'string' ? detail : 'Request failed');
    this.status = status;
    this.detail = detail;
    this.name = 'HttpError';
  }
}

// Subscribers notified on 401 so the app can force-logout.
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  onUnauthorized = fn;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** multipart form (media upload) */
  form?: FormData;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(API_BASE.replace(/\/$/, '') + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  let payload: BodyInit | undefined;
  if (opts.form) {
    payload = opts.form;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body: payload,
      signal: opts.signal,
    });
  } catch (e) {
    throw new HttpError(0, `Network error: ${(e as Error).message}`);
  }

  if (res.status === 401) {
    onUnauthorized?.();
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const detail =
      (data as ApiError | undefined)?.detail ?? res.statusText ?? 'Request failed';
    throw new HttpError(res.status, detail);
  }

  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export { API_BASE };
