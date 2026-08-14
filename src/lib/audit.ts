import { db } from "@/lib/db";
import { log } from "@/lib/log";
import type { Prisma } from "@prisma/client";

export async function writeAudit(userEmail: string, action: string, detail: Prisma.InputJsonValue) {
  try {
    await db.auditLog.create({ data: { userEmail, action, detail } });
  } catch (e) {
    log.error("audit.write.failed", { action, user: userEmail, err: e }); // never let audit failure break the request
  }
}