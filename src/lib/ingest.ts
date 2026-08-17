import { extractXml, parseReport } from "@/lib/dmarc-server";
import { ingestReports } from "@/lib/reports";
import { createGmailClient, gmailConfigFromEnv, type GmailClient } from "@/lib/gmail";
import { ensureSchema } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/log";
import type { ParsedReport } from "@/lib/dmarc";

export type IngestResult = { messages: number; reports: number; added: number; skipped: number; errors: number };

// Reports arrive continuously; a rolling window keeps each run cheap, and the
// report-ID dedupe in ingestReports() makes overlapping runs idempotent (so we
// need no "processed" tracking or mailbox mutation).
const QUERY = process.env.GMAIL_QUERY || "newer_than:3d has:attachment";

// Provenance stamped on reports pulled from the mailbox (reports.createdBy).
export const INGEST_IDENTITY = "gmail-ingest@spheredrones.com.au";

// Core flow with an injected client — the unit-testable seam.
export async function runIngestWith(gmail: GmailClient, createdBy: string): Promise<IngestResult> {
  const ids = await gmail.listMessageIds(QUERY);
  const parsed: ParsedReport[] = [];
  let errors = 0;

  for (const id of ids) {
    try {
      for (const att of await gmail.getAttachments(id)) {
        try {
          for (const xml of extractXml(att.data)) parsed.push(parseReport(xml));
        } catch (e) {
          errors++;
          log.warn("ingest.parse.failed", { messageId: id, filename: att.filename, err: e });
        }
      }
    } catch (e) {
      errors++;
      log.warn("ingest.message.failed", { messageId: id, err: e });
    }
  }

  const { added, skipped } = parsed.length ? await ingestReports(parsed, createdBy) : { added: 0, skipped: 0 };
  return { messages: ids.length, reports: parsed.length, added, skipped, errors };
}

// Builds the real Gmail client from env and runs a full ingest. Returns null when
// Gmail isn't configured (feature-flagged, like geo enrichment). `triggeredBy` is
// the scheduler or the user who pressed "Fetch now" — recorded in the audit.
export async function runIngest(triggeredBy = "scheduler"): Promise<IngestResult | null> {
  const cfg = gmailConfigFromEnv();
  if (!cfg) {
    log.warn("ingest.disabled", { detail: "Gmail credentials not configured (GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN)" });
    return null;
  }
  await ensureSchema();
  const result = await runIngestWith(createGmailClient(cfg), INGEST_IDENTITY);
  log.info("ingest.completed", { triggeredBy, ...result });
  await writeAudit(triggeredBy, "report.ingest", { ...result });
  return result;
}

// In-process hourly scheduler, started once at boot from instrumentation.ts.
// A no-op when Gmail isn't configured, so local dev without credentials is quiet.
let started = false;
export function startIngestScheduler() {
  if (started) return;
  // Production only — don't auto-poll the real mailbox from local `next dev`.
  // The manual "Fetch mail" button exercises the same path in dev.
  if (process.env.NODE_ENV !== "production") {
    log.info("ingest.scheduler.skipped", { detail: "not production" });
    return;
  }
  if (!gmailConfigFromEnv()) {
    log.info("ingest.scheduler.skipped", { detail: "Gmail credentials not configured" });
    return;
  }
  started = true;
  const INTERVAL_MS = 60 * 60 * 1000; // hourly
  const tick = () => void runIngest("scheduler").catch((e) => log.error("ingest.scheduler.failed", { err: e }));
  setTimeout(tick, 60_000).unref?.(); // first run ~1 min after boot, don't hold the event loop
  setInterval(tick, INTERVAL_MS).unref?.();
  log.info("ingest.scheduler.started", { intervalMs: INTERVAL_MS });
}
