import { z } from "zod";

export const enrichSchema = z.object({
  ips: z.array(z.union([z.ipv4(), z.ipv6()])).min(1).max(1000),
});

const rowSchema = z.object({
  sourceIp: z.union([z.ipv4(), z.ipv6()]),
  count: z.number().int().nonnegative(),
  disposition: z.enum(["none", "quarantine", "reject"]).catch("none"),
  peDkim: z.enum(["pass", "fail"]).catch("fail"),
  peSpf: z.enum(["pass", "fail"]).catch("fail"),
  headerFrom: z.string(),
  spfRaw: z.boolean(),
  dkimRaw: z.boolean(),
  spfDom: z.string(),
  dkimDom: z.string(),
  sel: z.string(),
  reasons: z.array(z.string()),
});

export const parsedReportSchema = z.object({
  id: z.string().min(1),
  org: z.string().min(1),
  domain: z.string().min(1),
  begin: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  policyP: z.enum(["none", "quarantine", "reject"]).optional(),
  policySp: z.enum(["none", "quarantine", "reject"]).optional(),
  policyPct: z.string().optional(),
  rows: z.array(rowSchema).min(1),
});

export const uploadSchema = z.object({
  reports: z.array(parsedReportSchema).min(1),
});

export const backupSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1),
  ipInfo: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

// Observed DKIM selectors per domain (from report data) to probe alongside the
// common ones. Only selector names are user-controlled — the route resolves them
// exclusively under its own fixed domain list, never under caller-supplied domains.
const dnsLabel = /^[a-z0-9]([a-z0-9._-]{0,61}[a-z0-9])?$/i;
export const dnsCheckSchema = z.object({
  selectors: z
    .record(z.string().max(253), z.array(z.string().regex(dnsLabel)).max(20))
    .refine((o) => Object.keys(o).length <= 20, "too many domains")
    .optional(),
});