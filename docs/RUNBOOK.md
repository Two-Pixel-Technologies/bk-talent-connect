# BK Talent Connect — Runbook

Operational procedures for bktalentconnect.com. Written for whoever is holding
the pager, which during the support year is Takai Labs, and after it may not be.

Everything here has been executed at least once. Where a procedure has only
been rehearsed locally rather than against the droplet, it says so.

---

## Layout

```
/var/www/bktc/
├── releases/<sha>/          web/ api/ node_modules/ deploy/ VERSION
├── current -> releases/<sha>    the atomic switch; flipping it back is the rollback
├── shared/                      NEVER inside a release
│   ├── data/bktc.db             the database
│   ├── uploads/                 every CV
│   ├── tmp/                     staged uploads mid-request
│   └── .env                     secrets
└── backups/                     local copies; the real ones are off-droplet

/var/www/bktc-staging/       same shape, port 4001, restored nightly from prod
/var/log/bktc/               pm2 logs, rotated by pm2-logrotate
```

Processes: `bktc-api` on :4000, `bktc-staging-api` on :4001, both under pm2,
both defined in `deploy/ecosystem.config.cjs`.

---

## Deploying

**Never build on the droplet.** `tsc` across three workspaces plus a Vite build
of React 19 peaks over 1GB, and the box has 1GB with a 2GB swapfile. Build
locally or in Actions and ship `dist/`.

**`node_modules` is never shipped.** `better-sqlite3` is a native addon; an
Apple Silicon `.node` binary will not load on Ubuntu x86_64. `deploy.sh` runs
`npm ci --omit=dev` on target and then proves the binding loads.

```bash
# local
npm ci && npm run lint && npm run typecheck && npm test && npm run build

SHA=$(git rev-parse --short HEAD)
rsync -az --delete \
  apps/web/dist/       droplet:/var/www/bktc/releases/$SHA/web/
rsync -az --delete \
  apps/api/dist/       droplet:/var/www/bktc/releases/$SHA/api/
rsync -az package.json package-lock.json deploy/ \
                       droplet:/var/www/bktc/releases/$SHA/

# on the droplet
/var/www/bktc/releases/$SHA/deploy/deploy.sh $SHA
```

`deploy.sh` installs deps, checks the native binding, **takes a backup**, runs
migrations, flips the symlink, `pm2 reload`s (not restart — reload brings the
new process up first, so an in-flight 5MB upload is not killed mid-write),
polls `/api/health`, and **rolls back by itself** if health does not come up.

### Deploy to staging first

Always. Staging runs the same release against a copy of production data, and
it is the only place a migration is rehearsed before it touches real CVs.

```bash
BKTC_APP_DIR=/var/www/bktc-staging BKTC_PM2_APP=bktc-staging-api \
BKTC_HEALTH_URL=http://127.0.0.1:4001/api/health \
  /var/www/bktc-staging/releases/$SHA/deploy/deploy.sh $SHA
```

---

## Rolling back

```bash
deploy/rollback.sh              # to the release before current
deploy/rollback.sh <sha>        # to a specific one
```

Two seconds, no build, no network. It flips the symlink and reloads.

**It does not undo migrations, deliberately.** Automatically reversing a schema
change during an incident is how data gets destroyed. What makes rollback safe
is a rule followed at *write* time:

> **Every migration must be backwards-compatible with the release before it.**
> Add columns nullable. Never rename or drop a column in the same deploy as the
> code change that stops using it — expand in one deploy, contract in the next.

Break that rule and rollback stops working: migration 011 adds a `NOT NULL`
column, you roll the code back, and the previous release's inserts fail.

---

## Backups

`deploy/backup.sh`, nightly at 02:30 IST:

```cron
30 2 * * * /var/www/bktc/current/deploy/backup.sh >> /var/log/bktc-backup.log 2>&1
```

It backs up **the database and the uploads**. Both. An earlier version of the
plan backed up `bktc.db` alone, which means losing the droplet loses every CV
while `file_asset` rows carry on pointing at files that are gone — a database
that restores cleanly into a broken application.

It uses `sqlite3 .backup`, never `cp`. Under WAL, uncheckpointed pages live in
the `-wal` file, so a copy taken mid-write is silently short of data.

It runs `PRAGMA integrity_check` **on the backup** and refuses to upload one
that fails. A backup cron quietly producing corrupt files for three months is
the classic form of this incident, and it is only ever discovered on the day it
is needed.

