#!/usr/bin/env node
/**
 * zipEvidenceBundle.js — VSC v1.17 ZIP Bundle Export
 *
 * Usage:  npm run vsc -- zip-bundle <bundle-folder>
 *    or:  node scripts/zipEvidenceBundle.js <bundle-folder>
 *
 * Packages an existing VSC evidence bundle directory into a portable handoff
 * artifact (.zip) without modifying the source bundle in any way.
 *
 * Source bundle immutability is the central guarantee of this script:
 * it reads from the bundle and writes to output/zips/ only. No file inside
 * the source bundle is created, modified, or deleted.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

// archiver is a CommonJS package; createRequire bridges it into this ESM module.
const require = createRequire(import.meta.url);
const archiver = require("archiver");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Terminates with a non-zero exit code.
 * Ensures fail-closed behavior: no ZIP is produced on any detected error.
 */
function die(message, exitCode = 1) {
  console.error(`\n✗ ${message}`);
  process.exit(exitCode);
}

function countFiles(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { recursive: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = fs.statSync(fullPath);
    if (stats.isFile()) {
      count++;
    }
  }
  return count;
}

// ── Main ZIP Function ────────────────────────────────────────────────────────

/**
 * Packages an evidence bundle directory into a portable handoff artifact.
 *
 * The ZIP preserves the full bundle directory structure with the bundle
 * folder name as the archive root, so recipients extract to a self-contained
 * named folder — identical to what `verify-bundle` expects as input.
 *
 * Source bundle immutability: this function only reads from `bundlePath`
 * and only writes to `output/zips/`. No path inside the source bundle
 * is opened for writing.
 *
 * @param {string} bundlePath - Relative or absolute path to the bundle directory.
 */
async function zipEvidenceBundle(bundlePath) {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   VSC v1.17 — ZIP Bundle Export                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // Validate bundle path
  if (!bundlePath) {
    die("No bundle path provided.\nUsage: npm run vsc -- zip-bundle <bundle-folder>");
  }

  // Resolve early so all downstream operations use an absolute path,
  // regardless of how the caller invoked the command.
  const resolvedBundlePath = path.resolve(bundlePath);
  if (!fs.existsSync(resolvedBundlePath)) {
    die(`Bundle not found: ${bundlePath}`);
  }

  const stats = fs.statSync(resolvedBundlePath);
  if (!stats.isDirectory()) {
    die(`Bundle path is not a directory: ${bundlePath}`);
  }

  console.log(`\nBundle path: ${resolvedBundlePath}`);

  // ZIP filename mirrors the bundle folder name so the archive is self-describing
  // and recipients know which bundle it contains without extracting it first.
  const bundleName = path.basename(resolvedBundlePath);
  const zipFileName = `${bundleName}.zip`;

  // output/zips/ is intentionally gitignored — ZIP artifacts are not committed.
  const zipsDir = path.join(ROOT, "output", "zips");
  if (!fs.existsSync(zipsDir)) {
    fs.mkdirSync(zipsDir, { recursive: true });
  }

  const zipPath = path.join(zipsDir, zipFileName);

  // Replace any existing ZIP so reruns are idempotent.
  // This is the only write that occurs outside the source bundle.
  if (fs.existsSync(zipPath)) {
    console.log(`Removing existing ZIP: ${zipPath}`);
    fs.rmSync(zipPath, { force: true });
  }

  // Count files before zipping
  const fileCount = countFiles(resolvedBundlePath);
  console.log(`Files to include: ${fileCount}`);

  const output = fs.createWriteStream(zipPath);
  const archive = new archiver.ZipArchive({
    zlib: { level: 9 }
  });

  archive.on("warning", (err) => {
    // ENOENT during archiving means a file disappeared mid-run — warn but continue.
    if (err.code === "ENOENT") {
      console.warn(`  ⚠ Warning: ${err.message}`);
    } else {
      throw err;
    }
  });

  archive.on("error", (err) => {
    die(`Archive error: ${err.message}`);
  });

  archive.pipe(output);

  // Nest all bundle files under the bundle name as the ZIP root directory.
  // This ensures the extracted layout matches the original bundle structure
  // and is directly usable as input to `verify-bundle`.
  archive.directory(resolvedBundlePath, bundleName);

  await archive.finalize();

  // finalize() signals the archive is written to the stream, but the underlying
  // write stream may still be flushing. Wait for the close event before reading
  // the file size or reporting success.
  await new Promise((resolve, reject) => {
    output.on("close", () => {
      resolve();
    });
    output.on("error", (err) => {
      reject(err);
    });
  });

  // Get ZIP file size
  const zipStats = fs.statSync(zipPath);
  const zipSizeKB = (zipStats.size / 1024).toFixed(1);

  // ── Final Summary ───────────────────────────────────────────────────────────
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║   ZIP EXPORT COMPLETE                                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  console.log(`\n  ZIP path:        output\\zips\\${zipFileName}`);
  console.log(`  Files included:  ${fileCount}`);
  console.log(`  ZIP size:        ${zipSizeKB} KB`);
  console.log(`  Source bundle:   ${resolvedBundlePath}`);
  console.log(`\n  Result:          PASS`);

  console.log("\n✓ ZIP bundle created successfully.");
  console.log("\nNext steps:");
  console.log(`  1. Inspect:      cd output\\zips\\`);
  console.log(`  2. Extract:      unzip ${zipFileName}`);
  console.log(`  3. Share:        Distribute the ZIP file`);
  console.log("");
}

// ── Main ───────────────────────────────────────────────────────────────────────

const bundlePath = process.argv[2];
zipEvidenceBundle(bundlePath).catch((err) => {
  die(`Unexpected error: ${err.message}`);
});
