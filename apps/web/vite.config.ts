import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';

/**
 * Build-time version, compared against GET /api/version at runtime so a user
 * holding a stale bundle after a deploy is prompted to reload rather than
 * hitting 404s on chunks that no longer exist.
 */
function gitSha(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    // stdio ignores stderr so a repo with no commits yet fails quietly.
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Only set for the GitHub Pages workflow (see .github/workflows/deploy-web.yml);
  // every other build (local dev, the existing nginx/prod path) keeps the
  // default "/" and is unaffected.
  base: process.env.VITE_BASE_PATH ?? '/',
  define: {
    __APP_VERSION__: JSON.stringify(gitSha()),
  },
  server: {
    // Bind IPv4 explicitly. Vite's default of "localhost" resolves to ::1 on
    // macOS, and nginx proxies to 127.0.0.1 — so the dev server is reachable
    // directly but 502s through nginx.
    host: '127.0.0.1',
    port: 5173,
    // Without this, a leftover dev server (e.g. an orphaned background
    // process from a previous session) silently pushes a new run onto 5174,
    // 5175, etc. The app still loads fine there — only the API's Origin
    // allowlist (apps/api/src/middleware/csrf.ts, tied to the assumed 5173
    // dev port) doesn't recognise it, so every login fails with a generic
    // "Cross-origin request blocked." with no clue why. Failing to bind is a
    // much clearer signal than that.
    strictPort: true,
    proxy: {
      // Same reasoning as the server.host line above: "localhost" can resolve
      // to ::1 instead of 127.0.0.1 depending on the machine's DNS/hosts
      // resolution order, and the API isn't guaranteed to be reachable on
      // ::1 — which surfaces here as ECONNREFUSED even though the API is
      // running. Targeting the literal IPv4 loopback address sidesteps that
      // resolution step entirely.
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
