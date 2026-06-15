#!/usr/bin/env node
/**
 * exportShowcase.js — VSC v1.10 static showcase exporter
 *
 * Usage:  npm run vsc -- showcase
 *    or:  node scripts/exportShowcase.js
 *
 * Generates showcase/ with:
 *   index.html   — standalone landing page (inline CSS, no external deps)
 *   README.md    — human-readable description
 *   assets/seals/     — selected SVG token seals
 *   assets/reports/   — chain report markdown
 *   assets/gallery/   — copy of output/gallery.html
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, "..");
const OUT        = path.join(ROOT, "output");
const SHOWCASE   = path.join(ROOT, "showcase");

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  write  showcase/${path.relative(SHOWCASE, filePath).replace(/\\/g, "/")}`);
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  copy   showcase/${path.relative(SHOWCASE, dest).replace(/\\/g, "/")}  (${(fs.statSync(dest).size / 1024).toFixed(1)} KB)`);
  return true;
}

function readManifest() {
  const p = path.join(OUT, "manifest.json");
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return []; }
}

function latestEntry(pred) {
  return readManifest()
    .filter(pred)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

// ── Artifact selection ────────────────────────────────────────────────────────
// Prefer known local WordPress demo files; fall back to newest manifest entries.
// All paths are discovered dynamically so GitHub Actions builds work without
// fixed token IDs.

const KNOWN_BASE_ID = "21A8390BFA3F";

function resolveFromManifestSvg(pred) {
  const entry = latestEntry(pred);
  if (!entry) return null;
  const svgName = entry.svg || "";
  if (svgName) {
    const p = path.join(OUT, path.basename(svgName));
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Chain report: try known path first, then scan output/ for newest report-chain-*.md
function findNewestChainReport() {
  const knownPath = path.join(OUT, `report-chain-${KNOWN_BASE_ID}-to-954BEB0FF3AA.md`);
  if (fs.existsSync(knownPath)) return knownPath;
  // Scan for any report-chain-*.md, pick newest by mtime
  let entries;
  try { entries = fs.readdirSync(OUT); } catch { return null; }
  const reports = entries
    .filter(n => n.startsWith("report-chain-") && n.endsWith(".md"))
    .map(n => ({ name: n, p: path.join(OUT, n), mtime: fs.statSync(path.join(OUT, n)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (reports.length === 0) return null;
  console.log(`  info   chain report selected: ${reports[0].name}`);
  return reports[0].p;
}

// Determine the newest chain entry so we can select SVGs from the same run
const newestChain = latestEntry(e => e.mode === "DELTA_CHAIN");
const chainBaseId  = newestChain?.baseline || KNOWN_BASE_ID;
const chainLatestId = newestChain?.id || "954BEB0FF3AA";

// Deltas that belong to this chain (baseline chain base or are steps within it)
const chainDeltas = readManifest()
  .filter(e => e.mode === "FOLDER_DELTA")
  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

// delta1: earliest delta whose baseline === chainBaseId
const delta1Entry = chainDeltas.find(e => e.baseline === chainBaseId);
// delta2: earliest delta whose baseline === delta1.id
const delta2Entry = delta1Entry ? chainDeltas.find(e => e.baseline === delta1Entry.id) : null;

function svgPath(name) {
  const p = path.join(OUT, name);
  return fs.existsSync(p) ? p : null;
}

const artifacts = {
  baseSvg: svgPath(`vsc-${chainBaseId}-folder-recovery.svg`)
        || resolveFromManifestSvg(e => e.mode === "FOLDER_RECOVERY" && e.id === chainBaseId)
        || resolveFromManifestSvg(e => e.mode === "FOLDER_RECOVERY"),

  delta1Svg: delta1Entry
        ? (svgPath(path.basename(delta1Entry.svg || "")) || resolveFromManifestSvg(e => e.id === delta1Entry.id))
        : resolveFromManifestSvg(e => e.mode === "FOLDER_DELTA"),

  delta2Svg: delta2Entry
        ? (svgPath(path.basename(delta2Entry.svg || "")) || resolveFromManifestSvg(e => e.id === delta2Entry.id))
        : null,

  chainSvg: svgPath(`vsc-chain-${chainBaseId}-to-${chainLatestId}.svg`)
        || resolveFromManifestSvg(e => e.mode === "DELTA_CHAIN"),

  chainReport: findNewestChainReport(),
  galleryHtml: path.join(OUT, "gallery.html"),
};

// Validate essentials — delta SVGs are best-effort, the rest are required
const REQUIRED_KEYS = ["baseSvg", "chainSvg", "chainReport", "galleryHtml"];
const OPTIONAL_KEYS = ["delta1Svg", "delta2Svg"];

const missing = REQUIRED_KEYS.filter(k => !artifacts[k] || !fs.existsSync(artifacts[k]));
const missingOpt = OPTIONAL_KEYS.filter(k => !artifacts[k] || !fs.existsSync(artifacts[k]));

if (missingOpt.length > 0) {
  missingOpt.forEach(k => console.log(`  warn   ${k} not found — seal slot will be blank`));
  // null out so copyFile skips gracefully
  missingOpt.forEach(k => { artifacts[k] = null; });
}

if (missing.length > 0) {
  console.error("\nvsc showcase: required files are missing:");
  missing.forEach(k => console.error(`  missing: ${k}`));
  console.error("\nRun first:  npm run vsc -- demo:run");
  console.error("Then retry: npm run vsc -- showcase\n");
  process.exit(1);
}

// ── Build showcase/ ───────────────────────────────────────────────────────────

console.log("\nVSC v1.10 SHOWCASE EXPORT");
console.log("─────────────────────────");

// Clean only showcase/ — never output/ or anything else
if (fs.existsSync(SHOWCASE)) {
  fs.rmSync(SHOWCASE, { recursive: true, force: true });
  console.log("  clean  showcase/");
}
ensure(path.join(SHOWCASE, "assets", "seals"));
ensure(path.join(SHOWCASE, "assets", "reports"));
ensure(path.join(SHOWCASE, "assets", "gallery"));

// Copy SVG seals
const sealDest = {
  base:   path.join(SHOWCASE, "assets", "seals", "base.svg"),
  delta1: path.join(SHOWCASE, "assets", "seals", "delta1.svg"),
  delta2: path.join(SHOWCASE, "assets", "seals", "delta2.svg"),
  chain:  path.join(SHOWCASE, "assets", "seals", "chain.svg"),
};
copyFile(artifacts.baseSvg,   sealDest.base);
copyFile(artifacts.delta1Svg, sealDest.delta1);
copyFile(artifacts.delta2Svg, sealDest.delta2);
copyFile(artifacts.chainSvg,  sealDest.chain);

// Copy report
copyFile(artifacts.chainReport, path.join(SHOWCASE, "assets", "reports", "chain-report.md"));

// Copy gallery + all SVGs it references (bare filenames → same directory)
copyFile(artifacts.galleryHtml, path.join(SHOWCASE, "assets", "gallery", "gallery.html"));
try {
  const galleryDir = path.join(SHOWCASE, "assets", "gallery");
  fs.readdirSync(OUT)
    .filter(n => n.endsWith(".svg") && !n.includes("pdf"))
    .forEach(n => copyFile(path.join(OUT, n), path.join(galleryDir, n)));
} catch { /* best-effort */ }

