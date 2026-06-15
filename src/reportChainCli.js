import fs from "fs";
import path from "path";

const chainTokenPath = process.argv[2];

if (!chainTokenPath) {
  console.error("Usage: npm run report-chain <chainTokenPath>");
  console.error("Example: npm run report-chain output\\vsc-chain-A3C60EAEF97B-to-8F75655E9A77.json");
  process.exit(1);
}

if (!fs.existsSync(chainTokenPath)) {
  console.error(`Chain token not found: ${chainTokenPath}`);
  process.exit(1);
}

const chain = JSON.parse(fs.readFileSync(chainTokenPath, "utf8"));

if (chain.mode !== "DELTA_CHAIN" && chain.type !== "VSC_CHAIN") {
  console.error(`Token mode is "${chain.mode}", expected DELTA_CHAIN.`);
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtB(n) {
  const v = Number(n) || 0;
  if (v === 0) return "0 B";
  if (v < 1024) return `${v} B`;
  if (v < 1048576) return `${(v / 1024).toFixed(2)} KB`;
  return `${(v / 1048576).toFixed(2)} MB`;
}

function fmtPct(n) {
  return `${Number(n).toFixed(2)}%`;
}

function shortH(h = "", n = 16) {
  return String(h || "").slice(0, n);
}

// ── Load base token ────────────────────────────────────────────────────────────
const outputDir   = path.resolve("output");
const baseTokenId = chain.baseTokenId;

let baseToken = null;

// Try manifest first
const manifestPath = path.join(outputDir, "manifest.json");
if (fs.existsSync(manifestPath)) {
  try {
    const mf = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const entry = mf.find(e => e.id === baseTokenId && (e.mode === "FOLDER_RECOVERY" || e.type === "FOLDER"));
    if (entry?.json) {
      const p = path.join(outputDir, entry.json);
      if (fs.existsSync(p)) baseToken = JSON.parse(fs.readFileSync(p, "utf8"));
    }
  } catch { /* ignore */ }
}

// Fallback: filename pattern
if (!baseToken) {
  const candidate = path.join(outputDir, `vsc-${baseTokenId}-folder-recovery.json`);
  if (fs.existsSync(candidate)) baseToken = JSON.parse(fs.readFileSync(candidate, "utf8"));
}

// ── Chain data ────────────────────────────────────────────────────────────────
const summary   = chain.summary || {};
const steps     = Array.isArray(chain.steps) ? chain.steps : [];
const proof     = chain.proof || {};

const stepCount          = summary.stepCount              ?? steps.length;
const totalDeltaBytes    = summary.totalDeltaSizeBytes    ?? 0;
const estimatedFullBytes = summary.estimatedFullCopyBytes ?? 0;
const deltaOnlyPct       = summary.estimatedReductionPercent ?? null;

// Base size: from base token or chain summary fallback
let baseSizeBytes = 0;
if (baseToken) {
  baseSizeBytes = baseToken.totalSizeBytes
    ?? (Array.isArray(baseToken.files) ? baseToken.files.reduce((s, f) => s + (f.sizeBytes || 0), 0) : 0);
}
if (!baseSizeBytes && estimatedFullBytes > 0) {
  baseSizeBytes = estimatedFullBytes;
}

// Traditional backup: base + N full copies (one per delta step)
const traditionalBytes = baseSizeBytes * (stepCount + 1);

// VSC backup: base + all deltas
const vscBytes = baseSizeBytes + totalDeltaBytes;

// Savings
const savedBytes = traditionalBytes - vscBytes;
const totalChainPct = traditionalBytes > 0 ? (savedBytes / traditionalBytes) * 100 : 0;

// ── Terminal output ───────────────────────────────────────────────────────────
console.log("");
console.log("VSC DELTA CHAIN REPORT");
console.log("----------------------");
console.log(`Base token ID:           ${baseTokenId}`);
console.log(`Latest token ID:         ${chain.latestTokenId}`);
console.log(`Steps:                   ${stepCount}`);
console.log(`Base size:               ${fmtB(baseSizeBytes)}`);
console.log("");

if (steps.length > 0) {
  for (const st of steps) {
    console.log(`  Step ${st.index}: ${st.fromTokenId || "?"} → ${st.toTokenId}  (+${st.addedCount} ~${st.modifiedCount} -${st.deletedCount})  ${fmtB(st.deltaSizeBytes)}`);
  }
  console.log("");
}

console.log(`Total delta size:        ${fmtB(totalDeltaBytes)}`);
console.log(`Traditional full-copy:   ${fmtB(traditionalBytes)}  (base × ${stepCount + 1})`);
console.log(`VSC storage size:        ${fmtB(vscBytes)}  (base + all deltas)`);
console.log(`Saved:                   ${fmtB(savedBytes)}`);
console.log(`Total chain reduction:   ${fmtPct(totalChainPct)}`);
if (deltaOnlyPct !== null) {
  console.log(`Delta-only reduction:    ${fmtPct(deltaOnlyPct)}`);
}
console.log(`Chain hash:              ${shortH(proof.chainHash, 24)}`);
console.log(`Latest root hash:        ${shortH(proof.latestFolderRootHash, 24)}`);

// ── Markdown report ───────────────────────────────────────────────────────────
const latestId = chain.latestTokenId || chain.id || "LATEST";
const reportFileName = `report-chain-${baseTokenId}-to-${latestId}.md`;
const reportPath = path.join(outputDir, reportFileName);

// Step table rows
const stepTableRows = steps.map(st =>
  `| ${st.index} | \`${String(st.fromTokenId || "").slice(0, 12)}\` | \`${String(st.toTokenId || "").slice(0, 12)}\` | ${st.addedCount} | ${st.modifiedCount} | ${st.deletedCount} | ${fmtB(st.deltaSizeBytes)} | \`${shortH(st.targetFolderRootHash, 16)}\` |`
).join("\n");

const md = `# VSC Delta Chain Report

## Chain Overview

| Field | Value |
|---|---|
| Base token ID | \`${baseTokenId}\` |
| Latest token ID | \`${latestId}\` |
| Steps | ${stepCount} |
| Base size | ${fmtB(baseSizeBytes)} |
| Total delta size | ${fmtB(totalDeltaBytes)} |
| Traditional full-copy size | ${fmtB(traditionalBytes)} *(base × ${stepCount + 1})* |
| VSC base + delta size | ${fmtB(vscBytes)} |
| Saved bytes | ${fmtB(savedBytes)} |
| **Total chain reduction** | **${fmtPct(totalChainPct)}** |
| Delta-only reduction | ${deltaOnlyPct !== null ? fmtPct(deltaOnlyPct) : "—"} |
| Chain hash | \`${shortH(proof.chainHash, 24)}\` |
| Latest root hash | \`${shortH(proof.latestFolderRootHash, 24)}\` |

## Strategy Comparison

| Strategy | Storage required |
|---|---|
| Traditional full-copy × ${stepCount + 1} | ${fmtB(traditionalBytes)} |
| VSC Base + ${stepCount} delta(s) | ${fmtB(vscBytes)} |
| **Savings** | **${fmtB(savedBytes)} (${fmtPct(totalChainPct)})** |

> Traditional backup = store 1 full copy per state (base + one full copy after each delta).
> VSC backup = store base once + only the changed files for each delta.

## Steps

| Step | From | To | Added | Modified | Deleted | Delta size | Target root prefix |
|---|---|---|---|---|---|---|---|
${stepTableRows || "*(no steps)*"}

## Restore & Verify

- **Restore rule:** Base + ordered deltas applied in sequence
- **Verify model:** Latest folder root hash
- **Restore command:** \`npm run restore-chain ${chainTokenPath}\`
- **Verify command:** \`npm run verify-chain ${chainTokenPath} <restored-folder>\`

---
*Generated by VSC Delta Chain Report — ${new Date().toISOString()}*
`;

fs.writeFileSync(reportPath, md, "utf8");
console.log("");
console.log(`Report written: ${reportPath}`);
console.log("");
