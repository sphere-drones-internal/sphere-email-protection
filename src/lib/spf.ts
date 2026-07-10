// RFC 7208 §4.6.4 — SPF evaluation may use at most 10 DNS lookups. Each
// include, a, mx, ptr, exists mechanism and the redirect modifier costs one,
// recursively through included records; ip4/ip6/all/exp cost nothing. Going
// over the limit is a permerror at the receiver — effectively an SPF fail.

export type SpfTerms = { lookupTerms: number; targets: string[] };

const LOOKUP_MECH = /^[+\-~?]?(include|a|mx|ptr|exists)(?=[:/]|$)/;

// Counts the lookup-costing terms in a single SPF record and extracts the
// domains whose records must also be counted (include/redirect targets).
// Targets containing macros (%{...}) can't be resolved statically — they still
// cost a lookup but are not returned for recursion.
export function spfTerms(record: string): SpfTerms {
  let lookupTerms = 0;
  const targets: string[] = [];
  for (const raw of record.trim().split(/\s+/).slice(1)) {
    const term = raw.toLowerCase();
    const mech = term.match(LOOKUP_MECH)?.[1];
    const redirect = term.startsWith("redirect=");
    if (!mech && !redirect) continue;
    lookupTerms++;
    const target = redirect
      ? term.slice("redirect=".length)
      : mech === "include" && term.includes(":") ? term.slice(term.indexOf(":") + 1) : "";
    if (target && !target.includes("%")) targets.push(target);
  }
  return { lookupTerms, targets };
}

// Stop counting well past the limit — beyond this the exact number no longer matters.
export const SPF_COUNT_CAP = 15;
