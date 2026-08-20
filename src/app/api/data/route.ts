import { NextResponse } from "next/server";
import { getIdentity, IdentityError } from "@/lib/auth";
import { isEditor } from "@/lib/rbac";
import { db, ensureSchema } from "@/lib/db";
import { MANUAL_IPINFO } from "@/lib/dmarc";
import { log } from "@/lib/log";

export async function GET(req: Request) {
  try {
    const user = await getIdentity();
    await ensureSchema();

    // Default to a recent window so the payload stays small and fast; `days=all`
    // loads the full history on demand. The whole dataset grows ~5k rows/day, so
    // returning every row on every load doesn't scale.
    const daysParam = new URL(req.url).searchParams.get("days");
    const days = daysParam === "all" ? null : Math.min(Math.max(parseInt(daysParam ?? "30") || 30, 1), 3650);
    const cutoff = days === null ? null : new Date(Date.now() - days * 86_400_000);

    // Fetch the in-window reports first, then only their rows (the big table).
    const reports = await db.report.findMany({
      where: cutoff ? { begin: { gte: cutoff } } : undefined,
      select: { id: true, org: true, domain: true, begin: true, end: true, policyP: true, policySp: true, policyPct: true },
    });
    const reportIds = reports.map((r) => r.id);
    const [rows, ipInfoRows] = await Promise.all([
      db.reportRow.findMany({
        where: { reportId: { in: reportIds } },
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
      me: { email: user.email, editor: isEditor(user.email) },
      window: { days }, // null = full history
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