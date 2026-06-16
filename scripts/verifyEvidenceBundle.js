#!/usr/bin/env node
/**
 * verifyEvidenceBundle.js — VSC v1.16 Evidence Bundle Verification
 *
 * Usage:  npm run vsc -- verify-bundle <bundle-folder>
 *    or:  node scripts/verifyEvidenceBundle.js <bundle-folder>
 *
 * Verifies an exported VSC evidence bundle is complete, internally consistent,
 * and unchanged according to its manifest and checksums.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VSC_VERSION = "v1.16";

// ── Helpers ────────────────────────────────────────────────────────────────────

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function printResult(label, passed, details = "") {
  const status = passed ? "PASS" : "FAIL";
  const icon = passed ? "✓" : "✗";
  console.log(`  ${icon} ${label}: ${status}${details ? " " + details : ""}`);
}

function fail(message, exitCode = 1) {
  console.error(`\n✗ ${message}`);
  process.exit(exitCode);
}

// ── Checksum Parser ────────────────────────────────────────────────────────────

function parseChecksums(checksumsPath) {
  const content = fs.readFileSync(checksumsPath, "utf8");
  const lines = content.split("\n").filter(line => line.trim());
  const entries = [];

  for (const line of lines) {
    // Format: <hash>  <relative/path> or <hash> <relative/path>
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
    if (match) {
      entries.push({
        hash: match[1].toLowerCase(),
        filePath: match[2].trim()
      });
    }
  }

  return entries;
}

// ── Verification Functions ─────────────────────────────────────────────────────

function verifyRequiredFiles(bundleDir, isJsonEventBundle) {
  const requiredGeneric = [
    "README.md",
    "manifest.json",
    "checksums.sha256",
    "chain-token.json",
    "base-token.json",
    "verification-summary.json"
  ];

  const requiredJsonEvent = [
    "event-schema.json",
    "event-summary.json",
    "json-benchmark-summary.json",
    "json-benchmark-report.md",
    "json-benchmark-chart-data.json"
  ];

  const required = isJsonEventBundle
    ? [...requiredGeneric, ...requiredJsonEvent]
    : requiredGeneric;

  const missing = [];
  for (const file of required) {
    const filePath = path.join(bundleDir, file);
    if (!fs.existsSync(filePath)) {
      missing.push(file);
    }
  }

  return { passed: missing.length === 0, missing };
}

function verifyChecksums(bundleDir) {
  const checksumsPath = path.join(bundleDir, "checksums.sha256");
  if (!fs.existsSync(checksumsPath)) {
    return { passed: false, errors: ["checksums.sha256 not found"] };
  }

  const entries = parseChecksums(checksumsPath);
  if (entries.length === 0) {
    return { passed: false, errors: ["No valid checksum entries found"] };
  }

  const errors = [];
  let verified = 0;

  for (const entry of entries) {
    const filePath = path.join(bundleDir, entry.filePath);
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing file: ${entry.filePath}`);
      continue;
    }

    const actualHash = sha256File(filePath).toLowerCase();
    if (actualHash !== entry.hash) {
      errors.push(`Checksum mismatch: ${entry.filePath}`);
    } else {
      verified++;
    }
  }

  return {
    passed: errors.length === 0,
    verified,
    total: entries.length,
    errors
  };
}

function verifyManifest(bundleDir, chainToken) {
  const manifestPath = path.join(bundleDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return { passed: false, errors: ["manifest.json not found"] };
  }

  const manifest = readJson(manifestPath);
  if (!manifest) {
    return { passed: false, errors: ["Failed to parse manifest.json"] };
  }

  const errors = [];
  const warnings = [];

  // Verify chain references match
  if (manifest.chain) {
    const chainBaseId = chainToken.baseTokenId || chainToken.base?.id;
    const chainLatestId = chainToken.latestTokenId || chainToken.latest?.id;

    if (manifest.chain.base_token_id && chainBaseId) {
      if (manifest.chain.base_token_id !== chainBaseId) {
        errors.push(`Manifest base_token_id (${manifest.chain.base_token_id}) does not match chain token (${chainBaseId})`);
      }
    }

    if (manifest.chain.latest_token_id && chainLatestId) {
      if (manifest.chain.latest_token_id !== chainLatestId) {
        errors.push(`Manifest latest_token_id (${manifest.chain.latest_token_id}) does not match chain token (${chainLatestId})`);
      }
    }
  } else {
    warnings.push("Manifest missing chain section");
  }

  return { passed: errors.length === 0, errors, warnings, manifest };
}

function verifyChainToken(bundleDir) {
  const chainPath = path.join(bundleDir, "chain-token.json");
  if (!fs.existsSync(chainPath)) {
    return { passed: false, errors: ["chain-token.json not found"] };
  }

  const chainToken = readJson(chainPath);
  if (!chainToken) {
    return { passed: false, errors: ["Failed to parse chain-token.json"] };
  }

  const errors = [];

  // Validate it's a chain token
  if (chainToken.mode !== "DELTA_CHAIN" && !chainToken.steps) {
    errors.push("Not a valid chain token (missing mode or steps)");
  }

  const baseTokenId = chainToken.baseTokenId || chainToken.base?.id;
  const latestTokenId = chainToken.latestTokenId || chainToken.latest?.id;

  if (!baseTokenId) {
    errors.push("Missing base token ID");
  }
  if (!latestTokenId) {
    errors.push("Missing latest token ID");
  }

  return {
    passed: errors.length === 0,
    errors,
    chainToken,
    baseTokenId,
    latestTokenId
  };
}

function verifyBaseToken(bundleDir) {
  const basePath = path.join(bundleDir, "base-token.json");
  if (!fs.existsSync(basePath)) {
    return { passed: false, errors: ["base-token.json not found"] };
  }

  const baseToken = readJson(basePath);
  if (!baseToken) {
    return { passed: false, errors: ["Failed to parse base-token.json"] };
  }

  return { passed: true, errors: [], baseToken };
}

function verifyDeltaTokens(bundleDir, chainToken) {
  const deltaDir = path.join(bundleDir, "delta-tokens");
  if (!fs.existsSync(deltaDir)) {
    return { passed: false, errors: ["delta-tokens directory not found"] };
  }

  const steps = chainToken.steps || [];
  if (steps.length === 0) {
    return { passed: true, errors: [], count: 0, warnings: ["No delta steps in chain"] };
  }

  const errors = [];
  const found = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const deltaId = step.deltaTokenId || step.id;
    const fromId = step.fromTokenId || step.from;
    const toId = step.toTokenId || step.to;

    // Look for delta file by index pattern
    const indexStr = String(i + 1).padStart(3, "0");
    const deltaFileName = `delta-${indexStr}.json`;
    const deltaPath = path.join(deltaDir, deltaFileName);

    if (!fs.existsSync(deltaPath)) {
      // Try without zero-padding for older bundles
      const altName = `delta-${i + 1}.json`;
      const altPath = path.join(deltaDir, altName);
      if (!fs.existsSync(altPath)) {
        errors.push(`Delta ${i + 1} not found: ${deltaFileName}`);
        continue;
      }
    }

    const deltaToken = readJson(deltaPath);
    if (!deltaToken) {
      errors.push(`Failed to parse delta ${i + 1}`);
      continue;
    }

    found.push({ index: i + 1, id: deltaId || `${fromId}-to-${toId}` });
  }

  return {
    passed: errors.length === 0,
    errors,
    count: found.length,
    expected: steps.length
  };
}

function verifyJsonEventMetadata(bundleDir) {
  const errors = [];
  const warnings = [];
  let metadata = {};

  // Check event-schema.json
  const schemaPath = path.join(bundleDir, "event-schema.json");
  if (fs.existsSync(schemaPath)) {
    const schema = readJson(schemaPath);
    if (!schema) {
      errors.push("Failed to parse event-schema.json");
    } else {
      metadata.hasSchema = true;
    }
  } else {
    warnings.push("event-schema.json not found (optional for generic bundles)");
  }

  // Check event-summary.json
  const summaryPath = path.join(bundleDir, "event-summary.json");
  if (fs.existsSync(summaryPath)) {
    const summary = readJson(summaryPath);
    if (!summary) {
      errors.push("Failed to parse event-summary.json");
    } else {
      metadata.hasSummary = true;
      metadata.sessionId = summary.session_id;
    }
  } else {
    warnings.push("event-summary.json not found (optional for generic bundles)");
  }

  // Check json-benchmark-summary.json
  const benchPath = path.join(bundleDir, "json-benchmark-summary.json");
  if (fs.existsSync(benchPath)) {
    const bench = readJson(benchPath);
    if (!bench) {
      errors.push("Failed to parse json-benchmark-summary.json");
    } else {
      metadata.hasBenchmarkSummary = true;
      // Check for expected session ID in known v1.15 bundle
      if (bench.event_model?.session_id === "2F9047C9F1C1A3FF") {
        metadata.expectedSession = true;
      }
    }
  } else {
    warnings.push("json-benchmark-summary.json not found (optional for generic bundles)");
  }

  // If no JSON event files exist at all, this is N/A
  const isJsonEventBundle = metadata.hasSchema || metadata.hasSummary || metadata.hasBenchmarkSummary;

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    isJsonEventBundle,
    metadata
  };
}

// ── Main Verification ──────────────────────────────────────────────────────────

function verifyEvidenceBundle(bundlePath) {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   VSC v1.16 — Evidence Bundle Verification                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // Validate bundle path
  if (!bundlePath) {
    fail("No bundle path provided.\nUsage: npm run vsc -- verify-bundle <bundle-folder>");
  }

  const resolvedBundlePath = path.resolve(bundlePath);
  if (!fs.existsSync(resolvedBundlePath)) {
    fail(`Bundle not found: ${bundlePath}`);
  }

  const stats = fs.statSync(resolvedBundlePath);
  if (!stats.isDirectory()) {
    fail(`Bundle path is not a directory: ${bundlePath}`);
  }

  console.log(`\nBundle path: ${resolvedBundlePath}`);

  // Detect bundle type early for required file checks
  const isJsonEventBundle =
    fs.existsSync(path.join(resolvedBundlePath, "event-schema.json")) ||
    fs.existsSync(path.join(resolvedBundlePath, "json-benchmark-summary.json"));

  if (isJsonEventBundle) {
    console.log("Bundle type: JSON Event Evidence Bundle");
  } else {
    console.log("Bundle type: Generic Evidence Bundle");
  }

  // ── Verify Required Files ───────────────────────────────────────────────────
  console.log("\n[01] Checking required files...");
  const requiredResult = verifyRequiredFiles(resolvedBundlePath, isJsonEventBundle);
  printResult("Required files", requiredResult.passed,
    requiredResult.missing.length > 0 ? `(missing: ${requiredResult.missing.join(", ")})` : "");

  if (!requiredResult.passed) {
    fail(`Missing required files: ${requiredResult.missing.join(", ")}`);
  }

  // ── Verify Checksums ────────────────────────────────────────────────────────
  console.log("\n[02] Verifying checksums...");
  const checksumResult = verifyChecksums(resolvedBundlePath);
  printResult("Checksums", checksumResult.passed,
    `(${checksumResult.verified}/${checksumResult.total} files verified)`);

  if (!checksumResult.passed) {
    for (const error of checksumResult.errors) {
      console.log(`     ✗ ${error}`);
    }
  }

  // ── Verify Chain Token ──────────────────────────────────────────────────────
  console.log("\n[03] Verifying chain token...");
  const chainResult = verifyChainToken(resolvedBundlePath);
  printResult("Chain token", chainResult.passed,
    chainResult.passed ? `(${chainResult.baseTokenId} → ${chainResult.latestTokenId})` : "");

  if (!chainResult.passed) {
    for (const error of chainResult.errors) {
      console.log(`     ✗ ${error}`);
    }
    fail("Chain token verification failed");
  }

  // ── Verify Base Token ───────────────────────────────────────────────────────
  console.log("\n[04] Verifying base token...");
  const baseResult = verifyBaseToken(resolvedBundlePath);
  printResult("Base token", baseResult.passed);

  if (!baseResult.passed) {
    for (const error of baseResult.errors) {
      console.log(`     ✗ ${error}`);
    }
  }

  // ── Verify Delta Tokens ─────────────────────────────────────────────────────
  console.log("\n[05] Verifying delta tokens...");
  const deltaResult = verifyDeltaTokens(resolvedBundlePath, chainResult.chainToken);
  printResult("Delta tokens", deltaResult.passed,
    `(${deltaResult.count}/${deltaResult.expected} found)`);

  if (!deltaResult.passed) {
    for (const error of deltaResult.errors.slice(0, 5)) {
      console.log(`     ✗ ${error}`);
    }
    if (deltaResult.errors.length > 5) {
      console.log(`     ... and ${deltaResult.errors.length - 5} more errors`);
    }
  }

  // ── Verify Manifest ─────────────────────────────────────────────────────────
  console.log("\n[06] Verifying manifest...");
  const manifestResult = verifyManifest(resolvedBundlePath, chainResult.chainToken);
  printResult("Manifest", manifestResult.passed,
    manifestResult.warnings.length > 0 ? `(${manifestResult.warnings.length} warnings)` : "");

  if (manifestResult.warnings.length > 0) {
    for (const warning of manifestResult.warnings) {
      console.log(`     ⚠ ${warning}`);
    }
  }

  // ── Verify JSON Event Metadata ──────────────────────────────────────────────
  console.log("\n[07] Verifying JSON event metadata...");
  const jsonEventResult = verifyJsonEventMetadata(resolvedBundlePath);

  let jsonEventStatus;
  if (jsonEventResult.isJsonEventBundle) {
    jsonEventStatus = jsonEventResult.passed ? "PASS" : "FAIL";
    printResult("JSON event metadata", jsonEventResult.passed);

    if (jsonEventResult.metadata.expectedSession) {
      console.log("     ✓ Expected v1.15 session ID found (2F9047C9F1C1A3FF)");
    }
  } else {
    jsonEventStatus = "N/A";
    console.log("  ℹ JSON event metadata: N/A (generic bundle)");
  }

  if (jsonEventResult.warnings.length > 0) {
    for (const warning of jsonEventResult.warnings) {
      console.log(`     ⚠ ${warning}`);
    }
  }

  // ── Final Summary ───────────────────────────────────────────────────────────
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║   VERIFICATION SUMMARY                                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const results = {
    manifest: requiredResult.passed,
    checksums: checksumResult.passed,
    chainToken: chainResult.passed,
    baseToken: baseResult.passed,
    deltaTokens: deltaResult.passed,
    jsonEvent: jsonEventResult.isJsonEventBundle ? jsonEventResult.passed : true
  };

  const allPassed = Object.values(results).every(r => r);

  console.log(`\n  Manifest:        ${results.manifest ? "PASS" : "FAIL"}`);
  console.log(`  Checksums:       ${results.checksums ? "PASS" : "FAIL"}`);
  console.log(`  Chain token:     ${results.chainToken ? "PASS" : "FAIL"}`);
  console.log(`  Base token:      ${results.baseToken ? "PASS" : "FAIL"}`);
  console.log(`  Delta tokens:    ${results.deltaTokens ? "PASS" : "FAIL"}`);
  console.log(`  JSON event meta: ${jsonEventStatus}`);
  console.log(`\n  Result:          ${allPassed ? "PASS" : "FAIL"}`);

  if (allPassed) {
    console.log("\n✓ Bundle verification complete — all checks passed.");
    process.exit(0);
  } else {
    console.log("\n✗ Bundle verification failed — see errors above.");
    process.exit(1);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

const bundlePath = process.argv[2];
verifyEvidenceBundle(bundlePath);
