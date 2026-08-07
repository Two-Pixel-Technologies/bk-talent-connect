/**
 * Wraps an async route handler so a rejection reaches the error middleware.
 *
 * Express 4 does not await handlers, so an async function that throws produces
 * an unhandled promise rejection and a request that hangs until it times out —
 * no 500, no log line, nothing in the response. Every async route must go
 * through this.
 *
 * Previously a private helper inside auth.routes.ts; moved here the moment a
 * second module needed it, rather than copied.
 */

import type { NextFunction, Request, Response } from 'express';

export function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}
