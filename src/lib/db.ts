import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; schemaReady?: Promise<void> };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// The platform provisions an EMPTY per-app Postgres and injects DATABASE_URL — it
// does NOT create our tables, and the Next standalone image can't run the Prisma
// CLI (its dep tree doesn't survive standalone). So we apply the full schema
// ourselves as idempotent DDL, memoised, and await it on every DB entry path
// before the first query. This mirrors prisma/migrations exactly (camelCase
// columns are quoted because that's how Prisma names them).
const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "reports" (
    "id" TEXT NOT NULL,
    "org" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "begin" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "policyP" TEXT,
    "policySp" TEXT,
    "policyPct" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "report_rows" (
    "id" BIGSERIAL NOT NULL,
    "reportId" TEXT NOT NULL,
    "sourceIp" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "disposition" TEXT NOT NULL,
    "peDkim" TEXT NOT NULL,
    "peSpf" TEXT NOT NULL,
    "headerFrom" TEXT NOT NULL,
    "spfRaw" BOOLEAN NOT NULL,
    "dkimRaw" BOOLEAN NOT NULL,
    "spfDom" TEXT NOT NULL DEFAULT '',
    "dkimDom" TEXT NOT NULL DEFAULT '',
    "sel" TEXT NOT NULL DEFAULT '',
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "report_rows_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "ip_info" (
    "ip" TEXT NOT NULL,
    "org" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "cc" TEXT NOT NULL DEFAULT '',
    "service" TEXT NOT NULL DEFAULT '',
    "ptr" TEXT NOT NULL DEFAULT '',
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ip_info_pkey" PRIMARY KEY ("ip")
  )`,
  `CREATE TABLE IF NOT EXISTS "published_records" (
    "domain" TEXT NOT NULL,
    "dmarc" TEXT,
    "bimi" TEXT,
    "recorded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "published_records_pkey" PRIMARY KEY ("domain")
  )`,
  `CREATE TABLE IF NOT EXISTS "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "reports_domain_begin_idx" ON "reports"("domain", "begin")`,
  `CREATE INDEX IF NOT EXISTS "report_rows_reportId_idx" ON "report_rows"("reportId")`,
  `CREATE INDEX IF NOT EXISTS "report_rows_sourceIp_idx" ON "report_rows"("sourceIp")`,
  `CREATE INDEX IF NOT EXISTS "audit_log_at_idx" ON "audit_log"("at")`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_rows_reportId_fkey') THEN
      ALTER TABLE "report_rows" ADD CONSTRAINT "report_rows_reportId_fkey"
        FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
];

export function ensureSchema(): Promise<void> {
  // Memoise on the global so it runs at most once per process (dev HMR included).
  globalForPrisma.schemaReady ??= (async () => {
    // Probe first: only an empty database needs the DDL. This makes ensureSchema
    // a no-op once the tables exist, so it neither needs CREATE privilege on every
    // boot nor errors against a restricted role whose tables are already present.
    const rows = await db.$queryRawUnsafe<{ present: boolean }[]>(
      `SELECT to_regclass('public.reports') IS NOT NULL AS present`
    );
    if (rows[0]?.present) return;
    for (const stmt of DDL) await db.$executeRawUnsafe(stmt);
  })();
  return globalForPrisma.schemaReady;
}
