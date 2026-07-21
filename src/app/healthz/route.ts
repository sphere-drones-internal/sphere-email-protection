import { NextResponse } from "next/server";

// Liveness: "the process is up". MUST NOT touch the DB or any dependency — the
// platform probes this during a no-DB build-verify. Readiness lives in /readyz.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true });
}
