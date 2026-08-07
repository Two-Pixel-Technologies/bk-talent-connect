/**
 * pm2 process definitions: production and staging on the same droplet.
 *
 * Staging is a second pm2 process on :4001 with its own database and its own
 * nginx server block, restored nightly from production's backup. Marginal
 * cost: zero. It is the only place a migration is ever rehearsed against real
 * data, and restoring into it IS the restore test.
 *
 *   pm2 start deploy/ecosystem.config.cjs --only bktc-api
 *   pm2 start deploy/ecosystem.config.cjs --only bktc-staging-api
 *   pm2 save && pm2 startup      # survive a reboot
 *
 * Plan reference: HIGH-8, MEDIUM-8, BLOCKER-4.
 */

// Pinned to match .nvmrc. A pm2 process inheriting whichever Node happens to
// be on the shell's PATH is how a native-addon ABI mismatch appears months
// after everything worked.
const NODE_VERSION = '22';

const common = {
  script: 'api/index.js',
  // One instance. SQLite is a single-writer database; a second process would
  // spend its life on SQLITE_BUSY, and there is no session store to share.
  instances: 1,
  exec_mode: 'fork',
  interpreter_args: '',
  interpreter: `${process.env.HOME}/.nvm/versions/node/v${NODE_VERSION}/bin/node`,

  // SIGTERM triggers server.close() + db.close(). The window has to be long
  // enough for an in-flight 5MB upload to finish rather than be truncated.
  kill_timeout: 10_000,
  wait_ready: false,
  listen_timeout: 10_000,

  max_restarts: 10,
  min_uptime: '30s',
  // A 1GB droplet: restart before the OOM killer picks the process itself.
  max_memory_restart: '400M',

  merge_logs: true,
  time: true,
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'bktc-api',
      cwd: '/var/www/bktc/current',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        DATABASE_PATH: '/var/www/bktc/shared/data/bktc.db',
        UPLOADS_DIR: '/var/www/bktc/shared/uploads',
        TMP_DIR: '/var/www/bktc/shared/tmp',
        APP_ORIGIN: 'https://bktalentconnect.com',
        TRUST_PROXY_HOPS: 1,
        LOG_LEVEL: 'info',
      },
      error_file: '/var/log/bktc/api-error.log',
      out_file: '/var/log/bktc/api-out.log',
    },
    {
      ...common,
      name: 'bktc-staging-api',
      cwd: '/var/www/bktc-staging/current',
      env: {
        NODE_ENV: 'production',
        PORT: 4001,
        DATABASE_PATH: '/var/www/bktc-staging/shared/data/bktc.db',
        UPLOADS_DIR: '/var/www/bktc-staging/shared/uploads',
        TMP_DIR: '/var/www/bktc-staging/shared/tmp',
        APP_ORIGIN: 'https://staging.bktalentconnect.com',
        TRUST_PROXY_HOPS: 1,
        LOG_LEVEL: 'debug',
      },
      error_file: '/var/log/bktc/staging-error.log',
      out_file: '/var/log/bktc/staging-out.log',
    },
  ],
};

/*
 * Log rotation is not optional, and pm2 does not do it by default:
 *
 *   pm2 install pm2-logrotate
 *   pm2 set pm2-logrotate:max_size 10M
 *   pm2 set pm2-logrotate:retain 7
 *   pm2 set pm2-logrotate:compress true
 *
 * Unbounded pm2 logs filling a 25GB disk until every SQLite write returns
 * SQLITE_FULL is the most likely year-one outage on this box.
 */
