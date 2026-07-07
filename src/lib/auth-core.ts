export type AuthVerdict = { ok: true } | { ok: false; status: 401 | 403 };

export function isAllowedEmail(email: string, allowedCsv: string): boolean {
  const allowed = allowedCsv.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && allowed.includes(domain);
}

export function evaluateAuth(email: string | null | undefined, allowedCsv: string): AuthVerdict {
  if (!email) return { ok: false, status: 401 };
  if (!isAllowedEmail(email, allowedCsv)) return { ok: false, status: 403 };
  return { ok: true };
}