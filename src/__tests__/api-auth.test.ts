import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireUser: vi.fn().mockRejectedValue(new actual.AuthError(401, "Unauthorised")),
  };
});

import { GET as dataGet } from "@/app/api/data/route";
import { GET as dnsGet } from "@/app/api/dns/route";
import { POST as enrichPost } from "@/app/api/enrich/route";
import { POST as importBackupPost } from "@/app/api/import-backup/route";
import { POST as reportsPost } from "@/app/api/reports/route";

const postReq = (url: string) => new Request(url, { method: "POST" });

// requireUser() runs before any body parsing or DB access in every route, so a
// rejection here must short-circuit straight to a 401 — this is the wiring that
// unit tests on evaluateAuth() alone can't catch.
describe("API routes reject unauthenticated requests", () => {
  it("GET /api/data returns 401 without a session", async () => {
    expect((await dataGet()).status).toBe(401);
  });

  it("GET /api/dns returns 401 without a session", async () => {
    expect((await dnsGet()).status).toBe(401);
  });

  it("POST /api/enrich returns 401 without a session", async () => {
    expect((await enrichPost(postReq("http://localhost/api/enrich"))).status).toBe(401);
  });

  it("POST /api/import-backup returns 401 without a session", async () => {
    expect((await importBackupPost(postReq("http://localhost/api/import-backup"))).status).toBe(401);
  });

  it("POST /api/reports returns 401 without a session", async () => {
    expect((await reportsPost(postReq("http://localhost/api/reports"))).status).toBe(401);
  });
});
