import { NextResponse } from "next/server";
import { getIdentity, IdentityError } from "@/lib/auth";
import { db, ensureSchema } from "@/lib/db";
import { MANUAL_IPINFO } from "@/lib/dmarc";
import { log } from "@/lib/log";

export async function GET() {
  try {
    await getIdentity();
    await ensureSchema();
    const [reports, rows, ipInfoRows] = await Promise.all([
      db.report.findMany({
        select: { id: true, org: true, domain: true, begin: true, end: true, policyP: true, policySp: true, policyPct: true },
      }),
      db.reportRow.findMany({
        select: {
          reportId: true, sourceIp: true, count: true, disposition: true,
          peDkim: true, peSpf: true, headerFrom: true,
          spfRaw: true, dkimRaw: true, spfDom: true, dkimDom: true, sel: true, reasons: true,
        },
      }),
      db.ipInfo.findMany({
        select: { ip: true, org: true, country: true, cc: true, service: true, ptr: true },
      }),
    ]);
    const ipInfo: Record<string, { org: string; country: string; cc: string; service: string; ptr?: string }> = {};
    for (const r of ipInfoRows) ipInfo[r.ip] = { org: r.org, country: r.country, cc: r.cc, service: r.service, ptr: r.ptr };
    Object.assign(ipInfo, MANUAL_IPINFO); // manual overrides always win
    const reportMeta = Object.fromEntries(reports.map((r) => [r.id, { org: r.org, domain: r.domain, begin: r.begin.getTime(), end: r.end.getTime() }]));
    return NextResponse.json({
      reports: reports.map((r) => ({ ...r, begin: r.begin.getTime(), end: r.end.getTime() })),
      rows: rows.map((r) => {
        const meta = reportMeta[r.reportId];
        return { ...r, org: meta?.org ?? "", policyDomain: meta?.domain ?? "", begin: meta?.begin ?? 0, end: meta?.end ?? 0 };
      }),
      ipInfo,
    });
  } catch (e) {
    if (e instanceof IdentityError) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    log.error("data.get.failed", { err: e });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}