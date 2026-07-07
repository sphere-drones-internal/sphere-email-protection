import { describe, it, expect } from "vitest";
import { evaluateAuth, isAllowedEmail } from "@/lib/auth-core";

const ALLOWED = "spheregroup.com.au,spheredrones.com.au";

describe("evaluateAuth", () => {
  it("returns 401 when there is no session email", () => {
    expect(evaluateAuth(null, ALLOWED)).toEqual({ ok: false, status: 401 });
    expect(evaluateAuth(undefined, ALLOWED)).toEqual({ ok: false, status: 401 });
    expect(evaluateAuth("", ALLOWED)).toEqual({ ok: false, status: 401 });
  });

  it("returns 403 for an email outside the allowed domains", () => {
    expect(evaluateAuth("josh@gmail.com", ALLOWED)).toEqual({ ok: false, status: 403 });
    expect(evaluateAuth("attacker@spheregroup.com.au.evil.com", ALLOWED)).toEqual({ ok: false, status: 403 });
  });

  it("passes an allowed-domain email", () => {
    expect(evaluateAuth("josh@spheregroup.com.au", ALLOWED)).toEqual({ ok: true });
    expect(evaluateAuth("josh@SPHEREDRONES.COM.AU", ALLOWED)).toEqual({ ok: true });
  });

  it("denies everything when the allow-list is empty", () => {
    expect(evaluateAuth("josh@spheregroup.com.au", "")).toEqual({ ok: false, status: 403 });
  });
});

describe("isAllowedEmail", () => {
  it("handles whitespace in the CSV", () => {
    expect(isAllowedEmail("a@b.com", " b.com , c.com ")).toBe(true);
  });
});