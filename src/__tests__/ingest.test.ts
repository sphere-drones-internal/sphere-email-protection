import { describe, it, expect, vi, beforeEach } from "vitest";
import { gzipSync } from "node:zlib";

vi.mock("@/lib/reports", () => ({ ingestReports: vi.fn().mockResolvedValue({ added: 1, skipped: 0 }) }));

import { runIngestWith } from "@/lib/ingest";
import { ingestReports } from "@/lib/reports";
import { gmailConfigFromEnv } from "@/lib/gmail";
import type { GmailClient } from "@/lib/gmail";

const REPORT = `<?xml version="1.0"?>
<feedback>
  <report_metadata><org_name>google.com</org_name><report_id>abc123</report_id>
    <date_range><begin>1782864000</begin><end>1782950399</end></date_range></report_metadata>
  <policy_published><domain>spheredrones.com.au</domain><p>reject</p></policy_published>
  <record><row><source_ip>209.85.167.71</source_ip><count>5</count>
    <policy_evaluated><disposition>none</disposition><dkim>pass</dkim><spf>pass</spf></policy_evaluated></row>
    <identifiers><header_from>spheredrones.com.au</header_from></identifiers>
    <auth_results><dkim><domain>spheredrones.com.au</domain><result>pass</result><selector>google</selector></dkim>
      <spf><domain>spheredrones.com.au</domain><result>pass</result></spf></auth_results></record>
</feedback>`;

const fakeGmail = (overrides: Partial<GmailClient> = {}): GmailClient => ({
  listMessageIds: async () => ["m1", "m2"],
  getAttachments: async (id: string) =>
    id === "m1"
      ? [{ filename: "google.xml.gz", data: gzipSync(Buffer.from(REPORT, "utf8")) }]
      : [{ filename: "broken.xml", data: Buffer.from("<not-a-report/>", "utf8") }],
  ...overrides,
});

beforeEach(() => vi.mocked(ingestReports).mockClear().mockResolvedValue({ added: 1, skipped: 0 }));

describe("runIngestWith", () => {
  it("parses valid attachments, counts parse failures, and forwards reports to ingestReports", async () => {
    const result = await runIngestWith(fakeGmail(), "gmail-ingest@x");
    expect(result).toEqual({ messages: 2, reports: 1, added: 1, skipped: 0, errors: 1 });
    // one parseable report (m1); m2's garbage attachment counts as an error, not a report
    expect(ingestReports).toHaveBeenCalledOnce();
    expect(vi.mocked(ingestReports).mock.calls[0][0]).toHaveLength(1);
    expect(vi.mocked(ingestReports).mock.calls[0][0][0].id).toBe("abc123");
    expect(vi.mocked(ingestReports).mock.calls[0][1]).toBe("gmail-ingest@x");
  });

  it("counts a message whose fetch throws as an error, without aborting the run", async () => {
    const gmail = fakeGmail({ getAttachments: async (id: string) => { if (id === "m2") throw new Error("boom"); return [{ filename: "google.xml.gz", data: gzipSync(Buffer.from(REPORT, "utf8")) }]; } });
    const result = await runIngestWith(gmail, "sys");
    expect(result.messages).toBe(2);
    expect(result.reports).toBe(1);
    expect(result.errors).toBe(1);
  });

  it("does nothing (no ingestReports call) when the mailbox has no matching messages", async () => {
    const result = await runIngestWith(fakeGmail({ listMessageIds: async () => [] }), "sys");
    expect(result).toEqual({ messages: 0, reports: 0, added: 0, skipped: 0, errors: 0 });
    expect(ingestReports).not.toHaveBeenCalled();
  });
});

describe("gmailConfigFromEnv", () => {
  it("returns null when credentials are absent", () => {
    vi.stubEnv("GMAIL_CLIENT_ID", "");
    vi.stubEnv("GMAIL_CLIENT_SECRET", "");
    vi.stubEnv("GMAIL_REFRESH_TOKEN", "");
    expect(gmailConfigFromEnv()).toBeNull();
    vi.unstubAllEnvs();
  });

  it("builds config (with the default label id) when all credentials are present", () => {
    vi.stubEnv("GMAIL_CLIENT_ID", "cid");
    vi.stubEnv("GMAIL_CLIENT_SECRET", "secret");
    vi.stubEnv("GMAIL_REFRESH_TOKEN", "rtok");
    vi.stubEnv("GMAIL_LABEL_ID", "");
    expect(gmailConfigFromEnv()).toMatchObject({ clientId: "cid", clientSecret: "secret", refreshToken: "rtok", labelId: "Label_8413525737554576041" });
    vi.unstubAllEnvs();
  });
});
