#!/usr/bin/env node
/**
 * demoEvidenceFlow.js — VSC v1.18 Evidence Flow Demo
 *
 * Usage:  npm run vsc -- demo:evidence-flow
 *    or:  node scripts/demoEvidenceFlow.js
 *
 * Orchestrates the complete VSC evidence handoff flow in one command:
 *   Export Evidence Bundle → Verify Evidence Bundle → ZIP Evidence Bundle
 *
 * This script is a thin orchestrator. All evidence logic, checksum binding,
 * manifest integrity, and ZIP creation remain in their respective scripts:
 *   - exportJsonEventBundle.js   (bundle export)
 *   - verifyEvidenceBundle.js    (read-only verification)
 *   - zipEvidenceBundle.js       (portable handoff artifact)
 *
 * Fail-closed: any failing step immediately stops the flow and exits non-zero.
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Runs a script in a child process, streaming its output to the terminal.
 * Returns the exit code. Does not call process.exit — the caller decides
 * whether to continue or abort, preserving fail-closed orchestration.
 */
function runStep(scriptRelPath, extraArgs = []) {
  const scriptPath = path.join(ROOT, scriptRelPath);
  const result = spawnSync(
    process.execPath,
    [scriptPath, ...extraArgs],
    { stdio: "inherit", cwd: ROOT }
  );
  return result.status ?? 1;
}

function stepHeader(number, label) {
  console.log(`\n[${number}] ${label}`);
  console.log("─".repeat(60));
}

function die(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

/**
 * Locates the most recently modified directory under output/json-event-bundles/.
 * Used after export to identify the bundle that was just created or refreshed,
 * without hardcoding a specific bundle name.
 *
 * Returns null if no bundle directories exist yet.
 */
function findLatestJsonEventBundle() {
  const bundlesDir = path.join(ROOT, "output", "json-event-bundles");
  if (!fs.existsSync(bundlesDir)) return null;

  const entries = fs.readdirSync(bundlesDir, { withFileTypes: true });
  const dirs = entries
    .filter(e => e.isDirectory())
    .map(e => {
      const fullPath = path.join(bundlesDir, e.name);
      const stat = fs.statSync(fullPath);
      return { name: e.name, fullPath, mtime: stat.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime); // most recent first

  return dirs.length > 0 ? dirs[0].fullPath : null;
}

// ── Main Flow ──────────────────────────────────────────────────────────────────

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║   VSC v1.18 — Evidence Flow Demo                           ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log();
console.log("  Flow:  Export  →  Verify  →  ZIP  →  Summary");
console.log();

// ── Step 01: Export JSON Event Evidence Bundle ─────────────────────────────────

stepHeader("01", "Exporting JSON Event Evidence Bundle");

const exportStatus = runStep("scripts/exportJsonEventBundle.js", []);
if (exportStatus !== 0) {
  die("Evidence bundle export failed — stopping flow.");
}

// ── Step 02: Locate the bundle ─────────────────────────────────────────────────

stepHeader("02", "Locating Evidence Bundle");

const bundlePath = findLatestJsonEventBundle();
if (!bundlePath) {
  die("No JSON event bundle found in output/json-event-bundles/ after export.");
}

const bundleName = path.basename(bundlePath);
const zipFileName = `${bundleName}.zip`;
const zipPath = path.join(ROOT, "output", "zips", zipFileName);

console.log(`  ✓ Bundle: ${bundlePath}`);

// ── Step 03: Verify the bundle ─────────────────────────────────────────────────

stepHeader("03", "Verifying Evidence Bundle");

const verifyStatus = runStep("scripts/verifyEvidenceBundle.js", [bundlePath]);
if (verifyStatus !== 0) {
  die("Bundle verification failed — stopping flow.");
}

// ── Step 04: ZIP the bundle ────────────────────────────────────────────────────

stepHeader("04", "Creating ZIP Handoff Artifact");

const zipStatus = runStep("scripts/zipEvidenceBundle.js", [bundlePath]);
if (zipStatus !== 0) {
  die("ZIP bundle creation failed — stopping flow.");
}

// ── Step 05: Final Summary ─────────────────────────────────────────────────────

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║   EVIDENCE FLOW DEMO COMPLETE                              ║");
console.log("╚════════════════════════════════════════════════════════════╝");

console.log(`
  Bundle path:          output\\json-event-bundles\\${bundleName}
  ZIP path:             output\\zips\\${zipFileName}
  Verification result:  PASS
  ZIP export result:    PASS

  Final result:         PASS
`);

console.log("✓ Evidence handoff flow complete.");
console.log();
console.log("Next steps:");
console.log(`  1. Verify independently:  npm run vsc -- verify-bundle output\\json-event-bundles\\${bundleName}`);
console.log(`  2. ZIP independently:     npm run vsc -- zip-bundle output\\json-event-bundles\\${bundleName}`);
console.log(`  3. Share artifact:        output\\zips\\${zipFileName}`);
console.log();
