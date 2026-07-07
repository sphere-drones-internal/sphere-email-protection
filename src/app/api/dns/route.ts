import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
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

export async function GET() {
  try {
    await requireUser();
    const results = await Promise.all(
      DOMAINS.map(async (domain) => {
        const [dmarcTxt, rootTxt, bimiTxt] = await Promise.all([
          txt(`_dmarc.${domain}`),
          txt(domain),
          txt(`default._bimi.${domain}`),
        ]);
        return {
          domain,
          dmarc: parseDmarc(dmarcTxt),
          spf: rootTxt.find((r) => r.toLowerCase().startsWith("v=spf1")) ?? null,
          bimi: bimiTxt.find((r) => r.toLowerCase().startsWith("v=bimi1")) ?? null,
          checkedAt: new Date().toISOString(),
        };
      })
    );
    return NextResponse.json({ results });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("dns GET failed", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}