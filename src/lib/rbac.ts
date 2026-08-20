// Two roles: editors can write (upload/fetch/import/enrich), everyone else is
// read-only. Editors are an email allowlist from EDITOR_EMAILS (comma-separated),
// injected as a runtime env var by the platform — never hardcoded in source.
// Fail closed: if EDITOR_EMAILS is unset/empty, nobody is an editor. Enforced
// server-side in every write route — the UI also hides write controls, but
// that's convenience, not the security boundary.
export function isEditor(email: string): boolean {
  const raw = process.env.EDITOR_EMAILS ?? "";
  if (!raw) return false; // fail closed — set EDITOR_EMAILS at runtime
  const allow = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.trim().toLowerCase());
}