Set `BKTC_BACKUP_REMOTE` (DO Spaces, ~$5/mo, already in the Proposal's costing).
Without it the script warns loudly: a backup on the same disk as the database
does not survive the failure it exists for.

- **RPO: 24 hours.** Worst case, a day of applications and profile edits.
- **RTO: 4 hours.** Provision, restore, verify, DNS.

### Restoring — and the restore test

```bash
deploy/restore.sh /var/www/bktc/backups/bktc-<stamp>.tar.gz              # staging
deploy/restore.sh /var/www/bktc/backups/bktc-<stamp>.tar.gz --production # asks for confirmation
```

The script stops the app first (restoring over a live SQLite file leaves the
process holding a stale WAL), moves the existing database aside rather than
overwriting it, restores both the database and the uploads, then **verifies**:
`foreign_key_check`, a row count, and a file-by-file check that every CV the
database references is actually on disk. It exits non-zero if any is missing.

Restoring last night's production backup into staging **is** the restore
rehearsal. Schedule it:

```cron
0 4 * * * /var/www/bktc/current/deploy/restore.sh \
  $(ls -1t /var/www/bktc/backups/bktc-*.tar.gz | head -1) >> /var/log/bktc-restore.log 2>&1
```

**Rehearsed 2026-08-06, locally, against a copy of the development stack:**
backup → restore → verify passed with 8 users and 3 CVs; deleting one CV from
the archive made the restore fail with `1 CV(s) referenced by the database are
missing from disk`, exit code 1. Not yet rehearsed on the droplet — that is a
P10 task and belongs on the go-live checklist.

---

## Monitoring

T&C §3 commits to a year of platform monitoring, so this is contractual.

- **UptimeRobot** on `https://bktalentconnect.com/api/health`, 5-minute
  interval, alert to the on-call address. The endpoint really checks its
  dependencies — it runs a query and tests that `uploads/` is writable, and
  returns **503** when either fails. A health endpoint that returns `ok` from a
  process which cannot read its database is worse than none.
- **Disk alarm at 80%.** Unbounded pm2 logs filling a 25GB disk until every
  SQLite write returns `SQLITE_FULL` is the most likely year-one outage.
- **pm2-logrotate**, 10M / 7 files / compressed. Not installed by default:
  ```bash
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:max_size 10M
  pm2 set pm2-logrotate:retain 7
  pm2 set pm2-logrotate:compress true
  ```
- **Backup alerting.** `backup.sh` exits non-zero on any failure; the cron mail
  or a wrapper must surface that. A silent backup cron is not a backup.

---

## Weekly maintenance

```cron
0 3 * * 0 cd /var/www/bktc/current && npm run maintenance >> /var/log/bktc-maintenance.log 2>&1
```

Sweeps four kinds of debris, none of which announce themselves:

- sessions past the 90-day retention window (they carry IP and user agent,
  both personal data under DPDP)
- admin notes whose subject has been deleted — the polymorphic key cannot have
  a foreign key, so orphans are swept rather than prevented
- staged upload temp files from requests that failed between write and commit
- **files on disk with no row**, which is what an interrupted erasure leaves.
  This one is not housekeeping: an orphaned CV on disk is personal data we are
  still holding after being asked to erase it.

---

## Data protection

### Erasure requests

`/admin/erasure` lists them. Actioning one overwrites every personal column,
deletes skills, career history, internal notes and notifications, removes the
CV from disk, and ends their sessions. What survives is the application and the
audit trail, **detached** from the person — an employer's record of who they
interviewed is theirs, and an audit trail with a hole in it is not an audit
trail.

Admin accounts cannot be erased through this route. Their audit trail is the
accountability record for everyone else's data, and erasing the last active
admin locks BK out of their own platform. A staff member leaving is an account
handover.

Refusing a request requires a written reason, enforced by the API, and the
person is shown it verbatim. DPDP allows refusal on narrow grounds only, and
an unexplained refusal is indefensible.

### If a data incident happens

1. Do not delete anything. The audit log and the pm2 logs are the evidence.
2. Snapshot the droplet before touching it.
3. `sqlite3 shared/data/bktc.db "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200;"`
4. Scope it: which accounts, which fields, over what window.
5. Notify BK the same day. Indian DPDP breach notification is BK's obligation
   as the data fiduciary, and they cannot meet it without being told.

---

## Common incidents

**White screen after a deploy.** A cached `index.html` referencing a JS bundle
the deploy deleted. nginx sets `no-store` on `index.html` and `immutable` on
`/assets/` precisely to prevent this. Check the header:
`curl -I https://bktalentconnect.com/ | grep -i cache`. If it is wrong, the
nginx config on the box has drifted from `deploy/nginx.conf`.

**502 from nginx.** The API is down or bound to the wrong interface.
`pm2 status`, `pm2 logs bktc-api --lines 100`. Note that Vite and Node bind
`localhost` → `::1` on some systems while nginx proxies `127.0.0.1`; production
pins the host explicitly.

**SQLITE_BUSY under load.** `busy_timeout` is 2s and there is exactly one
writer process. Two pm2 instances of `bktc-api` would cause this — check
`pm2 status` shows one.

**Every login is rate-limited at once.** `trust proxy` and nginx's
`X-Forwarded-For` are out of step, so every request looks like `127.0.0.1`.
`TRUST_PROXY_HOPS` must be exactly 1 behind this nginx. Setting it to `true`
instead makes the header attacker-controlled and the limit bypassable.

**Locked out of admin.** There is no self-serve password reset in Phase 1
(email is Phase 2). Over SSH:

```bash
cd /var/www/bktc/current
npm run admin:reset-password -- --email you@bktalentconnect.com --password '<new>'
npm run admin:create -- --email new@bktalentconnect.com --password '<new>'
```

**Disk full.** Check `/var/log/bktc` first, then `shared/uploads`, then
`shared/backups`. `du -sh /var/www/bktc/* /var/log/bktc`.

---

## Certificates

```bash
sudo certbot --nginx -d bktalentconnect.com -d www.bktalentconnect.com \
  --deploy-hook "systemctl reload nginx"
```

The `--deploy-hook` is not optional. Without it the certificate renews and
nginx carries on serving the expired one for up to 60 days. Verify:
`sudo certbot renew --dry-run`.

---

## Still open

Carried from the plan, and not engineering decisions:

- **Who owns the DigitalOcean account and the domain?** Recommendation: BK owns
  both, Takai gets a deploy user and an SSH key. Verify DNS control with a TXT
  record in week 1, not on go-live day.
- **Formal acceptance criteria** for the ₹40,000 (73%) milestone. "Go-live and
  handover" is defined nowhere in the contract; the Definition of Done in
  `PHASE_1_PLAN.md` should be sent as an annexe and acknowledged.
- **Support scope.** T&C §3 promises a year of unbounded "bug fixes, minor
  issues and platform monitoring". Agree channel, response window, the
  bug-versus-change-request line, and a soft hours cap.
- **Backup destination and its cost**, approved by BK, before go-live.
