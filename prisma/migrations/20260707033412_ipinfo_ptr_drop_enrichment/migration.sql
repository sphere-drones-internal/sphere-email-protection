/*
  Warnings:

  - You are about to drop the `IpEnrichment` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "ip_info" ADD COLUMN     "ptr" TEXT NOT NULL DEFAULT '';

-- DropTable
DROP TABLE "IpEnrichment";
