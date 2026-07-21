import { NextResponse } from "next/server";
import { getIdentity, IdentityError } from "@/lib/auth";
import { dnsCheckSchema } from "@/lib/validation";
import { spfTerms, SPF_COUNT_CAP } from "@/lib/spf";
import { Resolver } from "node:dns/promises";

const DOMAINS = [
  "spheregroup.com.au",
  "spheredrones.com.au",
  "curouav.com",
  "sidero.com.au",
  "parisradio.com.au",
];

const resolver = new Resolver();
resolver.setServers(["1.1.1.1", "8.8.8.8"]); // public resolvers, not corp DNS — see the live records the world sees

async function txt(name: string): Promise<string[]> {
  try {
    const records = await resolver.resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  } catch {
    return []; // NXDOMAIN / no TXT = empty, not an error
  }
}

function parseDmarc(records: string[]) {
  const rec = records.find((r) => r.toLowerCase().startsWith("v=dmarc1"));
  if (!rec) return { present: false as const };
  const tags = Object.fromEntries(
    rec.split(";").map((p) => p.trim().split("=").map((s) => s.trim())).filter((p) => p.length === 2)
  );
  return {
    present: true as const,
    raw: rec,
    p: tags.p ?? null,
    sp: tags.sp ?? null,
    pct: tags.pct ? Number(tags.pct) : 100,
    rua: tags.rua ?? null,
  };
}

// Walks the include/redirect tree counting DNS lookups against the RFC 7208
// limit of 10. Caps at SPF_COUNT_CAP with cycle protection — past the limit the
// exact number stops mattering.
async function spfLookupCount(record: string): Promise<number> {
  const seen = new Set<string>();
  let count = 0;
  const walk = async (rec: string): Promise<void> => {
    const { lookupTerms, targets } = spfTerms(rec);
    count += lookupTerms;
    for (const target of targets) {
      if (count >= SPF_COUNT_CAP || seen.has(target) || seen.size >= SPF_COUNT_CAP) continue;
      seen.add(target);
      const sub = (await txt(target)).find((r) => r.toLowerCase().startsWith("v=spf1"));
      if (sub) await walk(sub);
    }
  };
  await walk(record);
  return Math.min(count, SPF_COUNT_CAP);
}

// DKIM has no fixed record name — keys live at <selector>._domainkey.<domain>.
// Probe the selectors major providers use, plus any observed in report data.
const COMMON_DKIM_SELECTORS = ["google", "selector1", "selector2", "k1", "s1", "s2", "default", "mail"];

async function dkimSelectors(domain: string, observed: string[]): Promise<{ found: string[]; checked: number }> {
  const names = [...new Set([...COMMON_DKIM_SELECTORS, ...observed])];
  const results = await Promise.all(
    names.map(async (sel) => {
      const records = await txt(`${sel}._domainkey.${domain}`);
      return /v=dkim1|p=/i.test(records.join(" ")) ? sel : null;
    })
  );
  return { found: results.filter((s): s is string => s !== null).sort(), checked: names.length };
}

async function runChecks(observedSelectors: Record<string, string[]>) {
  return Promise.all(
    DOMAINS.map(async (domain) => {
      const [dmarcTxt, rootTxt, bimiTxt, dkim] = await Promise.all([
        txt(`_dmarc.${domain}`),
        txt(domain),
        txt(`default._bimi.${domain}`),
        dkimSelectors(domain, observedSelectors[domain] ?? []),
      ]);
      const spf = rootTxt.find((r) => r.toLowerCase().startsWith("v=spf1")) ?? null;
      return {
        domain,
        dmarc: parseDmarc(dmarcTxt),
        spf,
        spfLookups: spf ? await spfLookupCount(spf) : null,
        bimi: bimiTxt.find((r) => r.toLowerCase().startsWith("v=bimi1")) ?? null,
        dkim: dkim.found,
        dkimChecked: dkim.checked,
        checkedAt: new Date().toISOString(),
      };
    })
  );
}

export async function GET() {
  try {
    await getIdentity();
    return NextResponse.json({ results: await runChecks({}) });
  } catch (e) {
    if (e instanceof IdentityError) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    console.error("dns GET failed", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await getIdentity();
    const parsed = dnsCheckSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return NextResponse.json({ results: await runChecks(parsed.data.selectors ?? {}) });
  } catch (e) {
    if (e instanceof IdentityError) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    console.error("dns POST failed", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}