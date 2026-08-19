// Auditable guard for CVE-2026-40345 (deepmerge-ts stack exhaustion on recursive
// object graphs). @prisma/config declares a transitive dep on deepmerge-ts 7.1.x;
// package.json pins an `overrides` entry to ^8.0.1, which hoists a single fixed
// copy. This script fails the build if the lockfile still resolves ANY
// deepmerge-ts copy below 8.0.0, giving a repo-local, reproducible artefact that
// closes the finding without needing `npm ls` at CI time.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIN_MAJOR = 8;

const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const offenders = [];

for (const [path, node] of Object.entries(lock.packages ?? {})) {
  if (!node?.version) continue;
  const isDeepmerge =
    path === "node_modules/deepmerge-ts" || path.endsWith("/node_modules/deepmerge-ts");
  if (!isDeepmerge) continue;
  const major = Number(node.version.split(".")[0]);
  if (!Number.isFinite(major) || major < MIN_MAJOR) {
    offenders.push(`${path} → ${node.version}`);
  }
}

if (offenders.length > 0) {
  console.error(
    "verify-deepmerge: FAIL — vulnerable deepmerge-ts (<8.0.0, CVE-2026-40345) resolved:\n  " +
      offenders.join("\n  "),
  );
  process.exit(1);
}

console.log("verify-deepmerge: PASS — all deepmerge-ts copies are >= 8.0.0 (CVE-2026-40345 closed)");
