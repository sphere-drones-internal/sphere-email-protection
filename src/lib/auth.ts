import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { evaluateAuth } from "@/lib/auth-core";

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser(): Promise<{ id: string; email: string }> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const verdict = evaluateAuth(user?.email ?? null, process.env.ALLOWED_EMAIL_DOMAINS ?? "");
  if (!verdict.ok) throw new AuthError(verdict.status, verdict.status === 401 ? "Unauthorised" : "Forbidden");
  return { id: user!.id, email: user!.email! };
}