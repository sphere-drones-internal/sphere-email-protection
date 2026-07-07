"use client";

import { type ParsedReport, type TrimmedRow, reportIdFor } from "@/lib/dmarc";

async function inflate(bytes: Uint8Array, format: "gzip" | "deflate-raw"): Promise<Uint8Array> {
  const ds = new DecompressionStream(format);
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

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

export async function extractXml(file: File): Promise<string[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const out: string[] = [];
  if (buf[0] === 0x1f && buf[1] === 0x8b) out.push(new TextDecoder().decode(await inflate(buf, "gzip")));
  else if (buf[0] === 0x50 && buf[1] === 0x4b) {
    for (const e of readZip(buf)) {
      if (!/\.xml$/i.test(e.name)) continue;
      if (e.method === 0) out.push(new TextDecoder().decode(e.data));
      else if (e.method === 8) out.push(new TextDecoder().decode(await inflate(e.data, "deflate-raw")));
    }
  } else out.push(new TextDecoder().decode(buf));
  return out;
}

export function parseReport(xmlText: string): ParsedReport {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Invalid XML");
  const t = (el: Element | Document | null, sel: string) => el?.querySelector(sel)?.textContent?.trim() ?? "";
  const meta = doc.querySelector("report_metadata");
  const dr = meta?.querySelector("date_range") ?? null;
  const begin = (parseInt(t(dr, "begin")) || 0) * 1000;
  const end = (parseInt(t(dr, "end")) || 0) * 1000;
  const org = t(meta, "org_name");
  const pol = doc.querySelector("policy_published");
  const domain = t(pol, "domain");
  const id = reportIdFor(t(meta, "report_id"), org, domain, begin, end);
  const rows: TrimmedRow[] = [];
  doc.querySelectorAll("record").forEach((rec) => {
    const row = rec.querySelector("row");
    const pe = row?.querySelector("policy_evaluated") ?? null;
    const ar = rec.querySelector("auth_results");
    const dkim = [...(ar?.querySelectorAll("dkim") ?? [])].map((d) => ({ domain: t(d, "domain"), result: t(d, "result"), selector: t(d, "selector") }));
    const spf = [...(ar?.querySelectorAll("spf") ?? [])].map((s) => ({ domain: t(s, "domain"), result: t(s, "result") }));
    const dkimPass = dkim.find((d) => d.result === "pass") ?? dkim[0];
    rows.push({
      sourceIp: t(row, "source_ip"),
      count: parseInt(t(row, "count")) || 0,
      disposition: t(pe, "disposition") || "none",
      peDkim: t(pe, "dkim"),
      peSpf: t(pe, "spf"),
      headerFrom: t(rec.querySelector("identifiers"), "header_from"),
      spfRaw: spf.some((s) => s.result === "pass"),
      dkimRaw: dkim.some((d) => d.result === "pass"),
      spfDom: spf.find((s) => s.result === "pass")?.domain ?? spf[0]?.domain ?? "",
      dkimDom: dkimPass?.domain ?? "",
      sel: dkimPass?.selector ?? "",
      reasons: [...(pe?.querySelectorAll("reason") ?? [])].map((r) => t(r, "type")).filter(Boolean),
    });
  });
  return {
    id, org, domain, begin, end,
    policyP: t(pol, "p") || undefined,
    policySp: t(pol, "sp") || undefined,
    policyPct: t(pol, "pct") || undefined,
    rows,
  };
}