/**
 * Application errors and the single response shape every failure takes.
 */

import type { ErrorCode, FieldError } from '@bktc/shared';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields: readonly FieldError[] | undefined;
  /** Detail for the server log only — never sent to the client. */
  readonly internal: string | undefined;

  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    options?: { fields?: readonly FieldError[]; internal?: string; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.fields = options?.fields;
    this.internal = options?.internal;
  }
}

export const badRequest = (message: string, fields?: readonly FieldError[]) =>
  new AppError('VALIDATION_FAILED', 400, message, fields ? { fields } : undefined);

export const unauthenticated = (message = 'You need to sign in to do that.') =>
  new AppError('UNAUTHENTICATED', 401, message);

/**
 * Deliberately the same message regardless of whether the resource is missing
 * or merely not yours — distinguishing them leaks existence.
 */
export const forbidden = (message = 'You do not have access to that.') =>
  new AppError('FORBIDDEN', 403, message);

export const notFound = (message = 'Not found.') => new AppError('NOT_FOUND', 404, message);

export const conflict = (message: string) => new AppError('CONFLICT', 409, message);

export const tooLarge = (message = 'That file is too large.') =>
  new AppError('PAYLOAD_TOO_LARGE', 413, message);

export const unsupportedMedia = (message = 'That file type is not accepted.') =>
  new AppError('UNSUPPORTED_MEDIA_TYPE', 415, message);

export const rateLimited = (message = 'Too many attempts. Please try again shortly.') =>
  new AppError('RATE_LIMITED', 429, message);
