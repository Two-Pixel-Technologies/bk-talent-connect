# Running BK Talent Connect locally

## Quick start (production mode — recommended for reviewing)

```bash
npm install
npm run seed:demo      # realistic accounts in every approval state
npm run start:prod     # builds everything, serves on one port
```

Then open **http://localhost:4000**

This is the mode to use when you want to see what BK will see. It runs
`NODE_ENV=production`, the compiled API, and the built SPA on a **single
origin** — which is what nginx gives you on the droplet. Cookies, the CSRF
Origin check, deep links and cache headers all behave here exactly as they will
in production.

## Development mode (for building)

```bash
npm run dev
```

- SPA with hot reload: **http://localhost:5173**
- API: **http://localhost:4000**

Vite proxies `/api` to port 4000, so it is still same-origin from the browser's
point of view. Use this while writing code; use `start:prod` to review.

## Sign in

Seeded by `npm run seed:demo`.

| Role | Email | Password | State |
|---|---|---|---|
| **Admin** | `admin@bktalentconnect.com` | `bktc-admin-2026` | — |
| Candidate | `anita.desai@demo.in` | `demo-password-1` | **Approved** — full profile |
| Candidate | `priya.nair@demo.in` | `demo-password-1` | Approved |
| Candidate | `rohit.kulkarni@demo.in` | `demo-password-1` | Under review |
| Candidate | `sameer.joshi@demo.in` | `demo-password-1` | **Changes requested** — carries a review note |
| Candidate | `fatima.shaikh@demo.in` | `demo-password-1` | Draft — incomplete |
| Employer | `ravi.menon@kirloskar.demo.in` | `demo-password-1` | Approved |
| Employer | `neha.gupta@zydus.demo.in` | `demo-password-1` | Awaiting verification |

Five candidate states exist deliberately: the approval gate is the product's
central rule, and it is only convincing when you can see each state side by side.

## What to look at

| URL | |
|---|---|
| `/` | Landing page — the three audiences' entry points |
| `/candidate/profile` | **The profile builder.** Sign in as Anita to see it populated |
| `/candidate` | Candidate dashboard with the approval-gate banner |
| `/employer` | Employer dashboard — compare Ravi (approved) with Neha (pending) |
| `/status` | Build progress: every phase and every exit check |
| `/system` | Live health of the API, database and file storage |

Sign in as **Sameer** to see the "changes requested" state with our team's note
shown in full — that message is the whole point of the state.

## Other commands

```bash
npm test                 # 75 tests
npm run lint
npm run typecheck
npm run db:migrate       # apply pending migrations (idempotent, backs up first)
npm run admin:create -- --email you@example.com --password 'your-password'
npm run admin:reset-password -- --email someone@example.com --password 'temp-password'

sqlite3 apps/api/data/bktc.db     # inspect directly: .schema, .tables
```

## Starting over

```bash
rm -f apps/api/data/bktc.db* && npm run seed:demo
```

## How this differs from the droplet

`start:prod` reproduces the part that causes bugs — one origin, real cache
headers, the compiled build. nginx additionally handles TLS, gzip and the
reverse-proxy hop, and its config lives in `deploy/nginx.conf`. Keep that file
and `apps/api/src/middleware/static-spa.ts` in step; they implement the same
cache policy in two places.

One setting differs by design: `TRUST_PROXY_HOPS` is `0` locally (nothing in
front) and `1` on the droplet (nginx). Getting that pair wrong either makes
every client look like `127.0.0.1` — so five failed logins lock out the whole
platform — or lets a client forge its own IP and bypass rate limiting entirely.
