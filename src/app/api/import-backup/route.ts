import { NextResponse } from "next/server";
import { getIdentity, IdentityError } from "@/lib/auth";
import { isEditor } from "@/lib/rbac";
import { backupSchema } from "@/lib/validation";
import { db, ensureSchema } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/log";

type LegacyRow = Record<string, unknown>;

function normaliseRow(r: LegacyRow) {
  const authDkim = (r.authDkim as { domain?: string; result?: string; selector?: string }[] | undefined) ?? null;
  const authSpf = (r.authSpf as { domain?: string; result?: string }[] | undefined) ?? null;
  const dkimPass = authDkim?.find((d) => d.result === "pass") ?? authDkim?.[0];
  return {
    reportId: String(r.reportId ?? ""),
    org: String(r.org ?? ""),
    domain: String(r.policyDomain ?? r.headerFrom ?? ""),
    begin: Number(r.begin ?? 0),
    end: Number(r.end ?? 0),
    row: {
      sourceIp: String(r.sourceIp ?? ""),
      count: Number(r.count ?? 0),
      disposition: String(r.disposition ?? "none"),
      peDkim: String(r.peDkim ?? ""),
      peSpf: String(r.peSpf ?? ""),
      headerFrom: String(r.headerFrom ?? ""),
      spfRaw: authSpf ? authSpf.some((s) => s.result === "pass") : Boolean(r.spfRaw),
      dkimRaw: authDkim ? authDkim.some((d) => d.result === "pass") : Boolean(r.dkimRaw),
      spfDom: authSpf ? (authSpf.find((s) => s.result === "pass")?.domain ?? authSpf[0]?.domain ?? "") : String(r.spfDom ?? ""),
      dkimDom: authDkim ? (dkimPass?.domain ?? "") : String(r.dkimDom ?? ""),
      sel: authDkim ? (dkimPass?.selector ?? "") : String(r.sel ?? ""),
      reasons: Array.isArray(r.reasons) ? (r.reasons as string[]).slice(0, 10) : [],
    },
  };
}

export async function POST(req: Request) {
  try {
    const user = await getIdentity();
    if (!isEditor(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = backupSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    await ensureSchema();

    const rows = parsed.data.rows.map(normaliseRow).filter((r) => r.reportId && r.row.sourceIp);

    const byReport = new Map<string, ReturnType<typeof normaliseRow>[]>();
    for (const r of rows) {
      if (!byReport.has(r.reportId)) byReport.set(r.reportId, []);
      byReport.get(r.reportId)!.push(r);
    }

    const existing = await db.report.findMany({ where: { id: { in: [...byReport.keys()] } }, select: { id: true } });
    const existingIds = new Set(existing.map((e) => e.id));

    let added = 0;
    for (const [id, group] of byReport) {
      if (existingIds.has(id)) continue;
      const first = group[0];
      await db.report.create({
        data: {
          id, org: first.org, domain: first.domain,
          begin: new Date(first.begin || Date.now()), end: new Date(first.end || Date.now()),
          createdBy: user.email,
          rows: { create: group.map((g) => g.row) },
        },
      });
      added++;
    }

    // carry the artifact's cached IP enrichment across
    let ipUpserts = 0;
    if (parsed.data.ipInfo) {
      const entries = Object.entries(parsed.data.ipInfo).slice(0, 5000) as [string, { org?: string; country?: string; cc?: string; service?: string }][];
      for (const [ip, v] of entries) {
        if (!ip || typeof v !== "object" || v === null) continue;
        await db.ipInfo.upsert({
          where: { ip },
          create: { ip, org: v.org ?? "", country: v.country ?? "", cc: v.cc ?? "", service: v.service ?? "" },
          update: {},  // never overwrite existing app data from a backup
        });
        ipUpserts++;
      }
    }

    log.info("backup.import", { user: user.email, added, skipped: byReport.size - added, ipInfoSeeded: ipUpserts });
    await writeAudit(user.email, "backup.import", { reportsAdded: added, reportsSkipped: byReport.size - added, ipInfoSeeded: ipUpserts });
    return NextResponse.json({ added, skipped: byReport.size - added });
  } catch (e) {
    if (e instanceof IdentityError) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    log.error("import.failed", { err: e });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}