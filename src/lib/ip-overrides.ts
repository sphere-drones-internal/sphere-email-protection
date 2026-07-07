// Manually verified IP identities — authoritative, applied before any lookup.
type OverrideEntry = { org: string; country: string; cc: string; service: string };

export const OVERRIDES: Record<string, OverrideEntry> = {
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