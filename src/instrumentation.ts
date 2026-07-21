// Next calls register() once at server startup. Validate required config here so
// a misconfigured container fails fast at boot with a clear, named error rather
// than surfacing as opaque per-request 500s.
export async function register() {
  const { validateEnv } = await import("@/lib/env");
  validateEnv();
}
