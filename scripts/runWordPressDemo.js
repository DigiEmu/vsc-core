#!/usr/bin/env node
/**
 * runWordPressDemo.js — VSC v1.9 one-command demo runner
 *
 * Usage:  npm run vsc -- demo:run
 *    or:  node scripts/runWordPressDemo.js
 *
 * Runs the complete WordPress-style VSC proof flow end-to-end:
 *   fixture → backup → change1 → delta1 → change2 → delta2 →
 *   chain → report → restore-folder → restore-chain → verify → verify-all → gallery
 */

import { spawnSync } from "child_process";
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const OUT       = path.join(ROOT, "output");
const NODE      = process.execPath;

// ── Helpers ──────────────────────────────────────────────────────────────────

let stepNum = 0;

function step(label) {
  stepNum++;
  console.log(`\n[${String(stepNum).padStart(2, "0")}] ${label}`);
  console.log("    " + "─".repeat(label.length));
}

function run(script, args = []) {
  const scriptPath = path.join(ROOT, script);
  const result = spawnSync(NODE, [scriptPath, ...args], { stdio: "inherit", cwd: ROOT });
  if (result.status !== 0) {
    console.error(`\n✗ Step failed (exit ${result.status}): ${script} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

function readManifest() {
  const p = path.join(OUT, "manifest.json");
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return []; }
}

/** Find the most-recently created manifest entry matching a predicate. */
function latestEntry(pred) {
  return readManifest()
    .filter(pred)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

function fmtBytes(n) {
  if (n < 1024)          return `${n} B`;
  if (n < 1024 * 1024)   return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Marker-guarded file mutations ─────────────────────────────────────────────

const DB_MARKER     = "-- VSC_DEMO_CHANGE_1";
const PLUGIN_MARKER = "// VSC_DEMO_CHANGE_2";

function applyDatabaseChange() {
  const dbPath = path.join(ROOT, "test-wp", "database.sql");
  const current = fs.readFileSync(dbPath, "utf8");
  if (current.includes(DB_MARKER)) {
    console.log("    (database.sql change already applied — skipping)");
    return;
  }
  const addition = `\n${DB_MARKER}\nINSERT INTO wp_options VALUES (3, 'admin_email', 'demo@vsc.local');\n`;
  fs.appendFileSync(dbPath, addition, "utf8");
  console.log("    database.sql updated.");
}

function applyPluginChange() {
  const pluginPath = path.join(
    ROOT,
    "test-wp", "wp-content", "plugins", "vsc-demo-plugin", "vsc-demo-plugin.php"
  );
  const current = fs.readFileSync(pluginPath, "utf8");
  if (current.includes(PLUGIN_MARKER)) {
    console.log("    (plugin change already applied — skipping)");
    return;
  }
  const addition = `\n${PLUGIN_MARKER}\nfunction vsc_demo_plugin_v2() { return 'v2'; }\n`;
  fs.appendFileSync(pluginPath, addition, "utf8");
  console.log("    vsc-demo-plugin.php updated.");
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("");
console.log("╔══════════════════════════════════════════╗");
console.log("║   VSC v1.9 — ONE-COMMAND DEMO            ║");
console.log("║   WordPress-style Proof Flow             ║");
console.log("╚══════════════════════════════════════════╝");

// ── Step 1: fixture ──────────────────────────────────────────────────────────
step("Create WordPress-style demo fixture");
run("scripts/createWordPressDemoFixture.js");

// ── Step 2: backup ───────────────────────────────────────────────────────────
step("Create base folder snapshot");
const t0 = Date.now();
run("src/encodeFolderCli.js", [path.join(ROOT, "test-wp"), "FOLDER"]);

// Find the most recently created FOLDER_RECOVERY entry (created at or after t0)
const baseEntry = latestEntry(
  e => e.mode === "FOLDER_RECOVERY" && new Date(e.createdAt).getTime() >= t0 - 5000
) || latestEntry(e => e.mode === "FOLDER_RECOVERY");

if (!baseEntry) { console.error("✗ Could not find base FOLDER_RECOVERY entry in manifest."); process.exit(1); }
const baseJsonPath = path.join(OUT, path.basename(baseEntry.json));
console.log(`    Base token: ${baseEntry.id}  →  ${baseJsonPath}`);

// ── Step 3: database change ───────────────────────────────────────────────────
step("Apply deterministic database change");
applyDatabaseChange();

// ── Step 4: delta 1 ───────────────────────────────────────────────────────────
step("Create delta 1 (database.sql changed)");
run("src/encodeFolderDeltaCli.js", [baseJsonPath, path.join(ROOT, "test-wp"), "FOLDER_DELTA"]);

const delta1Entry = latestEntry(
  e => e.mode === "FOLDER_DELTA" && e.baseline === baseEntry.id
);
if (!delta1Entry) { console.error("✗ Could not find delta 1 entry in manifest."); process.exit(1); }
const delta1JsonPath = path.join(OUT, path.basename(delta1Entry.json));
console.log(`    Delta 1 token: ${delta1Entry.id}  →  ${delta1JsonPath}`);

// ── Step 5: plugin change ─────────────────────────────────────────────────────
step("Apply deterministic plugin file change");
applyPluginChange();

// ── Step 6: delta 2 ───────────────────────────────────────────────────────────
step("Create delta 2 (plugin file changed)");
run("src/encodeFolderDeltaCli.js", [delta1JsonPath, path.join(ROOT, "test-wp"), "FOLDER_DELTA"]);

const delta2Entry = latestEntry(
  e => e.mode === "FOLDER_DELTA" && e.baseline === delta1Entry.id
);
if (!delta2Entry) { console.error("✗ Could not find delta 2 entry in manifest."); process.exit(1); }
const delta2JsonPath = path.join(OUT, path.basename(delta2Entry.json));
console.log(`    Delta 2 token: ${delta2Entry.id}  →  ${delta2JsonPath}`);

// ── Step 7: chain ─────────────────────────────────────────────────────────────
step("Build delta chain (base + delta 1 + delta 2)");
run("src/createDeltaChainCli.js", [baseJsonPath, delta1JsonPath, delta2JsonPath]);

const chainEntry = latestEntry(
  e => e.mode === "DELTA_CHAIN" && e.baseline === baseEntry.id
);
if (!chainEntry) { console.error("✗ Could not find chain entry in manifest."); process.exit(1); }
const chainJsonPath = path.join(OUT, path.basename(chainEntry.json));
console.log(`    Chain token: ${chainEntry.id}  →  ${chainJsonPath}`);

// ── Step 8: report ────────────────────────────────────────────────────────────
step("Generate chain storage report");
run("src/reportChainCli.js", [chainJsonPath]);

// ── Step 9: restore base folder (prerequisite for chain restore) ──────────────
step("Restore base folder (prerequisite for chain restore)");
run("src/restoreFolder.js", [baseJsonPath]);

// ── Step 10: restore chain ────────────────────────────────────────────────────
step("Restore latest state from chain");
run("src/restoreDeltaChain.js", [chainJsonPath]);

// Compute restored folder path from chain token
const chainToken   = JSON.parse(fs.readFileSync(chainJsonPath, "utf8"));
const restoredDir  = path.join(OUT, `chain-${chainToken.baseTokenId}-to-${chainToken.latestTokenId}`, `restored-${chainToken.sourceFolderName}`);
console.log(`    Restored folder: ${restoredDir}`);

// ── Step 11: verify chain ─────────────────────────────────────────────────────
step("Verify restored latest state");
run("src/verifyDeltaChain.js", [chainJsonPath, restoredDir]);

// ── Step 12: verify all ───────────────────────────────────────────────────────
step("Verify all registered tokens");
run("src/verifyAll.js");

// ── Step 13: open gallery ─────────────────────────────────────────────────────
step("Open gallery");
const galleryPath = path.join(OUT, "gallery.html");
if (process.platform === "win32") {
  spawnSync("cmd", ["/c", "start", "", galleryPath], { stdio: "inherit", shell: false });
} else {
  console.log(`    Gallery: ${galleryPath}`);
}

// ── Final summary ─────────────────────────────────────────────────────────────

console.log("");
console.log("╔══════════════════════════════════════════╗");
console.log("║   DEMO RESULT: PASS                      ║");
console.log("╚══════════════════════════════════════════╝");
console.log("");
console.log("Token summary:");
console.log(`  Base      ${baseEntry.id}   ${baseJsonPath}`);
console.log(`  Delta 1   ${delta1Entry.id}   ${delta1JsonPath}`);
console.log(`  Delta 2   ${delta2Entry.id}   ${delta2JsonPath}`);
console.log(`  Chain     ${chainEntry.id}   ${chainJsonPath}`);
console.log(`  Restored  ${restoredDir}`);
console.log("");

// Read chain token for metrics
try {
  const ct = JSON.parse(fs.readFileSync(chainJsonPath, "utf8"));
  const totalDelta = ct.steps.reduce((s, st) => s + (st.deltaSizeBytes || 0), 0);
  const baseSizeBytes = baseEntry.fileSizeBytes || 0;
  const fullCopy = baseSizeBytes * (ct.steps.length + 1);
  const reduction = fullCopy > 0
    ? (((fullCopy - (baseSizeBytes + totalDelta)) / fullCopy) * 100).toFixed(2)
    : "—";
  const deltaOnly = baseSizeBytes > 0
    ? (((baseSizeBytes - totalDelta) / baseSizeBytes) * 100).toFixed(2)
    : "—";

  console.log("Chain metrics:");
  console.log(`  Base token ID:         ${ct.baseTokenId}`);
  console.log(`  Latest token ID:       ${ct.latestTokenId}`);
  console.log(`  Steps:                 ${ct.steps.length}`);
  console.log(`  Total delta size:      ${fmtBytes(totalDelta)}`);
  console.log(`  Total chain reduction: ${reduction}%`);
  console.log(`  Delta-only reduction:  ${deltaOnly}%`);
  console.log(`  Chain hash prefix:     ${(ct.proof?.chainHash || ct.chainHash || "").slice(0, 24)}`);
} catch {
  // metrics are best-effort
}

console.log("");
