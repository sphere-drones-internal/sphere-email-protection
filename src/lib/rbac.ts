// Two roles: editors can write (upload/fetch/import/enrich), everyone else is
// read-only. Editors are an email allowlist from EDITOR_EMAILS (comma-separated),
// defaulting to the owner. Enforced server-side in every write route — the UI
// also hides write controls, but that's convenience, not the security boundary.
export function isEditor(email: string): boolean {
  const allow = (process.env.EDITOR_EMAILS ?? "josh@spheregroup.com.au")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.trim().toLowerCase());
}
