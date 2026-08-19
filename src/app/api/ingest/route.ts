import { NextResponse } from "next/server";
import { getIdentity, IdentityError } from "@/lib/auth";
import { isEditor } from "@/lib/rbac";
import { runIngest } from "@/lib/ingest";
import { log } from "@/lib/log";

// Manual "Fetch from Gmail now" trigger. User-initiated, so Authentik gates it
// (getIdentity); the hourly automatic run comes from the in-process scheduler.
export async function POST() {
  try {
    const user = await getIdentity();
    if (!isEditor(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const result = await runIngest(user.email);
    if (!result) return NextResponse.json({ error: "Gmail ingestion is not configured" }, { status: 503 });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof IdentityError) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    log.error("ingest.post.failed", { err: e });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
