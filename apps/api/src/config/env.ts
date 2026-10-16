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

  /**
   * Write logs to this file instead of stdout.
   *
   * Production leaves this unset — pm2 owns the log files and rotates them.
   * It exists so the privacy suite can grep what the real logger actually
   * emits, with the real redaction configuration, rather than asserting
   * against a second copy of the redact list that could drift.
   */
  LOG_DESTINATION: z.string().optional(),

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

  /**
   * Real email/WhatsApp provider wiring (Amazon SES, Meta Business API per
   * the proposal's tech stack) is not built — see lib/channels.ts. Both
   * default to false, which routes every send through a transport that only
   * logs and never calls a real provider, so the app is always safe to run
   * without credentials. Flipping either to true without first wiring a real
   * transport in lib/channels.ts still never crashes the app — it logs once
   * that delivery is "enabled" with no transport configured, then keeps
   * behaving exactly as if it were false.
   */
  EMAIL_DELIVERY_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  WHATSAPP_DELIVERY_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  /** How often the 24-hour-before interview reminder sweep runs. */
  INTERVIEW_REMINDER_SWEEP_MS: z.coerce.number().int().min(60_000).default(15 * 60_000),
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

/**
 * @public The validated shape of every environment variable the API reads.
 * Exported as the documentation of that contract; `env` itself is what code
 * uses, so nothing imports the type directly.
 */
export type Env = typeof env;
