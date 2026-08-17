import { db } from "@/lib/db";
import type { ParsedReport } from "@/lib/dmarc";

// Single insert path shared by the manual upload endpoint and the Gmail ingest
// job — so bulk ingestion runs through exactly the same dedupe/validation code
// as a single upload. Deduped by report ID against the DB and within the batch;
// a P2002 race is treated as a skip, never a batch failure. Idempotent, so
// re-processing the same reports is always safe.
export async function ingestReports(reports: ParsedReport[], createdBy: string): Promise<{ added: number; skipped: number }> {
  const ids = reports.map((r) => r.id);
  const existing = await db.report.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const existingIds = new Set(existing.map((e) => e.id));

  const seen = new Set<string>();
  const fresh = reports.filter((r) => {
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
          createdBy,
          rows: { create: r.rows },
        },
      });
      added++;
    } catch (e: unknown) {
      // P2002 = report already exists (race or ID collision) — skip, don't fail the batch.
      if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
        skipped++;
        continue;
      }
      throw e;
    }
  }

  return { added, skipped };
}
