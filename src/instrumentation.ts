// Next calls register() once at server startup. Validate required config here and
// log a clearly-named error for any misconfiguration — but do NOT throw. The
// platform probes /healthz (liveness) during a no-DB build-verify where DATABASE_URL
// and friends aren't injected yet; crashing the process would make liveness fail
// (503) even though the container is otherwise fine. Missing/broken deps are
// surfaced as not-ready by /readyz instead, so a real misconfig is still caught.
export async function register() {
  // Only the Node.js server runtime — not the edge runtime, and register isn't
  // called during build.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
  }

  const { startIngestScheduler } = await import("@/lib/ingest");
  startIngestScheduler();
}
