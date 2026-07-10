import { describe, it, expect } from "vitest";
import { countryName, stripAsn, normalizeIpinfo } from "@/lib/geo";

describe("countryName", () => {
  it("maps ISO alpha-2 codes to full names", () => {
    expect(countryName("US")).toBe("United States");
    expect(countryName("au")).toBe("Australia");
    expect(countryName("LT")).toBe("Lithuania");
  });
  it("returns empty for invalid or unknown codes", () => {
    expect(countryName("")).toBe("");
    expect(countryName("XX")).toBe("");
    expect(countryName("USA")).toBe("");
  });
});

describe("stripAsn", () => {
  it("removes the leading ASN token from ipinfo org strings", () => {
    expect(stripAsn("AS15169 Google LLC")).toBe("Google LLC");
    expect(stripAsn("AS13335 Cloudflare, Inc.")).toBe("Cloudflare, Inc.");
  });
  it("leaves a plain org name untouched", () => {
    expect(stripAsn("Telkom SA Ltd")).toBe("Telkom SA Ltd");
    expect(stripAsn("")).toBe("");
  });
});

describe("normalizeIpinfo", () => {
  it("normalises a full entry", () => {
    expect(normalizeIpinfo({ ip: "8.8.8.8", hostname: "dns.google", country: "US", org: "AS15169 Google LLC" }))
      .toEqual({ cc: "US", country: "United States", org: "Google LLC", ptr: "dns.google" });
  });
  it("returns null for bogon (private/reserved) IPs", () => {
    expect(normalizeIpinfo({ ip: "10.0.0.1", bogon: true })).toBeNull();
  });
  it("returns null when there is no usable country code", () => {
    expect(normalizeIpinfo({ ip: "1.2.3.4" })).toBeNull();
    expect(normalizeIpinfo({ ip: "1.2.3.4", country: "" })).toBeNull();
    expect(normalizeIpinfo(null)).toBeNull();
  });
  it("tolerates a missing hostname or org", () => {
    expect(normalizeIpinfo({ country: "AU" })).toEqual({ cc: "AU", country: "Australia", org: "", ptr: "" });
  });
});
