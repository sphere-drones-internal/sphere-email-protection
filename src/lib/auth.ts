import { headers } from "next/headers";

// The Sphere platform authenticates every request BEFORE it reaches this app:
// Authentik (Google Workspace SSO) via Traefik forward-auth, with the network
// gated by Tailscale. The app does not do its own login/OAuth/domain check.
//
// We only READ the identity Authentik forwards, purely to stamp the audit log.
// These X-authentik-* headers are trustworthy only because the container binds
// to the proxy network and never publishes a host port — so a request without
// them did not come through the proxy, and we fail closed.

export class IdentityError extends Error {
  constructor(message = "No authenticated identity on request") {
    super(message);
    this.name = "IdentityError";
  }
}

export async function getIdentity(): Promise<{ email: string; username: string }> {
  const h = await headers();
  const email = (h.get("x-authentik-email") ?? "").trim().toLowerCase();
  const username = (h.get("x-authentik-username") ?? "").trim() || email;
  if (email) return { email, username };

  // Local dev only (`next dev`): there is no Authentik proxy to inject the header,
  // so fall back to a fixed dev identity. Gated strictly to NODE_ENV==="development"
  // — production and the test runner still fail closed, so the real trust boundary
  // is untouched. Override the dev identity with DEV_IDENTITY_EMAIL if you like.
  if (process.env.NODE_ENV === "development") {
    const dev = (process.env.DEV_IDENTITY_EMAIL ?? "dev@spheregroup.com.au").trim().toLowerCase();
    return { email: dev, username: dev };
  }

  throw new IdentityError();
}
