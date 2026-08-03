#!/usr/bin/env node
/**
 * Runs the built app locally the way it runs on the server.
 *
 * NODE_ENV=production, the compiled API, and the built SPA served from the same
 * origin on one port. That last part is the point: on the droplet, nginx serves
 * the static files and proxies /api to this process, so everything is one
 * origin. Reproducing that locally is what makes cookies, the CSRF Origin
 * check, deep links and cache headers behave here the way they will there.
 *
 * The differences that remain, and are covered by nginx in production: TLS,
 * gzip, and the reverse proxy hop itself (hence TRUST_PROXY_HOPS=0 here).
 *
 *   npm run start:prod
 */

import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const apiEntry = path.join(root, 'apps/api/dist/index.js');
const webDist = path.join(root, 'apps/web/dist');

if (!fs.existsSync(apiEntry)) {
  console.error('Built API not found. Run `npm run build` first.');
  process.exit(1);
}
if (!fs.existsSync(path.join(webDist, 'index.html'))) {
  console.error('Built SPA not found. Run `npm run build` first.');
  process.exit(1);
}

let version = 'local';
try {
  version = execSync('git rev-parse --short HEAD', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  // No commits yet.
}

const port = process.env.PORT ?? '4000';
const dataDir = path.join(root, 'apps/api/data');

const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: port,
  SERVE_STATIC: 'true',
  WEB_DIST_DIR: webDist,
  DATABASE_PATH: path.join(dataDir, 'bktc.db'),
  UPLOADS_DIR: path.join(root, 'apps/api/uploads'),
  TMP_DIR: path.join(root, 'apps/api/tmp'),
  APP_ORIGIN: `http://localhost:${port}`,
  APP_VERSION: version,
  // Direct, no reverse proxy in front. On the droplet this is 1 (nginx).
  TRUST_PROXY_HOPS: '0',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
};

console.log('');
console.log('  BK Talent Connect — production mode');
console.log('  ─────────────────────────────────────────────');
console.log(`  App          http://localhost:${port}`);
console.log(`  Health       http://localhost:${port}/api/health`);
console.log(`  Build board  http://localhost:${port}/status`);
console.log(`  Version      ${version}`);
console.log('');

const child = spawn(process.execPath, [apiEntry], { env, stdio: 'inherit' });

// Forward signals so Ctrl-C exercises the same graceful shutdown path a deploy
// uses — that is the code that keeps an in-flight CV upload from being killed
// mid-write.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code) => process.exit(code ?? 0));
