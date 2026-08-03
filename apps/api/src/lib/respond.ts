/**
 * The only sanctioned way to send a JSON body.
 *
 * An ESLint rule bans bare `res.json(...)` everywhere except this file, so
 * every response has to pass through here — and because branded Row types
 * cannot satisfy these signatures, the compiler forces a serializer call in
 * between. That combination is what keeps candidate salaries and job salary
 * bands out of responses even in code written months from now.
 *
 * Plan reference: HIGH-20.
 */

import type { Response } from 'express';
import type { Page } from '@bktc/shared';

/** A value safe to serialise: no branded row types anywhere in the tree. */
export type Serialized =
  | null
  | boolean
  | number
  | string
  | readonly Serialized[]
  | { readonly [key: string]: Serialized | undefined };

export function sendSerialized<T extends Serialized>(res: Response, body: T, status = 200): void {
  // The single sanctioned res.json call in the codebase. This file is the only
  // exemption from the no-restricted-syntax rule that bans it everywhere else.
  res.status(status).json(body);
}

export function sendCreated<T extends Serialized>(res: Response, body: T): void {
  sendSerialized(res, body, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}

export function sendPage<T extends Serialized>(res: Response, page: Page<T>): void {
  sendSerialized(res, page as unknown as Serialized);
}

export function buildPage<T>(items: readonly T[], page: number, pageSize: number, total: number): Page<T> {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}
