import { describe, it, expect, vi } from "vitest";

// The platform authenticates upstream, but each route still fails closed if the
// forwarded identity is missing (a request that didn't come through the proxy).
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, getIdentity: vi.fn().mockRejectedValue(new actual.IdentityError()) };
});

import { GET as dataGet } from "@/app/api/data/route";
import { GET as dnsGet, POST as dnsPost } from "@/app/api/dns/route";
import { POST as enrichPost } from "@/app/api/enrich/route";
import { POST as importBackupPost } from "@/app/api/import-backup/route";
import { POST as reportsPost } from "@/app/api/reports/route";

const postReq = (url: string) => new Request(url, { method: "POST" });

describe("API routes fail closed without a forwarded identity", () => {
  it("GET /api/data → 401", async () => {
    expect((await dataGet()).status).toBe(401);
  });

  it("GET /api/dns → 401", async () => {
    expect((await dnsGet()).status).toBe(401);
  });

  it("POST /api/dns → 401", async () => {
    expect((await dnsPost(postReq("http://localhost/api/dns"))).status).toBe(401);
  });

  it("POST /api/enrich → 401", async () => {
    expect((await enrichPost(postReq("http://localhost/api/enrich"))).status).toBe(401);
  });

  it("POST /api/import-backup → 401", async () => {
    expect((await importBackupPost(postReq("http://localhost/api/import-backup"))).status).toBe(401);
  });

  it("POST /api/reports → 401", async () => {
    expect((await reportsPost(postReq("http://localhost/api/reports"))).status).toBe(401);
  });
});