// ── Calculate metrics from token JSON (source of truth) ──────────────────────

function fmtBytes(n) {
  if (n === undefined || n === null) return "—";
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtPct(n) {
  if (n === undefined || n === null) return "—";
  return `${Number(n).toFixed(2)}%`;
}

// Read chain token JSON — always from the manifest entry (reliable in CI and locally)
let chainToken = null;
if (newestChain) {
  const chainJsonPath = path.join(OUT, path.basename(newestChain.json || ""));
  try { chainToken = JSON.parse(fs.readFileSync(chainJsonPath, "utf8")); } catch { /* best-effort */ }
}

// Read base token JSON using chain.baseTokenPath or manifest lookup
let baseToken = null;
if (chainToken?.baseTokenPath) {
  const bPath = path.join(OUT, path.basename(chainToken.baseTokenPath));
  try { baseToken = JSON.parse(fs.readFileSync(bPath, "utf8")); } catch { /* best-effort */ }
}
if (!baseToken) {
  const baseId = chainToken?.baseTokenId || chainBaseId;
  const baseEntry = readManifest().find(e => e.mode === "FOLDER_RECOVERY" && e.id === baseId);
  if (baseEntry) {
    try { baseToken = JSON.parse(fs.readFileSync(path.join(OUT, path.basename(baseEntry.json)), "utf8")); } catch { /* best-effort */ }
  }
}

// Derive numeric metrics
const baseSizeBytes       = baseToken?.totalSizeBytes ?? baseToken?.messageLength ?? 0;
const steps               = chainToken?.steps ?? [];
const stepCount           = chainToken?.summary?.stepCount ?? steps.length;
const totalDeltaBytes     = chainToken?.summary?.totalDeltaSizeBytes
                          ?? steps.reduce((s, st) => s + (st.deltaSizeBytes || 0), 0);
const fullCopyBytes       = baseSizeBytes * (stepCount + 1);
const vscStorageBytes     = baseSizeBytes + totalDeltaBytes;
const savedBytes          = fullCopyBytes - vscStorageBytes;
const totalReductionPct   = fullCopyBytes > 0 ? (savedBytes / fullCopyBytes * 100) : 0;
const deltaOnlyReductionPct = baseSizeBytes > 0 ? ((baseSizeBytes - totalDeltaBytes) / baseSizeBytes * 100) : 0;

// Per-step delta sizes
const step1Bytes = steps[0]?.deltaSizeBytes ?? null;
const step2Bytes = steps[1]?.deltaSizeBytes ?? null;

// Sanity check
if (fullCopyBytes > 0 && fullCopyBytes < vscStorageBytes) {
  console.error("  WARN   traditional full-copy < VSC storage — check token data");
}
if (baseSizeBytes > 0 && baseSizeBytes < totalDeltaBytes) {
  console.log("  warn   base size < total delta size — unexpected for this demo");
}

// Print calculated metrics to terminal
console.log(`  metric Base size:               ${fmtBytes(baseSizeBytes)}`);
console.log(`  metric Delta 1:                 ${fmtBytes(step1Bytes)}`);
console.log(`  metric Delta 2:                 ${fmtBytes(step2Bytes)}`);
console.log(`  metric Total delta:             ${fmtBytes(totalDeltaBytes)}`);
console.log(`  metric Traditional full-copy:   ${fmtBytes(fullCopyBytes)}`);
console.log(`  metric VSC storage:             ${fmtBytes(vscStorageBytes)}`);
console.log(`  metric Saved:                   ${fmtBytes(savedBytes)}`);
console.log(`  metric Total chain reduction:   ${fmtPct(totalReductionPct)}`);
console.log(`  metric Delta-only reduction:    ${fmtPct(deltaOnlyReductionPct)}`);

const M = {
  base:       fmtBytes(baseSizeBytes),
  delta1:     step1Bytes !== null ? fmtBytes(step1Bytes) : "—",
  delta2:     step2Bytes !== null ? fmtBytes(step2Bytes) : "—",
  totalDelta: fmtBytes(totalDeltaBytes),
  fullCopy:   fmtBytes(fullCopyBytes),
  vscStorage: fmtBytes(vscStorageBytes),
  saved:      fmtBytes(savedBytes),
  reduction:  fmtPct(totalReductionPct),
  deltaOnly:  fmtPct(deltaOnlyReductionPct),
};

// ── Generate index.html ───────────────────────────────────────────────────────

const NOW = new Date().toISOString().slice(0, 10);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>VSC Core — Static Showcase</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:      #fafafa;
    --fg:      #111;
    --mid:     #444;
    --quiet:   #888;
    --border:  #ddd;
    --accent:  #111;
    --card-bg: #fff;
    --mono:    "SFMono-Regular", "Consolas", "Liberation Mono", monospace;
    --sans:    "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    --max:     960px;
    --radius:  6px;
  }
  body { font-family: var(--sans); background: var(--bg); color: var(--fg); line-height: 1.6; }
  a { color: var(--accent); text-underline-offset: 3px; }
  a:hover { opacity: 0.7; }

  /* ── layout ── */
  .page { max-width: var(--max); margin: 0 auto; padding: 0 24px; }
  section { padding: 64px 0; border-bottom: 1px solid var(--border); }
  section:last-child { border-bottom: none; }
  h1 { font-size: 2.4rem; font-weight: 700; letter-spacing: -0.5px; }
  h2 { font-size: 1.4rem; font-weight: 600; margin-bottom: 24px; letter-spacing: -0.2px; }
  p  { color: var(--mid); margin-bottom: 12px; max-width: 640px; }

  /* ── hero ── */
  #hero { padding-top: 96px; padding-bottom: 80px; }
  #hero h1 { margin-bottom: 12px; }
  #hero .sub { font-size: 1.1rem; color: var(--mid); max-width: 600px; margin-bottom: 8px; }
  #hero .status { font-size: 0.85rem; color: var(--quiet); font-family: var(--mono); margin-top: 16px; }
  .btn {
    display: inline-block; margin-top: 28px; padding: 10px 22px;
    background: var(--accent); color: #fff; text-decoration: none;
    border-radius: var(--radius); font-size: 0.9rem; font-weight: 500;
  }
  .btn:hover { opacity: 0.85; }

  /* ── flow ── */
  .flow { font-family: var(--mono); font-size: 0.95rem; line-height: 2;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 24px 32px; display: inline-block; }
  .flow .arrow { color: var(--quiet); }
  .flow .changed { color: var(--fg); font-weight: 600; }
  .flow .latest { font-weight: 700; }

  /* ── metrics ── */
  .metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
  .metric-card {
    background: var(--card-bg); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px 18px;
  }
  .metric-card .label { font-size: 0.78rem; color: var(--quiet); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .metric-card .value { font-size: 1.5rem; font-weight: 700; font-family: var(--mono); }
  .metric-card.accent { background: var(--fg); color: #fff; border-color: var(--fg); }
  .metric-card.accent .label { color: #aaa; }
  .metric-card.accent .value { color: #fff; }

  /* ── seals ── */
  .seals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px; }
  .seal-card {
    background: var(--card-bg); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px; text-align: center;
  }
  .seal-card img { width: 100%; max-width: 180px; height: auto; display: block; margin: 0 auto 12px; }
  .seal-card .seal-label { font-size: 0.8rem; color: var(--quiet); text-transform: uppercase; letter-spacing: 0.06em; }
  .seal-card .seal-id { font-family: var(--mono); font-size: 0.72rem; color: var(--border); margin-top: 4px; word-break: break-all; }

  /* ── verify ── */
  .verify-list { list-style: none; }
  .verify-list li { padding: 10px 0; border-bottom: 1px solid var(--border); font-family: var(--mono); font-size: 0.9rem; display: flex; gap: 12px; align-items: center; }
  .verify-list li:last-child { border-bottom: none; }
  .verify-list .badge {
    display: inline-block; padding: 2px 10px; border-radius: 20px;
    font-size: 0.72rem; font-weight: 600; letter-spacing: 0.05em;
    background: var(--fg); color: #fff;
  }

  /* ── code ── */
  pre { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius);
        padding: 20px 24px; font-family: var(--mono); font-size: 0.88rem; overflow-x: auto; }

  /* ── links ── */
  .link-list { list-style: none; }
  .link-list li { padding: 6px 0; font-size: 0.95rem; }

  /* ── footer ── */
  footer { padding: 32px 0; text-align: center; font-size: 0.8rem; color: var(--quiet); }
</style>
</head>
<body>
<div class="page">

  <!-- HERO -->
  <section id="hero">
    <h1>VSC Core</h1>
    <p class="sub">Verifiable Structural Compression</p>
    <p class="sub">Store a full state once. Store only ordered, verifiable deltas after that.
    Reconstruct the latest state and verify it by root hash.</p>
    <a href="https://github.com/DigiEmu/vsc-core" class="btn" target="_blank" rel="noopener">
      GitHub Repository →
    </a>
    <p class="status">Research prototype / MVP proof-of-concept · Generated ${NOW}</p>
  </section>

  <!-- PROOF FLOW -->
  <section id="proof-flow">
    <h2>Proof Flow</h2>
    <p>WordPress-style folder: one base, two ordered deltas, one verified latest state.</p>
    <div class="flow">
      <div><strong>Base snapshot</strong>&nbsp;&nbsp;<span style="color:#888">21A8390BFA3F · 1.58 MB</span></div>
      <div class="arrow">↓ Delta 1: <span class="changed">database.sql</span>&nbsp;&nbsp;<span style="color:#888">376 B stored</span></div>
      <div class="arrow">↓ Delta 2: <span class="changed">vsc-demo-plugin.php</span>&nbsp;&nbsp;<span style="color:#888">265 B stored</span></div>
      <div class="latest">Latest verified state&nbsp;&nbsp;<span style="color:#888">954BEB0FF3AA · PASS</span></div>
    </div>
  </section>

  <!-- METRICS -->
  <section id="metrics">
    <h2>WordPress-style MVP Result</h2>
    <p>Full-copy backup strategy vs VSC base + ordered deltas.</p>
    <div class="metrics-grid">
      <div class="metric-card"><div class="label">Base</div><div class="value">${M.base}</div></div>
      <div class="metric-card"><div class="label">Delta 1</div><div class="value">${M.delta1}</div></div>
      <div class="metric-card"><div class="label">Delta 2</div><div class="value">${M.delta2}</div></div>
      <div class="metric-card"><div class="label">Total delta</div><div class="value">${M.totalDelta}</div></div>
      <div class="metric-card"><div class="label">Traditional full-copy</div><div class="value">${M.fullCopy}</div></div>
      <div class="metric-card"><div class="label">VSC storage</div><div class="value">${M.vscStorage}</div></div>
      <div class="metric-card"><div class="label">Saved</div><div class="value">${M.saved}</div></div>
      <div class="metric-card accent"><div class="label">Total chain reduction</div><div class="value">${M.reduction}</div></div>
      <div class="metric-card accent"><div class="label">Delta-only reduction</div><div class="value">${M.deltaOnly}</div></div>
    </div>
  </section>

  <!-- SEALS -->
  <section id="seals">
    <h2>Visual Token Grammar</h2>
    <p>Each VSC token is represented as a human-readable SVG seal.
       The seal encodes token type, state relationship, and verification identity.</p>
    <div class="seals-grid">
      <div class="seal-card">
        <img src="assets/seals/base.svg" alt="Base Snapshot Seal" />
        <div class="seal-label">Base Snapshot</div>
        <div class="seal-id">21A8390BFA3F · FOLDER_RECOVERY</div>
      </div>
      <div class="seal-card">
        <img src="assets/seals/delta1.svg" alt="Delta 1 Seal" />
        <div class="seal-label">Delta 1</div>
        <div class="seal-id">F3876A4BCFE1 · FOLDER_DELTA</div>
      </div>
      <div class="seal-card">
        <img src="assets/seals/delta2.svg" alt="Delta 2 Seal" />
        <div class="seal-label">Delta 2</div>
        <div class="seal-id">954BEB0FF3AA · FOLDER_DELTA</div>
      </div>
      <div class="seal-card">
        <img src="assets/seals/chain.svg" alt="Delta Chain Seal" />
        <div class="seal-label">Delta Chain</div>
        <div class="seal-id">DDE0844718A5 · DELTA_CHAIN</div>
      </div>
    </div>
  </section>

  <!-- VERIFICATION -->
  <section id="verification">
    <h2>Verification</h2>
    <p>All cryptographic verification runs against SHA-256 root hashes stored in the token JSON. No external service required.</p>
    <ul class="verify-list">
      <li><span class="badge">PASS</span> Chain restore — latest state reconstructed from base + 2 deltas</li>
      <li><span class="badge">PASS</span> Chain verify — reconstructed root hash matches expected latest root hash</li>
      <li><span class="badge">PASS</span> verify-all — FAIL: 0 across all registered tokens</li>
      <li><span class="badge">SHA-256</span> Latest state verified by root hash</li>
    </ul>
  </section>

  <!-- COMMANDS -->
  <section id="commands">
    <h2>Reproduce the Demo</h2>
    <p>From a clean clone of the repository:</p>
    <pre>npm install
npm run vsc -- demo:run</pre>
    <p style="margin-top:16px">Or run individual steps:</p>
    <pre>npm run vsc -- demo        # create test fixture
npm run vsc -- backup test-wp   # base snapshot
npm run vsc -- delta &lt;base&gt; test-wp   # delta
npm run vsc -- chain &lt;base&gt; &lt;d1&gt; &lt;d2&gt;
npm run vsc -- restore &lt;chain&gt;
npm run vsc -- verify &lt;chain&gt; &lt;restored-folder&gt;
npm run vsc -- verify-all</pre>
  </section>

  <!-- LINKS -->
  <section id="links">
    <h2>Links</h2>
    <ul class="link-list">
      <li>→ <a href="https://github.com/DigiEmu/vsc-core" target="_blank" rel="noopener">GitHub Repository — DigiEmu/vsc-core</a></li>
      <li>→ <a href="assets/gallery/gallery.html">Token Gallery (local)</a></li>
      <li>→ <a href="assets/reports/chain-report.md">Chain Storage Report (markdown)</a></li>
      <li>→ <a href="https://github.com/DigiEmu/vsc-core/tree/main/docs" target="_blank" rel="noopener">Documentation</a></li>
    </ul>
    <p style="margin-top: 20px; font-size: 0.82rem;">
      Status: research prototype / MVP proof-of-concept. Not production-ready.
    </p>
  </section>

</div>
<footer>VSC Core v1.10 · Static Showcase Export · ${NOW}</footer>
</body>
</html>`;

write(path.join(SHOWCASE, "index.html"), html);

// ── Generate showcase/README.md ───────────────────────────────────────────────

const readme = `# VSC Core — Static Showcase

Generated by VSC v1.10 on ${NOW}.

## What this is

A portable static snapshot of the VSC WordPress-style MVP proof.
It requires no server, no Node.js, and no CLI to view.
Open \`index.html\` in any browser.

## How it was generated

\`\`\`
npm run vsc -- demo:run    # run full proof flow
npm run vsc -- showcase    # export this showcase
\`\`\`

## Files included

| File | Description |
|------|-------------|
| \`index.html\` | Landing page with metrics, seals, and verification summary |
| \`assets/seals/base.svg\` | Base snapshot (FOLDER_RECOVERY) token seal |
| \`assets/seals/delta1.svg\` | Delta 1 (FOLDER_DELTA) token seal |
| \`assets/seals/delta2.svg\` | Delta 2 (FOLDER_DELTA) token seal |
| \`assets/seals/chain.svg\` | Delta chain (DELTA_CHAIN) token seal |
| \`assets/reports/chain-report.md\` | Chain storage metrics report |
| \`assets/gallery/gallery.html\` | Full token gallery |

## What is intentionally excluded

- \`output/recovery-*/\` — recovery chunk folders (can be large)
- \`output/delta-*/\` — restored delta working directories
- \`output/chain-*/\` — restored chain working directories
- \`test-wp/\` — local WordPress-style demo fixture
- Token JSON payloads (large, contain full chunk indices)
- PDF-derived tokens (large SVGs)

## How to regenerate

\`\`\`
npm run vsc -- showcase
\`\`\`

Or from scratch after a clean clone:

\`\`\`
npm install
npm run vsc -- demo:run
npm run vsc -- showcase
\`\`\`

## Publishing options

- **GitHub Pages**: commit \`showcase/\` and enable Pages from main branch.
- **Netlify Drop**: drag the \`showcase/\` folder to netlify.com/drop.
- **Static hosting**: upload \`showcase/\` contents to any static host.

The showcase is self-contained. All SVG seals are referenced as relative paths.
No external scripts or fonts are loaded.
`;

write(path.join(SHOWCASE, "README.md"), readme);

// ── Summary ───────────────────────────────────────────────────────────────────

const totalSize = fs.readdirSync(SHOWCASE, { recursive: true })
  .map(f => { try { const s = fs.statSync(path.join(SHOWCASE, f)); return s.isFile() ? s.size : 0; } catch { return 0; } })
  .reduce((a, b) => a + b, 0);

console.log("");
console.log(`Showcase exported to: showcase/`);
console.log(`Total size:           ${(totalSize / 1024).toFixed(1)} KB`);
console.log(`Open:                 showcase/index.html`);
console.log("");
