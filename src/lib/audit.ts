import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function writeAudit(userEmail: string, action: string, detail: Prisma.InputJsonValue) {
  try {
    await db.auditLog.create({ data: { userEmail, action, detail } });
  } catch (e) {
    console.error("audit write failed", e); // never let audit failure break the request
  }
}