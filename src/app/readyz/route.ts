import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Readiness: "ready to serve real traffic". Cheap dependency check — returns 503
// until Postgres is reachable, so a misconfigured deploy is caught as not-ready
// rather than serving green-but-broken.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "database unreachable" }, { status: 503 });
  }
}
