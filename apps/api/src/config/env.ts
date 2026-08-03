/**
 * Environment configuration.
 *
 * Validated with zod at import time so a missing or malformed variable is a
 * clear startup failure rather than an undefined that surfaces as a runtime
 * crash three screens deep.
 */

import { z } from 'zod';
import path from 'node:path';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  /** SQLite file. Lives in shared/ on the droplet, never inside a release dir. */
  DATABASE_PATH: z.string().min(1).default('./data/bktc.db'),

  /** Resume storage. Must be outside the web root — files are served only via an authorised route. */
  UPLOADS_DIR: z.string().min(1).default('./uploads'),

  /** Where multer writes before the FileAsset row exists; same filesystem as UPLOADS_DIR so rename() is atomic. */
  TMP_DIR: z.string().min(1).default('./tmp'),

  /** Origin allowed to make state-changing requests. Same-origin in production. */
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),

  /** Injected at build time; echoed by /api/version so the SPA can detect version skew. */
  APP_VERSION: z.string().default('dev'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Number of proxy hops to trust. Exactly 1 behind nginx. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),

  /** Seed credentials for the first admin. Only read by scripts/admin-create.ts. */
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(10).optional(),

  /**
   * Serve the built SPA from this process.
   *
   * In production nginx does this and proxies /api here. Enabling it locally
   * reproduces the thing that actually matters about that arrangement — the SPA
   * and the API on ONE origin — so cookies, the CSRF Origin check, deep links
   * and cache headers all behave the way they will on the server.
   */
  SERVE_STATIC: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  WEB_DIST_DIR: z.string().default('../web/dist'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // Deliberately console.error rather than the logger: the logger needs config.
  console.error(`Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  databasePath: path.resolve(raw.DATABASE_PATH),
  uploadsDir: path.resolve(raw.UPLOADS_DIR),
  tmpDir: path.resolve(raw.TMP_DIR),
  webDistDir: path.resolve(raw.WEB_DIST_DIR),
} as const;

export type Env = typeof env;
