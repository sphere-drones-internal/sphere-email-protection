// Normalisation for ipinfo.io responses. ipinfo returns the country as an ISO
// 3166-1 alpha-2 code only (e.g. "US") and org as "AS15169 Google LLC", so we
// derive the full country name and strip the ASN prefix here. Kept pure and
// dependency-free (country names come from the built-in Intl data) so it's testable.

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(cc: string): string {
  if (!cc || cc.length !== 2) return "";
  try {
    const name = regionNames.of(cc.toUpperCase());
    return name && name !== cc.toUpperCase() ? name : "";
  } catch {
    return "";
  }
}

export function stripAsn(org: string): string {
  return org.replace(/^AS\d+\s+/i, "").trim();
}

export type IpinfoEntry = {
  ip?: string;
  hostname?: string;
  country?: string;
  org?: string;
  bogon?: boolean;
};

export type GeoResult = { cc: string; country: string; org: string; ptr: string };

// Returns null for anything that isn't a usable geo result — a bogon
// (private/reserved) IP or a missing country — so the caller leaves it
// uncached and retryable rather than storing a permanent empty.
export function normalizeIpinfo(e: IpinfoEntry | undefined | null): GeoResult | null {
  if (!e || e.bogon) return null;
  const cc = (e.country ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  return { cc, country: countryName(cc), org: stripAsn(e.org ?? ""), ptr: e.hostname ?? "" };
}
