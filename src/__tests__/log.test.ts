import { describe, it, expect, vi, afterEach } from "vitest";
import { log } from "@/lib/log";

afterEach(() => vi.restoreAllMocks());

describe("structured logger", () => {
  it("emits one parseable JSON line with level, event, ts and context", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("report.upload", { user: "a@b.com", added: 3 });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({ level: "info", event: "report.upload", user: "a@b.com", added: 3 });
    expect(typeof line.ts).toBe("string");
  });

  it("serialises Errors to { name, message } and never leaks a stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");
    log.error("data.get.failed", { err });
    const raw = spy.mock.calls[0][0] as string;
    expect(raw).not.toContain("stack");
    expect(raw).not.toMatch(/at .*\.ts:/); // no stack frames
    expect(JSON.parse(raw).err).toEqual({ name: "Error", message: "boom" });
  });

  it("routes warn to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    log.warn("enrich.token.missing");
    expect(JSON.parse(spy.mock.calls[0][0] as string).level).toBe("warn");
  });
});
