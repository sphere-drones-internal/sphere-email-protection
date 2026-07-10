import { describe, it, expect } from "vitest";
import { spfTerms } from "@/lib/spf";

describe("spfTerms", () => {
  it("counts include, a, mx, ptr, exists and redirect as lookups", () => {
    const { lookupTerms } = spfTerms("v=spf1 include:_spf.google.com a mx ptr exists:%{i}.spf.example.com redirect=other.com");
    expect(lookupTerms).toBe(6);
  });

  it("does not count ip4, ip6, all or exp", () => {
    const { lookupTerms } = spfTerms("v=spf1 ip4:203.0.113.0/24 ip6:2001:db8::/32 exp=explain.example.com -all");
    expect(lookupTerms).toBe(0);
  });

  it("handles qualifiers on mechanisms", () => {
    const { lookupTerms } = spfTerms("v=spf1 +include:a.com ~include:b.com -mx ?a all");
    expect(lookupTerms).toBe(4);
  });

  it("counts a/mx with domain or CIDR arguments", () => {
    const { lookupTerms } = spfTerms("v=spf1 a:mail.example.com mx:example.com/24 ~all");
    expect(lookupTerms).toBe(2);
  });

  it("does not miscount all as a lookup despite starting with 'a'", () => {
    const { lookupTerms } = spfTerms("v=spf1 -all");
    expect(lookupTerms).toBe(0);
  });

  it("extracts include and redirect targets for recursion", () => {
    const { targets } = spfTerms("v=spf1 include:_spf.google.com mx redirect=fallback.com");
    expect(targets).toEqual(["_spf.google.com", "fallback.com"]);
  });

  it("counts macro targets as lookups but does not return them for recursion", () => {
    const { lookupTerms, targets } = spfTerms("v=spf1 exists:%{i}.spf.example.com include:%{d}.trusted.com ~all");
    expect(lookupTerms).toBe(2);
    expect(targets).toEqual([]);
  });

  it("returns zero for a record with no mechanisms", () => {
    expect(spfTerms("v=spf1 ~all")).toEqual({ lookupTerms: 0, targets: [] });
  });
});
