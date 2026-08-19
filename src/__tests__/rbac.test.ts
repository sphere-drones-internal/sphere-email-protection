import { describe, it, expect, vi, afterEach } from "vitest";
import { isEditor } from "@/lib/rbac";

afterEach(() => vi.unstubAllEnvs());

describe("isEditor", () => {
  it("defaults to the owner and is case-insensitive", () => {
    expect(isEditor("josh@spheregroup.com.au")).toBe(true);
    expect(isEditor("JOSH@SphereGroup.com.au")).toBe(true);
    expect(isEditor("someone.else@spheregroup.com.au")).toBe(false);
  });

  it("honours the EDITOR_EMAILS allowlist (comma-separated)", () => {
    vi.stubEnv("EDITOR_EMAILS", "a@x.com, b@y.com");
    expect(isEditor("a@x.com")).toBe(true);
    expect(isEditor("b@y.com")).toBe(true);
    expect(isEditor("josh@spheregroup.com.au")).toBe(false); // default is replaced, not merged
  });
});
