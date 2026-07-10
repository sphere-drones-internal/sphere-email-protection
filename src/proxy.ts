import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { evaluateAuth } from "@/lib/auth-core";

// Brand assets and the favicon route must load on the unauthenticated login page —
// without these the auth redirect turns every <img> into a broken image.
const PUBLIC_PATHS = ["/login", "/auth/callback", "/sphere-logo.svg", "/sphere-mark.svg", "/icon.svg"];

export async function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    "img-src 'self' https://flagcdn.com https://*.googleusercontent.com data:",
    // no nonce mechanism covers the `style` attribute itself (only <style> elements) —
    // the dashboard renders dynamic inline styles for chart/progress-bar colours and widths
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "connect-src 'self' https://*.supabase.co",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const withCsp = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  if (PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p))) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const verdict = evaluateAuth(user?.email ?? null, process.env.ALLOWED_EMAIL_DOMAINS ?? "");

  if (!verdict.ok) {
    if (req.nextUrl.pathname.startsWith("/api")) {
      return withCsp(NextResponse.json({ error: verdict.status === 401 ? "Unauthorised" : "Forbidden" }, { status: verdict.status }));
    }
    const url = new URL("/login", req.url);
    if (verdict.status === 403) url.searchParams.set("error", "domain");
    return withCsp(NextResponse.redirect(url));
  }
  return withCsp(res);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
