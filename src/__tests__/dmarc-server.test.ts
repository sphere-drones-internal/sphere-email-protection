import { describe, it, expect } from "vitest";
import { gzipSync } from "node:zlib";
import { extractXml, parseReport } from "@/lib/dmarc-server";
import { classifyRow } from "@/lib/dmarc";

const REPORT = `<?xml version="1.0" encoding="UTF-8" ?>
<feedback>
  <report_metadata>
    <org_name>google.com</org_name>
    <email>noreply-dmarc-support@google.com</email>
    <report_id>12345678901234567890</report_id>
    <date_range><begin>1782864000</begin><end>1782950399</end></date_range>
  </report_metadata>
  <policy_published>
    <domain>spheredrones.com.au</domain>
    <adkim>r</adkim><aspf>r</aspf><p>reject</p><sp>reject</sp><pct>100</pct>
  </policy_published>
  <record>
    <row>
      <source_ip>209.85.167.71</source_ip>
      <count>42</count>
      <policy_evaluated><disposition>none</disposition><dkim>pass</dkim><spf>pass</spf></policy_evaluated>
    </row>
    <identifiers><header_from>spheredrones.com.au</header_from></identifiers>
    <auth_results>
      <dkim><domain>spheredrones.com.au</domain><result>pass</result><selector>google</selector></dkim>
      <spf><domain>spheredrones.com.au</domain><result>pass</result></spf>
    </auth_results>
  </record>
  <record>
    <row>
      <source_ip>1.2.3.4</source_ip>
      <count>3</count>
      <policy_evaluated><disposition>quarantine</disposition><dkim>fail</dkim><spf>fail</spf><reason><type>forwarded</type><comment></comment></reason></policy_evaluated>
    </row>
    <identifiers><header_from>spheredrones.com.au</header_from></identifiers>
    <auth_results>
      <dkim><domain>other.com</domain><result>fail</result><selector>s1</selector></dkim>
      <spf><domain>other.com</domain><result>fail</result></spf>
    </auth_results>
  </record>
</feedback>`;

describe("parseReport (server)", () => {
  const r = parseReport(REPORT);

  it("extracts report metadata and published policy", () => {
    expect(r.id).toBe("12345678901234567890");
    expect(r.org).toBe("google.com");
    expect(r.domain).toBe("spheredrones.com.au");
    expect(r.begin).toBe(1782864000 * 1000);
    expect(r.end).toBe(1782950399 * 1000);
    expect(r.policyP).toBe("reject");
    expect(r.policySp).toBe("reject");
    expect(r.policyPct).toBe("100");
    expect(r.rows).toHaveLength(2);
  });

  it("maps an aligned passing row", () => {
    expect(r.rows[0]).toEqual({
      sourceIp: "209.85.167.71", count: 42, disposition: "none",
      peDkim: "pass", peSpf: "pass", headerFrom: "spheredrones.com.au",
      spfRaw: true, dkimRaw: true, spfDom: "spheredrones.com.au", dkimDom: "spheredrones.com.au",
      sel: "google", reasons: [],
    });
    expect(classifyRow(r.rows[0])).toBe("compliant");
  });

  it("maps a failing forwarded row (raw domains from first entry, reason captured)", () => {
    expect(r.rows[1]).toEqual({
      sourceIp: "1.2.3.4", count: 3, disposition: "quarantine",
      peDkim: "fail", peSpf: "fail", headerFrom: "spheredrones.com.au",
      spfRaw: false, dkimRaw: false, spfDom: "other.com", dkimDom: "other.com",
      sel: "s1", reasons: ["forwarded"],
    });
    expect(classifyRow(r.rows[1])).toBe("forwarded");
  });

  it("falls back to a synthetic id when report_id is absent", () => {
    const noId = REPORT.replace("<report_id>12345678901234567890</report_id>", "");
    expect(parseReport(noId).id).toBe(`google.com|spheredrones.com.au|${1782864000 * 1000}|${1782950399 * 1000}`);
  });

  it("handles a single-record report (parser returns an object, not an array)", () => {
    const one = REPORT.slice(0, REPORT.indexOf("<record>", REPORT.indexOf("<record>") + 1)) + "</feedback>";
    expect(parseReport(one).rows).toHaveLength(1);
  });

  it("rejects non-report XML", () => {
    expect(() => parseReport("<html><body>nope</body></html>")).toThrow();
  });
});

describe("extractXml (server)", () => {
  it("passes plain XML through unchanged", () => {
    const [xml] = extractXml(Buffer.from(REPORT, "utf8"));
    expect(parseReport(xml).rows).toHaveLength(2);
  });

  it("decompresses a gzip attachment (.xml.gz — the common case)", () => {
    const out = extractXml(gzipSync(Buffer.from(REPORT, "utf8")));
    expect(out).toHaveLength(1);
    expect(parseReport(out[0]).id).toBe("12345678901234567890");
  });
});
