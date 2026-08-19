import { NextResponse } from "next/server";
import { getIdentity, IdentityError } from "@/lib/auth";
import { isEditor } from "@/lib/rbac";
import { uploadSchema } from "@/lib/validation";
import { ensureSchema } from "@/lib/db";
import { ingestReports } from "@/lib/reports";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/log";

export async function POST(req: Request) {
  try {
    const user = await getIdentity();
    if (!isEditor(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = uploadSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    await ensureSchema();

    const { added, skipped } = await ingestReports(parsed.data.reports, user.email);

    log.info("report.upload", { user: user.email, attempted: parsed.data.reports.length, added, skipped });
    await writeAudit(user.email, "report.upload", { attempted: parsed.data.reports.length, added, skipped });
    return NextResponse.json({ added, skipped });
  } catch (e) {
    if (e instanceof IdentityError) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    log.error("reports.post.failed", { err: e });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}