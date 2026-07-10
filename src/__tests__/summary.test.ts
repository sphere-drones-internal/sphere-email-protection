import { describe, it, expect } from "vitest";
import { buildOverview, type OverviewInput } from "@/lib/summary";

const base: OverviewInput = {
  total: 10000,
  dmarcRate: 99,
  misaligned: 50,
  trend: {
    hasPrev: true,
    thisWeek: { vol: 2500, rate: 99 },
    prevWeek: { vol: 2400, rate: 99 },
    thisThreat: 0,
    prevThreat: 0,
  },
  dnsActionCount: 0,
  dnsLive: true,
};

describe("buildOverview", () => {
  it("reads as all-clear when everything is healthy and steady", () => {
    const o = buildOverview(base);
    expect(o).toContain("in good shape");
    expect(o).toContain("in line with the usual trend");
    expect(o).toContain("No unauthenticated");
    expect(o).toContain("DNS records check out");
  });

  it("handles the no-data case", () => {
    expect(buildOverview({ ...base, total: 0 })).toContain("No report data loaded yet");
  });

  it("flags a spike in unauthenticated mail", () => {
    const o = buildOverview({ ...base, trend: { ...base.trend, thisThreat: 120, prevThreat: 20 } });
    expect(o).toContain("spike in unauthenticated");
    expect(o).toContain("120");
    expect(o).toContain("20");
  });

  it("does not call steady threat volume a spike", () => {
    const o = buildOverview({ ...base, trend: { ...base.trend, thisThreat: 22, prevThreat: 20 } });
    expect(o).not.toContain("spike in unauthenticated");
    expect(o).toContain("similar to last week");
  });

  it("flags a falling pass rate", () => {
    const o = buildOverview({ ...base, trend: { ...base.trend, thisWeek: { vol: 2500, rate: 91 }, prevWeek: { vol: 2400, rate: 99 } } });
    expect(o).toContain("down 8 points");
    expect(o).toContain("worth investigating");
  });

  it("flags a volume spike", () => {
    const o = buildOverview({ ...base, trend: { ...base.trend, thisWeek: { vol: 6000, rate: 99 } } });
    expect(o).toContain("spiked");
  });

  it("skips the trend sentence without a prior week", () => {
    const o = buildOverview({ ...base, trend: { ...base.trend, hasPrev: false } });
    expect(o).not.toContain("week over week");
  });

  it("flags poor overall health and misalignment risk", () => {
    const o = buildOverview({ ...base, dmarcRate: 70, misaligned: 900 });
    expect(o).toContain("needs attention");
    expect(o).toContain("deliverability risk");
  });

  it("counts outstanding DNS actions", () => {
    const o = buildOverview({ ...base, dnsActionCount: 3 });
    expect(o).toContain("3 DNS actions are outstanding");
  });
});
