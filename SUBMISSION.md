# Platform Submission Summary — Sphere DMARC Dashboard

For submission to the Sphere App platform (Coolify: Tailscale + Authentik + Traefik).
Prepared by Josh (josh@spheregroup.com.au), 17 July 2026.

## App

| | |
|---|---|
| **Name** | dmarc-dashboard |
| **Purpose** | Monitor email authentication (DMARC, SPF, BIMI, DKIM) across the Sphere domain portfolio — ingest aggregate reports, run live DNS checks, enrich sending IPs, export a portfolio summary. |
| **Users** | Marketing team, primarily the owner. |
| **Build track** | Track 2 (Next.js App Router + Postgres). |
| **Port** | 8080 (container, non-root). |

## Governance — proposed tier **T2**

Reach and impact are low (one small team, internal data, minor if down) — T1 on
their own. But the app **creates records and calls external APIs** (ingests reports,
writes an audit log, calls ipinfo.io + public DNS), and the standard floors
record-creating apps at **T2**. Not T3: no customer/compliance/operational data,
nothing delivery- or safety-affecting.

Intake: relies-on = one team · data = internal · writes/sends/triggers = creates
records + calls APIs · impact if wrong/down a day = minor · AI/agents/connectors = none.

## Access — single role

One shared team dataset; every authorised user sees the same data, so there are no
in-app roles. Authentik group membership is the only gate.

| Authentik group | Role | Access |
|-----------------|------|--------|
| `dmarc-dashboard-users` | (single) | Full app |

Identity (`X-authentik-email`) is read only to stamp the audit log; the app fails
closed if it's absent and binds to the proxy network only (no published host port).

## Data handled

- Internal email-authentication telemetry: DMARC aggregate reports, sending-source
  IPs + geolocation, published DNS records, and an audit log.
- **Storage:** platform Postgres (`database: "postgres"`), per-app DB + scoped role,
  `DATABASE_URL` injected. Schema created at first boot by `ensureSchema()`.
- No customer PII. Starting clean — no data migrated from the previous Supabase build.

## Data flows (T2 register)

| Flow | In / Out | Detail |
|------|----------|--------|
| Report ingestion | In | User uploads DMARC aggregate reports (`.xml/.gz/.zip`) or JSON backup → parsed → `reports`/`report_rows`. Deduped by report ID. |
| DNS checks | Out → In | Server queries public resolvers (1.1.1.1/8.8.8.8) for the portfolio domains' DMARC/SPF/DKIM/BIMI records; results are transient (not stored). |
| IP enrichment | Out → In | Server sends sending-source IPs to ipinfo.io (batch) → country/org/hostname cached in `ip_info`. |
| Identity | In | `X-authentik-email` (from the proxy) is read per request, written only to `audit_log`. |
| Audit | Internal | Every mutation writes `{ user, action, detail, at }` to `audit_log`. |
| Export | Out | User-initiated CSV / JSON backup / markdown summary downloads (client-side, from already-loaded data). |

No data leaves the tailnet except the two declared egress calls below. No customer PII;
retention is indefinite in-app (operator-managed).

## External services (egress to allow)

| Destination | Protocol | Why |
|-------------|----------|-----|
| ipinfo.io | HTTPS | IP geolocation enrichment (batch, server-side) |
| 1.1.1.1 / 8.8.8.8 | DNS | Live DMARC/SPF/DKIM/BIMI record checks |

## Secrets (Coolify runtime)

`DATABASE_URL` (injected), `IPINFO_TOKEN` (geo enrichment; app self-heals once set).

## Standards checklist

- [x] Dockerfile serves on one port; `/healthz` → 200, does not touch the DB
- [x] `/readyz` checks Postgres (503 until reachable)
- [x] Required config validated at boot (Zod in `instrumentation.ts`), fails fast, no dev fallback
- [x] Empty-DB schema applied at startup via idempotent `ensureSchema()` (standalone-safe, no Prisma CLI at boot)
- [x] Non-root container, listens on :8080
- [x] Assets vendored — country flags via `flag-icons` (npm), no runtime CDN
- [x] CSP as an HTTP header, per-request nonce + `strict-dynamic`, `force-dynamic`
- [x] No secrets in code or image layers; runtime env only
- [x] No app-side login / OAuth / domain check — platform owns auth
- [x] Binds to proxy network only; no published host port
- [x] `sphere-app.json` manifest present
- [x] `npm run smoke` boots the built standalone server vs Postgres and asserts health + fail-closed auth + schema creation
- [x] T2 controls: README, RUNBOOK, structured JSON logging, data-flow register (above), structured audit trail, rollback plan
- [ ] **Infra (deployer):** create the `dmarc-dashboard-users` Authentik group; allowlist `^/_next/` + `^/favicon.ico$` as unauthenticated static paths in forward-auth
- [ ] **Known follow-up:** 2 pre-existing ESLint `react-hooks/purity` findings (`Date.now()` in render) — cosmetic, non-blocking

## Verification (this commit)

`npx tsc --noEmit` clean · `npm test` 66/66 · `npx next build` succeeds (standalone) ·
`npm run smoke` passes (health, readiness, fail-closed 401, header-auth 200, schema creation).

Submit via the platform — do not self-deploy. The qualify pipeline and a human
reviewer handle approval and deployment.
