/**
 * Central error handler.
 *
 * Every failure leaves through here with the same body shape. Unexpected errors
 * are logged in full server-side and reduced to a generic message plus a
 * request ID for the client — never a stack trace, and never err.message, which
 * for better-sqlite3 contains the SQL statement and for zod contains the
 * offending values.
 */

import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { LIMITS, type ApiErrorBody, type FieldError } from '@bktc/shared';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

function zodToFields(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiErrorBody = {
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  };
  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = (req as { id?: string }).id;

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, requestId, internal: err.internal }, 'Application error');
    } else {
      logger.warn({ code: err.code, requestId, internal: err.internal }, err.message);
    }
    const body: ApiErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
        ...(requestId ? { requestId } : {}),
      },
    };
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Some of the details provided are not valid.',
        fields: zodToFields(err),
        ...(requestId ? { requestId } : {}),
      },
    };
    res.status(400).json(body);
    return;
  }

  // Body-parser surfaces its failures as a generic Error carrying a `type`.
  const maybeParserError = err as { type?: string; status?: number };
  if (maybeParserError.type === 'entity.too.large') {
    const body: ApiErrorBody = {
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.', ...(requestId ? { requestId } : {}) },
    };
    res.status(413).json(body);
    return;
  }

  /**
   * A truncated or malformed body is the client's problem, not ours. Without
   * this it falls through to the 500 branch and tells a candidate on a patchy
   * mobile connection that the platform is broken.
   */
  if (maybeParserError.type === 'entity.parse.failed') {
    const body: ApiErrorBody = {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'That request could not be read. Please try again.',
        ...(requestId ? { requestId } : {}),
      },
    };
    res.status(400).json(body);
    return;
  }

  /**
   * Multer aborts the upload stream before the route handler runs, so the
   * handler's own size check is never reached. Each of these was a 500 telling
   * the user "something went wrong on our end" for a file they chose.
   */
  const multerError = err as { name?: string; code?: string };
  if (multerError.name === 'MulterError') {
    const map: Record<string, { status: number; code: ApiErrorBody['error']['code']; message: string }> = {
      LIMIT_FILE_SIZE: {
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: `That file is over ${Math.round(LIMITS.resume.maxBytes / (1024 * 1024))}MB. Try saving your CV as a smaller PDF.`,
      },
      LIMIT_FILE_COUNT: { status: 400, code: 'VALIDATION_FAILED', message: 'Upload one file at a time.' },
      LIMIT_UNEXPECTED_FILE: {
        status: 400,
        code: 'VALIDATION_FAILED',
        message: 'Unexpected file field. Attach the file as "resume".',
      },
    };
    const mapped = map[multerError.code ?? ''] ?? {
      status: 400,
      code: 'VALIDATION_FAILED' as const,
      message: 'That upload could not be processed.',
    };
    logger.warn({ code: multerError.code, requestId }, 'Upload rejected');
    res.status(mapped.status).json({
      error: { code: mapped.code, message: mapped.message, ...(requestId ? { requestId } : {}) },
    } satisfies ApiErrorBody);
    return;
  }

  logger.error({ err, requestId }, 'Unhandled error');
  const body: ApiErrorBody = {
    error: {
      code: 'INTERNAL',
      message: 'Something went wrong on our end. Please try again.',
      ...(requestId ? { requestId } : {}),
    },
  };
  res.status(500).json(body);
};
