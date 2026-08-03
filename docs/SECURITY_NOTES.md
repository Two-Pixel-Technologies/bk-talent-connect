# Security notes

Running log of accepted risks and dependency advisories. Re-check before go-live.

## Accepted advisories

### GHSA-qwww-vcr4-c8h2 — react-router RSC Mode CSRF Bypass (high)

- **Affects:** `react-router` 7.12.0 – 8.2.0, `react-router-dom` >= 7.12.0-pre.0
- **Installed:** 7.18.2 (the latest published release, itself inside the range)
- **Status:** accepted, not applicable

The advisory concerns React Router's **RSC mode**, where server-side actions can
execute before a 400 response is returned. This project uses React Router purely
client-side via `createBrowserRouter` in a static SPA — there is no RSC, no
server-side router, and no server actions. Every state change goes through the
Express API, which has its own CSRF controls (Origin / `Sec-Fetch-Site` check
plus a required `X-Requested-With` header on unsafe methods).

There is also no fixed version to move to: 7.18.2 is the newest release and the
advisory range extends past it.

**Re-check before go-live.** If a patched release ships, upgrade.

## Standing decisions

- **`SameSite=Lax`, not `Strict`.** With a WhatsApp button on every public page,
  `Strict` means an inbound WhatsApp link lands the user logged-out. `Lax` plus
  an Origin check plus a required custom header is strictly stronger than
  `Strict` alone and does not break inbound links.
- **Registration leaks account existence.** `POST /api/auth/register/*` must
  reject a duplicate email, which confirms an address is registered. Avoiding it
  needs email verification, which is Phase 2. Rate-limited and consciously
  accepted; login itself returns a generic 401.
- **argon2id pinned to `m=19456, t=2, p=1`** (OWASP minimum profile). The library
  default of 64MB *per concurrent hash* would exhaust a 1GB droplet under a
  handful of simultaneous logins.

## Pre-launch privacy audit

Beyond reading API responses in DevTools, the audit must include:

```bash
# Salaries and contact details must never reach the logs.
grep -rE "currentSalary|expected_salary|<test candidate mobile>" ~/.pm2/logs/
```

The serializer layer protects response bodies and does nothing about logs,
`audit_log.metadata`, or `session.ip_address`. Those have separate controls
(`redact()` in `lib/logger.ts`, an allowlist for audit metadata, and a 90-day
session retention sweep).
