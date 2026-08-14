import { NextResponse } from "next/server";
import { getIdentity, IdentityError } from "@/lib/auth";
import { uploadSchema } from "@/lib/validation";
import { db, ensureSchema } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/log";

export async function POST(req: Request) {
  try {
    const user = await getIdentity();
    const parsed = uploadSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    await ensureSchema();

    const ids = parsed.data.reports.map((r) => r.id);
    const existing = await db.report.findMany({ where: { id: { in: ids } }, select: { id: true } });
    const existingIds = new Set(existing.map((e) => e.id));

    // Dedupe against the DB and within the batch itself
    const seen = new Set<string>();
    const fresh = parsed.data.reports.filter((r) => {
      if (existingIds.has(r.id) || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    let added = 0;
    let skipped = ids.length - fresh.length;

    for (const r of fresh) {
      try {
        await db.report.create({
          data: {
            id: r.id, org: r.org, domain: r.domain,
            begin: new Date(r.begin), end: new Date(r.end),
            policyP: r.policyP ?? null, policySp: r.policySp ?? null, policyPct: r.policyPct ?? null,
            createdBy: user.email,
            rows: { create: r.rows },
          },
        });
        added++;
      } catch (e: unknown) {
        // P2002 = report already exists (race or ID collision) — skip it, don't fail the batch
        if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
          skipped++;
          continue;
        }
        throw e;
      }
    }

    log.info("report.upload", { user: user.email, attempted: ids.length, added, skipped });
    await writeAudit(user.email, "report.upload", { attempted: ids.length, added, skipped });
    return NextResponse.json({ added, skipped });
  } catch (e) {
    if (e instanceof IdentityError) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    log.error("reports.post.failed", { err: e });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}