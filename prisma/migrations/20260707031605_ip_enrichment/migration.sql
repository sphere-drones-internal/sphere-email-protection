-- CreateTable
CREATE TABLE "IpEnrichment" (
    "ip" TEXT NOT NULL,
    "country" TEXT,
    "org" TEXT,
    "ptr" TEXT,
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IpEnrichment_pkey" PRIMARY KEY ("ip")
);
