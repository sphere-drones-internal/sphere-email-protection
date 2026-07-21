import { NextResponse, type NextRequest } from "next/server";

// The platform owns auth (Authentik) and TLS (Traefik) — this proxy exists only
// to attach a per-request nonce-based Content-Security-Policy. It must run
// dynamically (see `export const dynamic = "force-dynamic"` in layout.tsx) so a
// fresh nonce reaches every script tag on each request.
export function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    "img-src 'self' data:", // flags are vendored locally now — no external CDN
    // no nonce mechanism covers the `style` attribute itself (only <style> elements) —
    // the dashboard renders dynamic inline styles for chart/progress-bar colours and widths
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the CSP off the request header to stamp the nonce onto its scripts.
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
