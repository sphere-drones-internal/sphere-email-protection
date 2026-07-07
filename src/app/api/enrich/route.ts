import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { enrichSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { reverse } from "node:dns/promises";
import { OVERRIDES } from "@/lib/ip-overrides";
import { writeAudit } from "@/lib/audit";

async function ptr(ip: string): Promise<string> {
  try {
    const names = await reverse(ip);
    return names[0] ?? "";
  } catch {
    return "";
  }
}

async function geo(ip: string): Promise<{ country: string; cc: string; org: string }> {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "sphere-dmarc-app" },
    });
    if (!res.ok) return { country: "", cc: "", org: "" };
    const d = await res.json();
    return { country: d.country_name ?? "", cc: d.country_code ?? "", org: d.org ?? "" };
  } catch {
    return { country: "", cc: "", org: "" };
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = enrichSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const ips = [...new Set(parsed.data.ips)];

    const cached = await db.ipInfo.findMany({ where: { ip: { in: ips } } });
    const cachedMap = new Map(cached.map((c) => [c.ip, c]));
    // Manual rows are authoritative; only enrich IPs that are absent entirely
    const missing = ips.filter((ip) => !cachedMap.has(ip));

    for (const ip of missing) {
      const override = OVERRIDES[ip];
      const data = override
        ? { ip, ...override, ptr: "", manual: true }
        : await (async () => {
            const [ptrName, g] = await Promise.all([ptr(ip), geo(ip)]);
            return { ip, org: g.org, country: g.country, cc: g.cc, service: "", ptr: ptrName, manual: false };
          })();

      const saved = await db.ipInfo.upsert({
        where: { ip },
        create: data,
        update: data,
      });
      cachedMap.set(ip, saved);
    }

    if (missing.length) await writeAudit(user.email, "ipinfo.enrich", { requested: ips.length, enriched: missing.length });

    return NextResponse.json({
      results: ips.map((ip) => {
        const e = cachedMap.get(ip)!;
        return { ip, org: e.org, country: e.country, cc: e.cc, service: e.service, ptr: e.ptr, manual: e.manual };
      }),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("enrich POST failed", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}