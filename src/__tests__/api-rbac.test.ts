import { describe, it, expect, vi } from "vitest";

// A signed-in but non-editor identity (not on the EDITOR_EMAILS allowlist).
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, getIdentity: vi.fn().mockResolvedValue({ email: "viewer@spheregroup.com.au", username: "viewer" }) };
});

import { POST as reportsPost } from "@/app/api/reports/route";
import { POST as importPost } from "@/app/api/import-backup/route";
import { POST as ingestPost } from "@/app/api/ingest/route";
import { POST as enrichPost } from "@/app/api/enrich/route";

const post = (url: string) => new Request(url, { method: "POST", body: "{}" });

// Read-only users can view but not write — every mutating route rejects them
// with 403 before touching the body or the DB (server-side, not just hidden UI).
describe("write routes reject read-only users with 403", () => {
  it("POST /api/reports → 403", async () => {
    expect((await reportsPost(post("http://localhost/api/reports"))).status).toBe(403);
  });
  it("POST /api/import-backup → 403", async () => {
    expect((await importPost(post("http://localhost/api/import-backup"))).status).toBe(403);
  });
  it("POST /api/ingest → 403", async () => {
    expect((await ingestPost()).status).toBe(403);
  });
  it("POST /api/enrich → 403", async () => {
    expect((await enrichPost(post("http://localhost/api/enrich"))).status).toBe(403);
  });
});
