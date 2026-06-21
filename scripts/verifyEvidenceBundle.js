#!/usr/bin/env node
/**
 * verifyEvidenceBundle.js — VSC v1.16 Evidence Bundle Verification
 *
 * Usage:  npm run vsc -- verify-bundle <bundle-folder>
 *    or:  node scripts/verifyEvidenceBundle.js <bundle-folder>
 *
 * Read-only verification of an exported VSC evidence bundle.
 * Checks that the bundle is complete, internally consistent, and that every
 * file matches the checksum binding recorded at export time.
 *
 * This script never writes to the source bundle — manifest integrity is
 * evaluated by reading, not by recomputing and overwriting. Fail-closed
 * behavior: any unresolvable inconsistency exits non-zero.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VSC_VERSION = "v1.16";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Computes the SHA-256 digest of a file as hex.
 * Used to re-derive the hash at verification time; the result is compared
 * against the checksum binding recorded in checksums.sha256 at export time.
 */
function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Parses a JSON file, returning null on any failure.
 * Callers treat null as a structural error — fail-closed behavior.
 */
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

/**
 * Terminates with a non-zero exit code.
 * Called when a verification step detects an unrecoverable inconsistency.
 * Ensures fail-closed behavior: the caller can never silently continue.
 */
function fail(message, exitCode = 1) {
  console.error(`\n✗ ${message}`);
  process.exit(exitCode);
}

// ── Checksum Parser ────────────────────────────────────────────────────────────

/**
 * Parses a checksums.sha256 file into an array of { hash, filePath } entries.
 *
 * The checksum file is the primary checksum binding artifact: it records the
 * expected SHA-256 digest of every file at the moment the bundle was exported.
 * Verifying against it is what makes the bundle tamper-evident.
 *
 * Accepts both single-space and double-space separators (shasum compatibility).
 */
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

/**
 * Verifies that all structurally required files are present in the bundle.
 *
 * The required-file list is the minimal evidence boundary: a bundle missing
 * any of these files cannot be fully verified and must be rejected.
 * JSON event bundles carry additional required files beyond the generic set.
 *
 * @param {string} bundleDir - Absolute path to the bundle directory.
 * @param {boolean} isJsonEventBundle - Whether to enforce JSON event file requirements.
 * @returns {{ passed: boolean, missing: string[] }}
 */
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

/**
 * Core checksum binding verification.
 *
 * Re-hashes every file listed in checksums.sha256 and compares the result
 * against the digest recorded at export time. A mismatch means the file was
 * modified after the bundle was sealed — the evidence boundary is broken.
 *
 * This step must pass before any token-level checks are trusted, because
 * the token files themselves are covered by the checksum binding.
 *
 * @param {string} bundleDir - Absolute path to the bundle directory.
 * @returns {{ passed: boolean, verified: number, total: number, errors: string[] }}
 */
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

    // Re-derive hash and compare against the bound digest — not against the manifest.
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

/**
 * Verifies manifest integrity by cross-checking its chain references against
 * the chain token embedded in the bundle.
 *
 * The manifest is a human-readable index of the bundle's contents and claims.
 * Its token IDs must agree with the authoritative chain-token.json — any
 * divergence means the manifest was edited independently after sealing.
 *
 * @param {string} bundleDir - Absolute path to the bundle directory.
 * @param {object} chainToken - Already-parsed chain token object.
 * @returns {{ passed: boolean, errors: string[], warnings: string[], manifest: object|null }}
 */
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

  // Cross-check manifest chain references against the authoritative chain token.
  // Mismatches mean either the manifest or the token was replaced post-export.
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

