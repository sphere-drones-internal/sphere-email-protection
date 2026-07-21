# Sphere DMARC Dashboard

Internal dashboard for monitoring email authentication (DMARC, SPF, BIMI, DKIM)
across the Sphere domain portfolio. Ingests DMARC aggregate reports, runs live
DNS checks, enriches sending-source IPs with geolocation, and produces a shareable
portfolio summary.

Built for the **Sphere Coolify platform** (Tailscale + Authentik + Traefik).

## What it does

- Upload DMARC aggregate reports (`.xml`, `.xml.gz`, `.zip`) or a JSON backup; they're
  parsed, deduped by report ID, and stored in Postgres.
- Live DNS checks per portfolio domain: DMARC policy, SPF (with 10-lookup-limit
  monitoring), DKIM selector probing, BIMI.
- Server-side IP geolocation enrichment via ipinfo.io (batch).
- Exportable portfolio summary with a plain-English overview.

## Platform model (important)

The platform owns **auth, TLS, and the network** — this app does **not**:

- **Authentik** (Google Workspace SSO) authenticates every request before it reaches
  the app; **Tailscale** gates the network; **Traefik** terminates TLS. There is no
  login page, OAuth flow, or domain check in this codebase.
- The app reads the forwarded `X-authentik-email` header only to stamp the audit log,
  and fails closed if it's absent. These headers are trusted only because the container
  binds to the proxy network and never publishes a host port.
- Access is a **single shared dataset** gated by one Authentik group
  (`dmarc-dashboard-users`); there are no in-app roles.

## Runtime

- **Container**, non-root, listens on **:8080** (`node server.js`, Next standalone).
- **`/healthz`** — liveness, no DB. **`/readyz`** — readiness, checks Postgres.
- **Postgres** is platform-provisioned (per-app DB + scoped role); `DATABASE_URL` is
  injected. The DB is handed over **empty** — `ensureSchema()` in `src/lib/db.ts`
  creates the tables on first boot (idempotent; a no-op once they exist).
- Required config is validated at boot (`src/lib/env.ts` via `src/instrumentation.ts`)
  and the process fails fast if `DATABASE_URL` is missing — no dev fallback.

### Environment variables (Coolify runtime secrets)

| Var | Required | Purpose |
|-----|----------|---------|
| `DATABASE_URL` | yes | Platform-injected Postgres connection string |
| `IPINFO_TOKEN` | recommended | ipinfo.io token for geo enrichment; enrichment self-heals once set |

## Local development

```bash
npm install
npm run dev            # http://localhost:3000
```

Needs a local `.env` with `DATABASE_URL` (any reachable Postgres) and optionally
`IPINFO_TOKEN`. `.env` is git-ignored and never shipped in the image.

## Checks

```bash
npm test               # unit tests (vitest)
npx tsc --noEmit       # type check
npx next build         # production build (standalone)
npm run smoke          # boot the built standalone server vs a real Postgres and
                       # assert health, fail-closed auth, and schema creation
```

## How to stop it

Stop or roll back the deployment in Coolify. The app is stateless (all data in
Postgres); Coolify provides instant rollback to the previous image. Report ingestion
is idempotent (deduped by report ID), so re-processing is always safe.

See [RUNBOOK.md](RUNBOOK.md) for operational detail and [sphere-app.json](sphere-app.json)
for the platform manifest (governance tier T2, access, egress).
