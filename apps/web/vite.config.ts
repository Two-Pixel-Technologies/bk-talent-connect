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
  define: {
    __APP_VERSION__: JSON.stringify(gitSha()),
  },
  server: {
    // Bind IPv4 explicitly. Vite's default of "localhost" resolves to ::1 on
    // macOS, and nginx proxies to 127.0.0.1 — so the dev server is reachable
    // directly but 502s through nginx.
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
