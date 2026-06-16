#!/usr/bin/env node
/**
 * zipEvidenceBundle.js — VSC v1.17 ZIP Bundle Export
 *
 * Usage:  npm run vsc -- zip-bundle <bundle-folder>
 *    or:  node scripts/zipEvidenceBundle.js <bundle-folder>
 *
 * Creates a portable .zip file from an existing VSC evidence bundle folder
 * without changing the bundle contents.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const archiver = require("archiver");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VSC_VERSION = "v1.17";

// ── Helpers ────────────────────────────────────────────────────────────────────

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

async function zipEvidenceBundle(bundlePath) {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   VSC v1.17 — ZIP Bundle Export                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // Validate bundle path
  if (!bundlePath) {
    die("No bundle path provided.\nUsage: npm run vsc -- zip-bundle <bundle-folder>");
  }

  const resolvedBundlePath = path.resolve(bundlePath);
  if (!fs.existsSync(resolvedBundlePath)) {
    die(`Bundle not found: ${bundlePath}`);
  }

  const stats = fs.statSync(resolvedBundlePath);
  if (!stats.isDirectory()) {
    die(`Bundle path is not a directory: ${bundlePath}`);
  }

  console.log(`\nBundle path: ${resolvedBundlePath}`);

  // Get bundle folder name for ZIP filename
  const bundleName = path.basename(resolvedBundlePath);
  const zipFileName = `${bundleName}.zip`;

  // Create output/zips directory
  const zipsDir = path.join(ROOT, "output", "zips");
  if (!fs.existsSync(zipsDir)) {
    fs.mkdirSync(zipsDir, { recursive: true });
  }

  const zipPath = path.join(zipsDir, zipFileName);

  // Remove existing ZIP if present
  if (fs.existsSync(zipPath)) {
    console.log(`Removing existing ZIP: ${zipPath}`);
    fs.rmSync(zipPath, { force: true });
  }

  // Count files before zipping
  const fileCount = countFiles(resolvedBundlePath);
  console.log(`Files to include: ${fileCount}`);

  // Create ZIP archive
  const output = fs.createWriteStream(zipPath);
  const archive = new archiver.ZipArchive({
    zlib: { level: 9 } // Maximum compression
  });

  // Handle archive events
  archive.on("warning", (err) => {
    if (err.code === "ENOENT") {
      console.warn(`  ⚠ Warning: ${err.message}`);
    } else {
      throw err;
    }
  });

  archive.on("error", (err) => {
    die(`Archive error: ${err.message}`);
  });

  // Pipe archive data to the file
  archive.pipe(output);

  // Add bundle directory contents to archive
  // Use the bundle name as the root directory inside the ZIP
  archive.directory(resolvedBundlePath, bundleName);

  // Finalize the archive
  await archive.finalize();

  // Wait for the output stream to finish
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