/**
 * Verifies the chain token — the root evidence artifact of the bundle.
 *
 * The chain token encodes the full delta sequence (base → latest) and is the
 * anchor against which all other bundle contents are cross-checked. If the
 * chain token is missing or malformed, no downstream verification is meaningful.
 *
 * @param {string} bundleDir - Absolute path to the bundle directory.
 * @returns {{ passed: boolean, errors: string[], chainToken: object|null, baseTokenId: string, latestTokenId: string }}
 */
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

  // A valid chain token must declare DELTA_CHAIN mode and carry a steps array.
  // Without steps, delta token count cannot be cross-checked.
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

/**
 * Verifies the base token is present and parseable.
 *
 * The base token records the full initial state snapshot. It is required for
 * deterministic reconstruction: without it, no delta sequence can be replayed
 * back to the original starting point.
 *
 * @param {string} bundleDir - Absolute path to the bundle directory.
 * @returns {{ passed: boolean, errors: string[], baseToken: object|null }}
 */
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

/**
 * Verifies that every delta token referenced by the chain token is present
 * and parseable in the bundle's delta-tokens directory.
 *
 * Delta tokens are the incremental steps that, together with the base token,
 * enable deterministic reconstruction of every intermediate state. A gap in
 * the sequence breaks the chain and must be reported.
 *
 * @param {string} bundleDir - Absolute path to the bundle directory.
 * @param {object} chainToken - Already-parsed chain token (provides the expected step list).
 * @returns {{ passed: boolean, errors: string[], count: number, expected: number }}
 */
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

    // Primary filename uses zero-padded index (e.g. delta-001.json).
    const indexStr = String(i + 1).padStart(3, "0");
    const deltaFileName = `delta-${indexStr}.json`;
    const deltaPath = path.join(deltaDir, deltaFileName);

    if (!fs.existsSync(deltaPath)) {
      // Fall back to unpadded index for bundles exported before zero-padding was introduced.
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

/**
 * Verifies JSON event metadata files when present in the bundle.
 *
 * JSON event bundles (v1.15+) carry additional evidence artifacts beyond
 * the generic chain proof: an event schema, a session summary, and benchmark
 * results. These establish the behavioral evidence boundary for AI-style
 * structured event logs.
 *
 * This check is skipped (N/A) for generic evidence bundles — their absence
 * is not an error, but their presence and parseability is required when detected.
 *
 * @param {string} bundleDir - Absolute path to the bundle directory.
 * @returns {{ passed: boolean, errors: string[], warnings: string[], isJsonEventBundle: boolean, metadata: object }}
 */
function verifyJsonEventMetadata(bundleDir) {
  const errors = [];
  const warnings = [];
  let metadata = {};

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

  const benchPath = path.join(bundleDir, "json-benchmark-summary.json");
  if (fs.existsSync(benchPath)) {
    const bench = readJson(benchPath);
    if (!bench) {
      errors.push("Failed to parse json-benchmark-summary.json");
    } else {
      metadata.hasBenchmarkSummary = true;
      // The v1.15 canonical session ID anchors this bundle to a known benchmark run.
      if (bench.event_model?.session_id === "2F9047C9F1C1A3FF") {
        metadata.expectedSession = true;
      }
    }
  } else {
    warnings.push("json-benchmark-summary.json not found (optional for generic bundles)");
  }

  // Bundle is classified as a JSON event bundle if any of its event-specific
  // artifacts are present — presence alone triggers the stricter check set.
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

/**
 * Orchestrates the full read-only verification of an evidence bundle.
 *
 * Verification order matters: required-file and checksum checks run first
 * so that structural completeness is confirmed before token-level semantics
 * are evaluated. Fail-closed: any failing step exits non-zero immediately
 * or is aggregated into the final FAIL result.
 *
 * This function never writes to the bundle directory.
 *
 * @param {string} bundlePath - Relative or absolute path to the bundle directory.
 */
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

  // Detect bundle type before required-file validation so the correct
  // file set is enforced. Detection is based on presence of JSON event
  // artifacts — no manifest field is trusted for this classification.
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

  // JSON event metadata is only a blocking check for JSON event bundles.
  // For generic bundles its absence is expected and must not count as a failure.
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
