import { describe, it, expect, vi } from "vitest";

// getIdentity reads the identity the platform's Authentik forward-auth injects.
const headerMock = vi.hoisted(() => ({ current: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => headerMock.current }));

import { getIdentity, IdentityError } from "@/lib/auth";

const withHeaders = (h: Record<string, string>) => { headerMock.current = new Headers(h); };

describe("getIdentity", () => {
  it("returns the forwarded identity, lowercasing the email", () => {
    withHeaders({ "x-authentik-email": "Josh@SphereGroup.com.au", "x-authentik-username": "josh" });
    return expect(getIdentity()).resolves.toEqual({ email: "josh@spheregroup.com.au", username: "josh" });
  });

  it("falls back to the email when no username header is present", async () => {
    withHeaders({ "x-authentik-email": "ops@spheredrones.com.au" });
    await expect(getIdentity()).resolves.toEqual({ email: "ops@spheredrones.com.au", username: "ops@spheredrones.com.au" });
  });

  it("throws IdentityError (fail closed) when no identity header is present outside dev", async () => {
    // vitest runs with NODE_ENV=test, so the dev fallback does not apply here.
    withHeaders({});
    await expect(getIdentity()).rejects.toBeInstanceOf(IdentityError);
  });

  it("falls back to a fixed dev identity only under NODE_ENV=development", async () => {
    withHeaders({});
    vi.stubEnv("NODE_ENV", "development");
    await expect(getIdentity()).resolves.toEqual({ email: "dev@spheregroup.com.au", username: "dev@spheregroup.com.au" });
    vi.unstubAllEnvs();
  });
});
