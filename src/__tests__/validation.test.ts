import { describe, it, expect } from "vitest";
import { enrichSchema, uploadSchema, parsedReportSchema, backupSchema, dnsCheckSchema } from "@/lib/validation";

describe("enrichSchema", () => {
  it("accepts valid IPs", () => {
    expect(enrichSchema.safeParse({ ips: ["209.85.167.71", "2a00:1450:4864:20::532"] }).success).toBe(true);
  });
  it("rejects non-IP strings", () => {
    expect(enrichSchema.safeParse({ ips: ["not-an-ip"] }).success).toBe(false);
  });
  it("rejects empty and oversized lists", () => {
    expect(enrichSchema.safeParse({ ips: [] }).success).toBe(false);
    expect(enrichSchema.safeParse({ ips: Array(1001).fill("1.1.1.1") }).success).toBe(false);
  });
  it("accepts a full batch of 1000", () => {
    expect(enrichSchema.safeParse({ ips: Array(1000).fill("1.1.1.1") }).success).toBe(true);
  });
});

describe("uploadSchema", () => {
  const validReport = {
    id: "r1", org: "google.com", domain: "spheredrones.com.au",
    begin: 1751241600000, end: 1751327999000,
    rows: [{
      sourceIp: "209.85.167.71", count: 5, disposition: "none",
      peDkim: "pass", peSpf: "pass", headerFrom: "spheredrones.com.au",
      spfRaw: true, dkimRaw: true, spfDom: "", dkimDom: "", sel: "", reasons: [],
    }],
  };
  it("accepts a valid parsed report", () => {
    expect(uploadSchema.safeParse({ reports: [validReport] }).success).toBe(true);
  });
  it("rejects an empty report list", () => {
    expect(uploadSchema.safeParse({ reports: [] }).success).toBe(false);
  });
  it("rejects a negative message count", () => {
    const bad = { ...validReport, rows: [{ ...validReport.rows[0], count: -1 }] };
    expect(parsedReportSchema.safeParse(bad).success).toBe(false);
  });
  it("coerces an unknown disposition to none rather than rejecting", () => {
    const odd = { ...validReport, rows: [{ ...validReport.rows[0], disposition: "weird" }] };
    const out = parsedReportSchema.safeParse(odd);
    expect(out.success).toBe(true);
    if (out.success) expect(out.data.rows[0].disposition).toBe("none");
  });
  it("accepts policyPct as the raw string extracted from the XML pct= tag", () => {
    expect(parsedReportSchema.safeParse({ ...validReport, policyPct: "100" }).success).toBe(true);
  });
  it("rejects a numeric policyPct — the DB column and the report parser both use strings", () => {
    expect(parsedReportSchema.safeParse({ ...validReport, policyPct: 100 }).success).toBe(false);
  });
});

describe("backupSchema", () => {
  it("accepts a legacy backup with loosely-shaped rows and ipInfo", () => {
    const backup = {
      rows: [{ reportId: "r1", sourceIp: "209.85.167.71", org: "google.com", policyDomain: "spheredrones.com.au" }],
      ipInfo: { "209.85.167.71": { org: "Google LLC", country: "United States", cc: "US" } },
    };
    expect(backupSchema.safeParse(backup).success).toBe(true);
  });
  it("accepts a backup with no ipInfo section", () => {
    expect(backupSchema.safeParse({ rows: [{ reportId: "r1" }] }).success).toBe(true);
  });
  it("rejects an empty row list", () => {
    expect(backupSchema.safeParse({ rows: [] }).success).toBe(false);
  });
  it("rejects an ipInfo section that isn't a map of objects", () => {
    expect(backupSchema.safeParse({ rows: [{ reportId: "r1" }], ipInfo: { "1.1.1.1": "not-an-object" } }).success).toBe(false);
  });
});

describe("dnsCheckSchema", () => {
  it("accepts observed selectors per domain, and an empty body", () => {
    expect(dnsCheckSchema.safeParse({ selectors: { "spheredrones.com.au": ["google", "s2048.dkim"] } }).success).toBe(true);
    expect(dnsCheckSchema.safeParse({}).success).toBe(true);
  });
  it("rejects selector names that aren't valid DNS labels", () => {
    expect(dnsCheckSchema.safeParse({ selectors: { "d.com": ["bad selector!"] } }).success).toBe(false);
    expect(dnsCheckSchema.safeParse({ selectors: { "d.com": ["-leadinghyphen"] } }).success).toBe(false);
  });
  it("rejects oversized selector lists and domain maps", () => {
    expect(dnsCheckSchema.safeParse({ selectors: { "d.com": Array(21).fill("s1") } }).success).toBe(false);
    const many = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`d${i}.com`, ["s1"]]));
    expect(dnsCheckSchema.safeParse({ selectors: many }).success).toBe(false);
  });
});