# Runbook — Sphere DMARC Dashboard

Operational reference. Governance tier **T2** (see `sphere-app.json`).

## Service shape

- Single container, non-root, `:8080`, Next standalone (`node server.js`).
- Stateless; all state in the platform Postgres (per-app DB, injected `DATABASE_URL`).
- Probes: `/healthz` (liveness, no deps) and `/readyz` (Postgres reachable → 503 until so).
- Egress: `ipinfo.io` (HTTPS) and public DNS `1.1.1.1` / `8.8.8.8` — must be allowed on the tailnet.

## Deploy / rollback

- Deploy is handled by the platform qualify pipeline + reviewer, not by hand.
- **Rollback:** redeploy the previous image in Coolify. No schema migration is
  involved beyond `ensureSchema()`, which is additive and idempotent.

## First-boot behaviour

- The platform hands over an **empty** database. On first request, `ensureSchema()`
  creates all tables/indexes. Subsequent boots detect the schema and skip DDL.
- If the scoped role lacks CREATE on an empty DB, first boot will error — the app
  needs ownership of its own per-app database (the platform default).

## Common alerts and what they mean

| Symptom | Likely cause | Action |
|---------|-------------|--------|
| `/readyz` 503 | Postgres unreachable or `DATABASE_URL` wrong | Check the injected `DATABASE_URL` and platform Postgres health |
| Container won't start, logs "Invalid environment configuration" | Required env var missing (fails fast by design) | Set the named var as a Coolify runtime secret |
| Authed page 500, logs `permission denied for schema public` | Scoped role can't create tables on an empty DB | Confirm the app owns its per-app DB |
| Dashboard loads but flags/styles missing | Static assets 302'd to SSO | Allowlist `^/_next/`, `^/favicon.ico$` as unauthenticated in the Authentik forward-auth config (infra, not code) |
| "Identify sources" resolves nothing | `IPINFO_TOKEN` unset or rate-limited | Set/verify the token; enrichment retries and self-heals |
| Report upload silently adds nothing | Duplicate report IDs (already ingested) | Expected — ingestion is deduped by report ID |
| Auto-ingest imports nothing | `GMAIL_*` unset, refresh token revoked/expired, or simply no new mail | Check `ingest.*` logs; re-mint the refresh token if revoked (see README) |

## Gmail auto-ingestion

An in-process job runs **hourly** (first run ~1 min after boot) and also on demand
via the dashboard's **"Fetch mail"** button. It reads DMARC report emails under the
mailbox's "DMARC Reports" label (read-only Gmail scope), parses attachments
server-side, and ingests through the same deduped path as a manual upload — so
overlapping runs are safe. It's a **no-op until all three `GMAIL_*` secrets are set**.
**To pause it:** clear the `GMAIL_*` secrets and redeploy.

## Logs & alerting

Server logs are **structured JSON**, one line per event (`{ ts, level, event, ... }`);
errors serialise to `{ name, message }` and never carry a stack or secret. Key events:

| Event | Level | Meaning |
|-------|-------|---------|
| `report.upload`, `backup.import`, `enrich.completed` | info | Successful ingestion/enrichment (with counts) |
| `ingest.scheduler.started` / `ingest.scheduler.skipped` | info | Hourly Gmail auto-fetch started (or skipped — no credentials) |
| `ingest.completed` | info | An auto/manual Gmail fetch finished (messages/reports/added/skipped/errors) |
| `ingest.message.failed` / `ingest.parse.failed` | warn | A single message or attachment couldn't be fetched/parsed — the run continues |
| `ingest.disabled` | warn | Ingestion triggered but Gmail credentials aren't configured |
| `enrich.token.missing` | warn | `IPINFO_TOKEN` unset — geo enrichment disabled |
| `enrich.batch.failed` | error | ipinfo call failed (rate-limit/network) — IPs stay retryable |
| `*.get.failed` / `*.post.failed` / `import.failed` | error | Unhandled route error (returned to client as generic 500) |
| `audit.write.failed` | error | Audit row couldn't be written (request still served) |

**Suggested alerts:** any `level=error` sustained, and `audit.write.failed` (audit
gaps). `enrich.token.missing` is a config nudge, not a page.

## Data

- Tables: `reports`, `report_rows`, `ip_info`, `published_records`, `audit_log`.
- **Audit trail:** every mutation (`report.upload`, `backup.import`, `ipinfo.enrich`)
  writes to `audit_log` with the Authentik email and timestamp.
- **Bulk/backfill** must go through the app's own endpoints (upload / import-backup /
  enrich), never raw SQL — that preserves dedupe, validation, and the audit log.

## Health check commands

```bash
curl -fsS https://<app>.internal.spheredrones.app/healthz   # → {"ok":true}
curl -fsS https://<app>.internal.spheredrones.app/readyz    # → {"ok":true} or 503
```
