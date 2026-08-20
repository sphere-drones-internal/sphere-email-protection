// Smoke test: boot the BUILT standalone server (not `next dev`) against a real
// Postgres and assert the behaviours that only appear in production — the
// standalone bundle + injected env, header-based identity, fail-closed auth,
// idempotent schema creation, and readiness. Run `npx next build` first.
//
//   node smoke.mjs            (uses DATABASE_URL from the environment)
//   TEST_DATABASE_URL=... node smoke.mjs   (point at an ephemeral/empty PG to
//                                            also exercise ensureSchema's create path)
//
// The platform's own verify additionally builds the Docker image and runs this
// against an ephemeral Postgres; this is the runnable pre-flight equivalent.

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = process.env.SMOKE_PORT || "8099";
const BASE = `http://127.0.0.1:${PORT}`;
const DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("smoke: set TEST_DATABASE_URL or DATABASE_URL");
  process.exit(1);
}

// EDITOR_EMAILS is a required runtime secret (write-access allowlist); provide one
// so the standalone server boots past env validation. The smoke assertions below
// only exercise read/fail-closed paths, so any value works here.
const EDITOR_EMAILS = process.env.EDITOR_EMAILS || "smoke@spheregroup.com.au";

const server = spawn("node", [".next/standalone/server.js"], {
  env: { ...process.env, PORT, HOSTNAME: "127.0.0.1", DATABASE_URL, EDITOR_EMAILS, NODE_ENV: "production" },
  stdio: "inherit",
});

let failed = false;
const check = (name, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}`);
  if (!ok) failed = true;
};

try {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* not up yet */ }
    await sleep(500);
  }

  check("/healthz → 200 (liveness, no DB)", (await fetch(`${BASE}/healthz`)).status === 200);
  check("/readyz → 200 (Postgres reachable)", (await fetch(`${BASE}/readyz`)).status === 200);
  check("/api/data → 401 without a forwarded identity (fail closed)", (await fetch(`${BASE}/api/data`)).status === 401);

  const authed = await fetch(`${BASE}/api/data`, { headers: { "X-authentik-email": "smoke@spheregroup.com.au" } });
  check("/api/data → 200 with X-authentik-email (schema present after ensureSchema)", authed.status === 200);
  const body = await authed.json().catch(() => ({}));
  check("/api/data returns reports[] and rows[]", Array.isArray(body.reports) && Array.isArray(body.rows));
} catch (e) {
  console.error("smoke: unexpected error", e);
  failed = true;
} finally {
  server.kill();
}

console.log(failed ? "\nSMOKE FAILED" : "\nSMOKE PASSED");
process.exit(failed ? 1 : 0);
