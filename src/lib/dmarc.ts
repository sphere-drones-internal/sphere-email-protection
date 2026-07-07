export type TrimmedRow = {
  sourceIp: string;
  count: number;
  disposition: string;
  peDkim: string;
  peSpf: string;
  headerFrom: string;
  spfRaw: boolean;
  dkimRaw: boolean;
  spfDom: string;
  dkimDom: string;
  sel: string;
  reasons: string[];
};

export type ParsedReport = {
  id: string;
  org: string;
  domain: string;
  begin: number;
  end: number;
  policyP?: string;
  policySp?: string;
  policyPct?: string;
  rows: TrimmedRow[];
};

export const FWD_REASONS = ["forwarded", "mailing_list", "arc", "trusted_forwarder"] as const;

export type RowCategory = "compliant" | "noncompliant" | "threat" | "forwarded";

export function classifyRow(r: Pick<TrimmedRow, "peDkim" | "peSpf" | "reasons" | "spfRaw" | "dkimRaw">): RowCategory {
  const pass = r.peDkim === "pass" || r.peSpf === "pass";
  if (pass) return "compliant";
  if ((r.reasons ?? []).some((x) => (FWD_REASONS as readonly string[]).includes(x))) return "forwarded";
  return r.spfRaw || r.dkimRaw ? "noncompliant" : "threat";
}

export function reportIdFor(reportId: string, org: string, domain: string, begin: number, end: number): string {
  return reportId || `${org}|${domain}|${begin}|${end}`;
}

export function fixHint(ip: { dkimRaw: number; spfRaw: number; dkimAlign: number; spfAlign: number }): string | null {
  if (ip.dkimAlign > 0 || ip.spfAlign > 0) return null;
  const dkim = ip.dkimRaw > 0, spf = ip.spfRaw > 0;
  if (dkim && !spf) return "DKIM signs but on the provider's domain — enable custom DKIM signing (usually a CNAME) so d= matches your domain.";
  if (spf && !dkim) return "SPF passes on the provider's bounce domain only — configure a custom return-path subdomain, and enable DKIM signing on your domain.";
  if (spf && dkim) return "Both authenticate but neither aligns — enable custom DKIM signing and a custom return-path on this provider.";
  return "Not authenticating at all — if this is a legitimate sender, add it to SPF and set up DKIM; if unrecognised, treat as spoofing.";
}

// Manually verified IP identities — authoritative, never overwritten by enrichment.
export const MANUAL_IPINFO: Record<string, { org: string; country: string; cc: string; service: string }> = {
  "2a00:1450:4864:20::532": { org: "Google Ireland Limited", country: "Ireland", cc: "IE", service: "Google Workspace / Gmail" },
  "2a00:1450:4864:20::636": { org: "Google Ireland Limited", country: "Ireland", cc: "IE", service: "Google Workspace / Gmail" },
  "2a00:1450:4864:20::62e": { org: "Google Ireland Limited", country: "Ireland", cc: "IE", service: "Google Workspace / Gmail" },
  "209.85.167.71": { org: "Google LLC", country: "United States", cc: "US", service: "Google Workspace / Gmail" },
  "209.85.208.169": { org: "Google LLC", country: "United States", cc: "US", service: "Google Workspace / Gmail" },
  "209.85.167.44": { org: "Google LLC", country: "United States", cc: "US", service: "Google Workspace / Gmail" },
  "2607:f8b0:4864:20::1330": { org: "Google LLC", country: "United States", cc: "US", service: "Google Workspace / Gmail" },
  "98.98.171.56": { org: "Zenlayer Inc", country: "United States", cc: "US", service: "" },
  "35.229.44.52": { org: "Google Inc", country: "United States", cc: "US", service: "Google Cloud" },
  "141.98.10.149": { org: "UAB Host Baltic", country: "Lithuania", cc: "LT", service: "" },
  "34.90.93.22": { org: "Google Inc", country: "Netherlands", cc: "NL", service: "Google Cloud" },
  "2607:f8b0:4864:20::a2c": { org: "Google Inc", country: "United States", cc: "US", service: "Google Workspace / Gmail" },
  "2607:f8b0:4864:20::b130": { org: "Google Inc", country: "United States", cc: "US", service: "Google Workspace / Gmail" },
  "35.233.155.205": { org: "Google Inc", country: "United States", cc: "US", service: "Google Cloud" },
  "103.27.73.80": { org: "ServerFreak Technologies", country: "Malaysia", cc: "MY", service: "" },
  "103.52.147.60": { org: "PT Bandhawa Tri Tirta", country: "Indonesia", cc: "ID", service: "" },
  "57.103.77.135": { org: "Apple Distribution International Ltd.", country: "Ireland", cc: "IE", service: "Apple iCloud Mail" },
  "173.201.192.67": { org: "GoDaddy.com LLC", country: "United States", cc: "US", service: "GoDaddy Email" },
  "40.107.40.77": { org: "Microsoft Corporation", country: "United States", cc: "US", service: "Microsoft 365" },
  "103.168.172.192": { org: "Fastmail", country: "United States", cc: "US", service: "Fastmail" },
};