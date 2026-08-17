// Next calls register() once at server startup. Validate required config here so
// a misconfigured container fails fast at boot with a clear, named error rather
// than surfacing as opaque per-request 500s. Then start the hourly Gmail ingest
// scheduler (a no-op unless Gmail credentials are configured).
export async function register() {
  // Only the Node.js server runtime — not the edge runtime, and register isn't
  // called during build.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { validateEnv } = await import("@/lib/env");
  validateEnv();

  const { startIngestScheduler } = await import("@/lib/ingest");
  startIngestScheduler();
}
