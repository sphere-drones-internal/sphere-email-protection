import { describe, it, expect, vi, afterEach } from "vitest";
import { isEditor } from "@/lib/rbac";

afterEach(() => vi.unstubAllEnvs());

describe("isEditor", () => {
  it("fails closed when EDITOR_EMAILS is unset — nobody is an editor", () => {
    vi.stubEnv("EDITOR_EMAILS", "");
    expect(isEditor("josh@spheregroup.com.au")).toBe(false);
    expect(isEditor("anyone@spheregroup.com.au")).toBe(false);
  });

  it("honours the EDITOR_EMAILS allowlist (comma-separated) and is case-insensitive", () => {
    vi.stubEnv("EDITOR_EMAILS", "a@x.com, b@y.com");
    expect(isEditor("a@x.com")).toBe(true);
    expect(isEditor("B@Y.com")).toBe(true);
    expect(isEditor("josh@spheregroup.com.au")).toBe(false); // not on the allowlist
  });
});
