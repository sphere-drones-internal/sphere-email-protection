import { gunzipSync, inflateRawSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";
import { type ParsedReport, type TrimmedRow, reportIdFor } from "@/lib/dmarc";

// Server-side equivalent of dmarc-client.ts, for the Gmail ingest job. Same
// output shape (ParsedReport); uses Node zlib instead of DecompressionStream and
// fast-xml-parser instead of the browser DOMParser. The ZIP central-directory
// reader is ported byte-for-byte from the client.

function readZip(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Not a valid ZIP file");
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const entries: { method: number; compSize: number; localOff: number; name: string }[] = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const fnLen = dv.getUint16(off + 28, true);
    const exLen = dv.getUint16(off + 30, true);
    const cmLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(off + 46, off + 46 + fnLen));
    entries.push({ method, compSize, localOff, name });
    off += 46 + fnLen + exLen + cmLen;
  }
  return entries.map((e) => {
    const lfnLen = dv.getUint16(e.localOff + 26, true);
    const lexLen = dv.getUint16(e.localOff + 28, true);
    const dataStart = e.localOff + 30 + lfnLen + lexLen;
    return { ...e, data: bytes.subarray(dataStart, dataStart + e.compSize) };
  });
}

// Decompress a raw attachment buffer (gzip / zip / plain XML) into XML strings.
// A .zip may hold several reports; gzip and plain hold one.
export function extractXml(buf: Buffer): string[] {
  const out: string[] = [];
  if (buf[0] === 0x1f && buf[1] === 0x8b) out.push(gunzipSync(buf).toString("utf8"));
  else if (buf[0] === 0x50 && buf[1] === 0x4b) {
    for (const e of readZip(buf)) {
      if (!/\.xml$/i.test(e.name)) continue;
      if (e.method === 0) out.push(Buffer.from(e.data).toString("utf8"));
      else if (e.method === 8) out.push(inflateRawSync(e.data).toString("utf8"));
    }
  } else out.push(buf.toString("utf8"));
  return out;
}

// fast-xml-parser returns a single object for one child element and an array for
// many; these helpers normalise both to typed shapes without using `any`.
type Node = Record<string, unknown>;
const obj = (v: unknown): Node => (v && typeof v === "object" && !Array.isArray(v) ? (v as Node) : {});
const arr = (v: unknown): Node[] => (Array.isArray(v) ? v.map(obj) : v == null ? [] : [obj(v)]);
const txt = (v: unknown): string => (v == null ? "" : String(v).trim());

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });

export function parseReport(xmlText: string): ParsedReport {
  const fb = obj(obj(parser.parse(xmlText)).feedback);
  if (!Object.keys(fb).length) throw new Error("Invalid DMARC report XML");

  const meta = obj(fb.report_metadata);
  const dr = obj(meta.date_range);
  const begin = (parseInt(txt(dr.begin)) || 0) * 1000;
  const end = (parseInt(txt(dr.end)) || 0) * 1000;
  const org = txt(meta.org_name);
  const pol = obj(fb.policy_published);
  const domain = txt(pol.domain);
  const id = reportIdFor(txt(meta.report_id), org, domain, begin, end);

  const rows: TrimmedRow[] = arr(fb.record).map((rec) => {
    const row = obj(rec.row);
    const pe = obj(row.policy_evaluated);
    const ar = obj(rec.auth_results);
    const dkim = arr(ar.dkim).map((d) => ({ domain: txt(d.domain), result: txt(d.result), selector: txt(d.selector) }));
    const spf = arr(ar.spf).map((s) => ({ domain: txt(s.domain), result: txt(s.result) }));
    const dkimPass = dkim.find((d) => d.result === "pass") ?? dkim[0];
    return {
      sourceIp: txt(row.source_ip),
      count: parseInt(txt(row.count)) || 0,
      disposition: txt(pe.disposition) || "none",
      peDkim: txt(pe.dkim),
      peSpf: txt(pe.spf),
      headerFrom: txt(obj(rec.identifiers).header_from),
      spfRaw: spf.some((s) => s.result === "pass"),
      dkimRaw: dkim.some((d) => d.result === "pass"),
      spfDom: spf.find((s) => s.result === "pass")?.domain ?? spf[0]?.domain ?? "",
      dkimDom: dkimPass?.domain ?? "",
      sel: dkimPass?.selector ?? "",
      reasons: arr(pe.reason).map((r) => txt(r.type)).filter(Boolean),
    };
  });

  return {
    id, org, domain, begin, end,
    policyP: txt(pol.p) || undefined,
    policySp: txt(pol.sp) || undefined,
    policyPct: txt(pol.pct) || undefined,
    rows,
  };
}
