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

  it("throws IdentityError (fail closed) when no identity header is present", async () => {
    withHeaders({});
    await expect(getIdentity()).rejects.toBeInstanceOf(IdentityError);
  });
});
