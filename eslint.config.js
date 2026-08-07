import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Two rules in this config are architectural enforcement rather than style.
 * Both replace a convention the review judged unenforceable:
 *
 *   1. no-restricted-imports on the db client — keeps every SQL statement
 *      inside src/repositories/, so queries cannot scatter across route
 *      handlers where they are invisible to review.
 *
 *   2. no-restricted-syntax on res.json — forces every response through
 *      sendSerialized(), which combined with the branded Row types in
 *      db/rows.ts makes returning an unserialized database row a type error.
 *      This is what keeps candidate salaries and job salary bands out of
 *      responses written months from now.
 *
 * Plan reference: HIGH-20.
 */

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.config.js',
      '**/coverage/**',
      'packages/shared/dist/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'smart'],
      'no-console': 'off',
    },
  },

  // --- Guard 1: SQL stays in the repository layer --------------------------
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: [
      'apps/api/src/repositories/**',
      'apps/api/src/db/**',
      // Composition root: opens the connection at boot and closes it on
      // SIGTERM. It runs no queries.
      'apps/api/src/index.ts',
      // Health check calls checkDatabase() by design — a health endpoint that
      // does not touch its database is worse than none.
      'apps/api/src/modules/health/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/db/client', '**/db/client.js', '../db/client.js', '../../db/client.js'],
              message:
                'Import the database only inside src/repositories/. Route handlers and services must call a repository function so every SQL statement stays reviewable in one place.',
            },
          ],
        },
      ],
    },
  },

  // --- Guard 2: responses go through a serializer --------------------------
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/lib/respond.ts', 'apps/api/src/middleware/error-handler.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='json'][callee.object.name='res']",
          message:
            'Do not call res.json directly. Use sendSerialized() from lib/respond.js so the response passes through a serializer — this is what keeps private salary and contact fields out of API responses.',
        },
        {
          selector: "CallExpression[callee.property.name='send'][callee.object.name='res']",
          message:
            'Do not call res.send directly. Use sendSerialized() / sendNoContent() from lib/respond.js.',
        },
      ],
    },
  },

  // Plain Node scripts: not TypeScript, and they legitimately use the Node
  // globals that are absent in the browser.
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // pm2 reads its config as CommonJS from disk — it is not part of any build,
  // so it keeps `module.exports` and the Node globals that come with it.
  {
    files: ['deploy/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', process: 'readonly', require: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Tests reach into internals deliberately.
  {
    files: ['apps/api/tests/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
