/**
 * The single HTTP entry point for the SPA.
 *
 * Responsibilities beyond fetch():
 *   - always sends cookies (session auth is httpOnly, not a bearer token)
 *   - sends X-Requested-With, which the server requires on state-changing
 *     methods as a CSRF control alongside the Origin check
 *   - normalises every error into ApiError so callers never parse a body
 *   - detects version skew from the X-App-Version response header
 */

import type { ApiErrorBody, ErrorCode, FieldError } from '@bktc/shared';

declare const __APP_VERSION__: string;

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields: readonly FieldError[];
  readonly requestId: string | undefined;

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.fields = body.fields ?? [];
    this.requestId = body.requestId;
  }

  /** Message for a specific form field, if the server flagged one. */
  fieldError(path: string): string | undefined {
    return this.fields.find((f) => f.path === path)?.message;
  }
}

type Listener = (staleVersion: string, freshVersion: string) => void;
const versionListeners = new Set<Listener>();

/** Notifies when the server reports a build newer than the loaded bundle. */
export function onVersionSkew(listener: Listener): () => void {
  versionListeners.add(listener);
  return () => versionListeners.delete(listener);
}

function checkVersion(response: Response): void {
  const serverVersion = response.headers.get('X-App-Version');
  if (!serverVersion || serverVersion === 'dev') return;
  if (serverVersion !== __APP_VERSION__) {
    for (const listener of versionListeners) listener(__APP_VERSION__, serverVersion);
  }
}

const UNSAFE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export interface RequestOptions {
  readonly method?: string;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  /** FormData for multipart uploads; skips JSON encoding. */
  readonly formData?: FormData;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};

  if (UNSAFE_METHODS.has(method)) {
    headers['X-Requested-With'] = 'XMLHttpRequest';
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  // Properties are spread in conditionally rather than set to undefined:
  // exactOptionalPropertyTypes distinguishes "absent" from "explicitly
  // undefined", and RequestInit does not accept the latter.
  const init: RequestInit = {
    method,
    headers,
    credentials: 'same-origin',
    ...(body !== undefined ? { body } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };

  const response = await fetch(`/api${path}`, init);

  checkVersion(response);

  if (response.status === 204) return undefined as T;

  const isJson = response.headers.get('Content-Type')?.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const parsed = (await response.json()) as ApiErrorBody;
      throw new ApiError(response.status, parsed.error);
    }
    throw new ApiError(response.status, {
      code: 'INTERNAL',
      message: `Request failed (${response.status})`,
    });
  }

  return isJson ? ((await response.json()) as T) : (undefined as T);
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, signal ? { signal } : {}),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', formData }),
};

export const APP_VERSION = __APP_VERSION__;
