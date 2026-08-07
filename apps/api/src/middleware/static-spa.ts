/**
 * Serves the built SPA, mirroring what nginx does in production.
 *
 * The cache policy is the part that matters and is easy to get wrong:
 *
 *   index.html   no-store. If it is cached, a returning user loads an old HTML
 *                that references /assets/index-<oldhash>.js. After the second
 *                deploy that file no longer exists, and they get a white screen
 *                they cannot fix without a hard refresh.
 *
 *   /assets/*    immutable, one year. Vite fingerprints every filename, so the
 *                content behind a given URL never changes.
 *
 * Any unmatched non-/api path returns index.html so deep links and hard
 * refreshes work — a SPA route like /candidate/profile does not exist on disk.
 *
 * Keep this in step with deploy/nginx.conf.
 *
 * Plan reference: HIGH-9.
 */

import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * CSP for the SPA.
 *
 * Different from the API's policy by necessity:
 *   - connect-src 'self' — the app must be able to call its own API. Without
 *     it, default-src 'none' blocks every fetch.
 *   - style-src needs 'unsafe-inline' because Vite injects a style tag.
 *   - upgrade-insecure-requests is added ONLY under TLS. On a plain-http origin
 *     it rewrites asset URLs to https, nothing is listening, and the page
 *     renders blank with no obvious cause.
 */
function spaCsp(secure: boolean): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (secure) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export function mountStaticSpa(app: Express): void {
  const distDir = env.webDistDir;
  const indexFile = path.join(distDir, 'index.html');

  if (!fs.existsSync(indexFile)) {
    logger.warn(
      { distDir },
      'SERVE_STATIC is on but no built SPA was found. Run `npm run build` first.',
    );
    return;
  }

  app.use(
    '/assets',
    express.static(path.join(distDir, 'assets'), {
      immutable: true,
      maxAge: '1y',
      fallthrough: false,
    }),
  );

  // Other static files (favicon, robots.txt) — modest caching, no fingerprints.
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));

  app.get(/^(?!\/api).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    // Trust the proxy's scheme when there is one; nginx terminates TLS.
    const secure = req.secure || req.get('x-forwarded-proto') === 'https';
    res.setHeader('Content-Security-Policy', spaCsp(secure));
    res.sendFile(indexFile);
  });

  logger.info({ distDir }, 'Serving built SPA (production-style, same origin)');
}
