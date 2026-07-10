// Plain-English overview for the exported portfolio summary — the "so what"
// a reader gets before the detail. Pure so the threshold logic is testable.

export type OverviewInput = {
  total: number;
  dmarcRate: number; // %
  misaligned: number;
  trend: {
    hasPrev: boolean;
    thisWeek: { vol: number; rate: number | null };
    prevWeek: { vol: number; rate: number | null };
    thisThreat: number;
    prevThreat: number;
  };
  dnsActionCount: number;
  dnsLive: boolean;
};

export function buildOverview(i: OverviewInput): string {
  if (i.total === 0) return "No report data loaded yet — the sections below cover published DNS records only.";
  const s: string[] = [];

  if (i.dmarcRate >= 95) s.push(`Email authentication is in good shape — ${i.dmarcRate}% of ${i.total.toLocaleString()} messages passed DMARC.`);
  else if (i.dmarcRate >= 80) s.push(`Email authentication is mostly healthy — ${i.dmarcRate}% of ${i.total.toLocaleString()} messages passed DMARC, with room to improve.`);
  else s.push(`Email authentication needs attention — only ${i.dmarcRate}% of ${i.total.toLocaleString()} messages passed DMARC.`);

  const { hasPrev, thisWeek, prevWeek, thisThreat, prevThreat } = i.trend;
  if (hasPrev && thisWeek.rate != null && prevWeek.rate != null) {
    const dRate = thisWeek.rate - prevWeek.rate;
    const dVol = prevWeek.vol > 0 ? (thisWeek.vol - prevWeek.vol) / prevWeek.vol : 0;
    if (Math.abs(dVol) >= 0.5) s.push(`Send volume ${dVol > 0 ? "spiked" : "dropped sharply"} this week (${thisWeek.vol.toLocaleString()} vs ${prevWeek.vol.toLocaleString()} last week).`);
    if (dRate <= -3) s.push(`The pass rate is down ${Math.abs(Math.round(dRate))} points on the prior week — worth investigating.`);
    else if (dRate >= 3) s.push(`The pass rate improved ${Math.round(dRate)} points on the prior week.`);
    else if (Math.abs(dVol) < 0.5) s.push(`Sending is in line with the usual trend week over week.`);
  }

  if (thisThreat === 0) {
    s.push(`No unauthenticated (spoof-like) traffic this week.`);
  } else if (thisThreat >= 10 && thisThreat >= prevThreat * 1.5) {
    s.push(prevThreat > 0
      ? `There is a spike in unauthenticated, likely spoofed mail this week — ${thisThreat.toLocaleString()} messages vs ${prevThreat.toLocaleString()} last week. Enforced domains are blocking these.`
      : `${thisThreat.toLocaleString()} unauthenticated, likely spoofed messages appeared this week where last week had none. Enforced domains are blocking these.`);
  } else {
    s.push(`Unauthenticated traffic is at ${thisThreat.toLocaleString()} message${thisThreat !== 1 ? "s" : ""} this week${prevThreat > 0 ? `, similar to last week (${prevThreat.toLocaleString()})` : ""}.`);
  }

  if (i.misaligned / i.total >= 0.02) {
    s.push(`${i.misaligned.toLocaleString()} legitimate-looking messages are failing alignment — a deliverability risk worth fixing (see the Non-compliant senders).`);
  }

  if (i.dnsLive && i.dnsActionCount === 0) s.push(`All portfolio DNS records check out.`);
  else if (i.dnsActionCount > 0) s.push(`${i.dnsActionCount} DNS action${i.dnsActionCount !== 1 ? "s are" : " is"} outstanding — listed below.`);

  return s.join(" ");
}
