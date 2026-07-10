import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireUser: vi.fn().mockResolvedValue({ id: "u1", email: "josh@spheregroup.com.au" }) };
});

const { findMany, upsert } = vi.hoisted(() => ({
  findMany: vi.fn().mockResolvedValue([]),
  upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve(create)),
}));
vi.mock("@/lib/db", () => ({ db: { ipInfo: { findMany, upsert } } }));

const { writeAudit } = vi.hoisted(() => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/audit", () => ({ writeAudit }));

import { POST as enrichPost } from "@/app/api/enrich/route";

const call = (ips: string[]) => enrichPost(new Request("http://localhost/api/enrich", { method: "POST", body: JSON.stringify({ ips }) }));
// ipinfo /batch returns an object keyed by IP
const batchOk = (map: Record<string, unknown>) => vi.fn().mockResolvedValue({ ok: true, json: async () => map });

beforeEach(() => {
  process.env.IPINFO_TOKEN = "test-token";
  writeAudit.mockClear();
  findMany.mockClear().mockResolvedValue([]);
  upsert.mockClear().mockImplementation(({ create }) => Promise.resolve(create));
});

describe("POST /api/enrich audit logging", () => {
  it("records who enriched and how many resolved vs failed", async () => {
    // 209.85.167.71 is a built-in override → resolves without a network call
    vi.stubGlobal("fetch", batchOk({}));
    const res = await call(["209.85.167.71"]);
    expect(res.status).toBe(200);
    expect(writeAudit).toHaveBeenCalledWith("josh@spheregroup.com.au", "ipinfo.enrich", { requested: 1, enriched: 1, failed: 0 });
  });

  it("does not cache a lookup ipinfo couldn't resolve, so the IP stays retryable", async () => {
    vi.stubGlobal("fetch", batchOk({ "8.8.4.4": { ip: "8.8.4.4", bogon: false } })); // no country field
    const res = await call(["8.8.4.4"]);
    expect(res.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(writeAudit).toHaveBeenCalledWith("josh@spheregroup.com.au", "ipinfo.enrich", { requested: 1, enriched: 0, failed: 1 });
  });

  it("re-enriches a cached row whose geo previously came back empty", async () => {
    findMany.mockResolvedValue([{ ip: "8.8.4.4", org: "", country: "", cc: "", service: "", ptr: "", manual: false }]);
    vi.stubGlobal("fetch", batchOk({ "8.8.4.4": { ip: "8.8.4.4", hostname: "dns.google", country: "US", org: "AS15169 Google LLC" } }));
    const res = await call(["8.8.4.4"]);
    const body = await res.json();
    expect(upsert).toHaveBeenCalledTimes(1);
    // country name derived from code, ASN prefix stripped, hostname → ptr
    expect(upsert.mock.calls[0][0].create).toMatchObject({ cc: "US", country: "United States", org: "Google LLC", ptr: "dns.google" });
    expect(body.results[0]).toMatchObject({ ip: "8.8.4.4", cc: "US", country: "United States" });
  });

  it("skips a cached row that already has a country", async () => {
    findMany.mockResolvedValue([{ ip: "8.8.4.4", org: "Google", country: "United States", cc: "US", service: "", ptr: "", manual: false }]);
    const fetchSpy = batchOk({});
    vi.stubGlobal("fetch", fetchSpy);
    await call(["8.8.4.4"]);
    expect(upsert).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled(); // nothing to look up → no ipinfo call
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("marks everything failed (retryable) when no token is configured", async () => {
    delete process.env.IPINFO_TOKEN;
    const fetchSpy = batchOk({});
    vi.stubGlobal("fetch", fetchSpy);
    const res = await call(["8.8.4.4"]);
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(writeAudit).toHaveBeenCalledWith("josh@spheregroup.com.au", "ipinfo.enrich", { requested: 1, enriched: 0, failed: 1 });
  });
});
