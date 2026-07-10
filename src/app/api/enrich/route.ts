import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { enrichSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { OVERRIDES } from "@/lib/ip-overrides";
import { writeAudit } from "@/lib/audit";
import { normalizeIpinfo, type GeoResult, type IpinfoEntry } from "@/lib/geo";

// Resolves country/org/hostname for many IPs at once via ipinfo.io's batch
// endpoint (up to 1000 per call). IPs that fail or come back unusable are simply
// absent from the returned map — the caller leaves them uncached and retryable.
async function lookupBatch(ips: string[]): Promise<Map<string, GeoResult>> {
  const out = new Map<string, GeoResult>();
  if (!ips.length) return out;
  const token = process.env.IPINFO_TOKEN;
  if (!token) {
    console.error("IPINFO_TOKEN is not set — geo enrichment is disabled until it is configured");
    return out;
  }
  for (let i = 0; i < ips.length; i += 1000) {
    const chunk = ips.slice(i, i + 1000);
    try {
      const res = await fetch(`https://ipinfo.io/batch?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) continue; // 429/auth failure → leave this chunk for a later retry
      const data = (await res.json()) as Record<string, IpinfoEntry>;
      for (const [ip, entry] of Object.entries(data)) {
        const g = normalizeIpinfo(entry);
        if (g) out.set(ip, g);
      }
    } catch (e) {
      console.error("ipinfo batch lookup failed", e);
    }
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = enrichSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const ips = [...new Set(parsed.data.ips)];

    const cached = await db.ipInfo.findMany({ where: { ip: { in: ips } } });
    const cachedMap = new Map(cached.map((c) => [c.ip, c]));
    // Enrich IPs that are absent, plus cached non-manual rows whose geo lookup
    // previously failed (empty cc) — those are retried until they resolve.
    const toEnrich = ips.filter((ip) => {
      const c = cachedMap.get(ip);
      return !c || (!c.manual && !c.cc);
    });

    let enriched = 0, failed = 0;

    // Built-in overrides are authoritative and need no network call.
    const lookups: string[] = [];
    for (const ip of toEnrich) {
      const override = OVERRIDES[ip];
      if (override) {
        const saved = await db.ipInfo.upsert({
          where: { ip },
          create: { ip, ...override, ptr: "", manual: true },
          update: { ...override, manual: true },
        });
        cachedMap.set(ip, saved);
        enriched++;
      } else {
        lookups.push(ip);
      }
    }

    const geoMap = await lookupBatch(lookups);
    for (const ip of lookups) {
      const g = geoMap.get(ip);
      if (!g) { failed++; continue; } // leave uncached/unchanged so it retries next run
      const data = { ip, org: g.org, country: g.country, cc: g.cc, service: "", ptr: g.ptr, manual: false };
      const saved = await db.ipInfo.upsert({ where: { ip }, create: data, update: data });
      cachedMap.set(ip, saved);
      enriched++;
    }

    if (toEnrich.length) await writeAudit(user.email, "ipinfo.enrich", { requested: ips.length, enriched, failed });

    return NextResponse.json({
      results: ips.map((ip) => {
        const e = cachedMap.get(ip);
        if (!e) return { ip, org: "", country: "", cc: "", service: "", ptr: "", manual: false };
        return { ip, org: e.org, country: e.country, cc: e.cc, service: e.service, ptr: e.ptr, manual: e.manual };
      }),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("enrich POST failed", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}