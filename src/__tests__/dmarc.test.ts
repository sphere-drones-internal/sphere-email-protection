import { describe, it, expect } from "vitest";
import { classifyRow, reportIdFor, fixHint } from "@/lib/dmarc";

const base = { peDkim: "fail", peSpf: "fail", reasons: [] as string[], spfRaw: false, dkimRaw: false };

describe("classifyRow", () => {
  it("aligned pass on either mechanism → compliant", () => {
    expect(classifyRow({ ...base, peDkim: "pass" })).toBe("compliant");
    expect(classifyRow({ ...base, peSpf: "pass" })).toBe("compliant");
  });
  it("forwarding override reasons → forwarded", () => {
    expect(classifyRow({ ...base, reasons: ["forwarded"] })).toBe("forwarded");
    expect(classifyRow({ ...base, reasons: ["mailing_list"] })).toBe("forwarded");
  });
  it("raw auth without alignment → noncompliant", () => {
    expect(classifyRow({ ...base, dkimRaw: true })).toBe("noncompliant");
    expect(classifyRow({ ...base, spfRaw: true })).toBe("noncompliant");
  });
  it("no auth at all → threat", () => {
    expect(classifyRow(base)).toBe("threat");
  });
});

describe("reportIdFor", () => {
  it("uses the reporter's id when present", () => {
    expect(reportIdFor("abc123", "google.com", "d.com", 1, 2)).toBe("abc123");
  });
  it("falls back to org|domain|begin|end when missing", () => {
    expect(reportIdFor("", "google.com", "d.com", 1, 2)).toBe("google.com|d.com|1|2");
  });
});

describe("fixHint", () => {
  it("is null when anything aligns", () => {
    expect(fixHint({ dkimRaw: 5, spfRaw: 0, dkimAlign: 5, spfAlign: 0 })).toBeNull();
  });
  it("suggests DKIM CNAME when only DKIM authenticates", () => {
    expect(fixHint({ dkimRaw: 5, spfRaw: 0, dkimAlign: 0, spfAlign: 0 })).toMatch(/custom DKIM/i);
  });
  it("suggests return-path when only SPF authenticates", () => {
    expect(fixHint({ dkimRaw: 0, spfRaw: 5, dkimAlign: 0, spfAlign: 0 })).toMatch(/return-path/i);
  });
  it("flags spoofing shape when nothing authenticates", () => {
    expect(fixHint({ dkimRaw: 0, spfRaw: 0, dkimAlign: 0, spfAlign: 0 })).toMatch(/spoofing/i);
  });
});