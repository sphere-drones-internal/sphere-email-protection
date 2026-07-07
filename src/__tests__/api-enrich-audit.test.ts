import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireUser: vi.fn().mockResolvedValue({ id: "u1", email: "josh@spheregroup.com.au" }) };
});

vi.mock("node:dns/promises", () => ({ reverse: vi.fn().mockRejectedValue(new Error("no PTR")) }));

vi.mock("@/lib/db", () => ({
  db: {
    ipInfo: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve(create)),
    },
  },
}));

const { writeAudit } = vi.hoisted(() => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/audit", () => ({ writeAudit }));

import { POST as enrichPost } from "@/app/api/enrich/route";

beforeEach(() => {
  writeAudit.mockClear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
});

// The audit log records who enriched which IPs — without it, ipInfo mutations
// were invisible in the audit_log table, unlike report.upload and backup.import.
describe("POST /api/enrich audit logging", () => {
  it("writes an ipinfo.enrich audit entry when new IPs are looked up", async () => {
    const req = new Request("http://localhost/api/enrich", {
      method: "POST",
      body: JSON.stringify({ ips: ["209.85.167.71"] }),
    });
    const res = await enrichPost(req);
    expect(res.status).toBe(200);
    expect(writeAudit).toHaveBeenCalledWith("josh@spheregroup.com.au", "ipinfo.enrich", { requested: 1, enriched: 1 });
  });
});
