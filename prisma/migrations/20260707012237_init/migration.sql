-- CreateTable
CREATE TABLE "reports" (
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
);

-- CreateTable
CREATE TABLE "report_rows" (
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
);

-- CreateTable
CREATE TABLE "ip_info" (
    "ip" TEXT NOT NULL,
    "org" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "cc" TEXT NOT NULL DEFAULT '',
    "service" TEXT NOT NULL DEFAULT '',
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ip_info_pkey" PRIMARY KEY ("ip")
);

-- CreateTable
CREATE TABLE "published_records" (
    "domain" TEXT NOT NULL,
    "dmarc" TEXT,
    "bimi" TEXT,
    "recorded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "published_records_pkey" PRIMARY KEY ("domain")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB NOT NULL,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_domain_begin_idx" ON "reports"("domain", "begin");

-- CreateIndex
CREATE INDEX "report_rows_reportId_idx" ON "report_rows"("reportId");

-- CreateIndex
CREATE INDEX "report_rows_sourceIp_idx" ON "report_rows"("sourceIp");

-- CreateIndex
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");

-- AddForeignKey
ALTER TABLE "report_rows" ADD CONSTRAINT "report_rows_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
