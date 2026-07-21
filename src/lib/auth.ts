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
  if (!email) throw new IdentityError();
  return { email, username };
}
