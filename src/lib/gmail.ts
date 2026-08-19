// Minimal Gmail REST client for the ingest job — refresh-token → access-token,
// list messages under a label, download attachment bytes. Deliberately dependency-
// free (no googleapis) and behind an interface so the ingest flow is testable with
// a fake. Scopes needed: gmail.readonly (list/read/attachments).

export type GmailAttachment = { filename: string; data: Buffer };

export interface GmailClient {
  listMessageIds(query: string): Promise<string[]>;
  getAttachments(messageId: string): Promise<GmailAttachment[]>;
}

export type GmailConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  labelId: string;
};

// Names of the required Gmail env vars that are absent/empty in the running
// process — surfaced to the operator (names only, never values) so a misconfigured
// deploy is diagnosable without guessing.
export function missingGmailVars(): string[] {
  return (["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"] as const).filter((k) => !process.env[k]);
}

export function gmailConfigFromEnv(): GmailConfig | null {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) return null;
  return {
    clientId: GMAIL_CLIENT_ID,
    clientSecret: GMAIL_CLIENT_SECRET,
    refreshToken: GMAIL_REFRESH_TOKEN,
    // Default is the "DMARC Reports" label ID in the target mailbox; overridable.
    labelId: process.env.GMAIL_LABEL_ID || "Label_8413525737554576041",
  };
}

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const ATTACHMENT_RE = /\.(xml|gz|zip)$/i;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// Recursively collect { filename, attachmentId } from a Gmail message payload.
function collectAttachmentParts(part: unknown, acc: { filename: string; attachmentId: string }[]) {
  if (!part || typeof part !== "object") return;
  const p = part as Record<string, unknown>;
  const filename = str(p.filename);
  const body = (p.body ?? {}) as Record<string, unknown>;
  const attachmentId = str(body.attachmentId);
  if (filename && attachmentId && ATTACHMENT_RE.test(filename)) acc.push({ filename, attachmentId });
  if (Array.isArray(p.parts)) for (const child of p.parts) collectAttachmentParts(child, acc);
}

export function createGmailClient(cfg: GmailConfig): GmailClient {
  let token: { value: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt > Date.now() + 60_000) return token.value;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: cfg.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error(`Gmail token exchange failed (${res.status})`);
    const d = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!d.access_token) throw new Error("Gmail token exchange returned no access_token");
    token = { value: d.access_token, expiresAt: Date.now() + (d.expires_in ?? 3600) * 1000 };
    return token.value;
  }

  async function api(path: string): Promise<unknown> {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
    if (!res.ok) throw new Error(`Gmail API ${path} failed (${res.status})`);
    return res.json();
  }

  return {
    async listMessageIds(query: string): Promise<string[]> {
      const ids: string[] = [];
      let pageToken = "";
      do {
        const params = new URLSearchParams({ q: query, labelIds: cfg.labelId, maxResults: "100" });
        if (pageToken) params.set("pageToken", pageToken);
        const d = (await api(`/messages?${params}`)) as { messages?: { id: string }[]; nextPageToken?: string };
        for (const m of d.messages ?? []) ids.push(m.id);
        pageToken = d.nextPageToken ?? "";
      } while (pageToken);
      return ids;
    },

    async getAttachments(messageId: string): Promise<GmailAttachment[]> {
      const msg = (await api(`/messages/${messageId}?format=full`)) as { payload?: unknown };
      const parts: { filename: string; attachmentId: string }[] = [];
      collectAttachmentParts(msg.payload, parts);
      const out: GmailAttachment[] = [];
      for (const p of parts) {
        const a = (await api(`/messages/${messageId}/attachments/${p.attachmentId}`)) as { data?: string };
        if (a.data) out.push({ filename: p.filename, data: Buffer.from(a.data, "base64url") });
      }
      return out;
    },
  };
}
