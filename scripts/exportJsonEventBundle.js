#!/usr/bin/env node
/**
 * exportJsonEventBundle.js — VSC v1.15 JSON Event Evidence Bundle Export
 *
 * Usage:  npm run vsc -- bundle:json [chain-token.json]
 *    or:  npm run bundle:json [chain-token.json]
 *    or:  node scripts/exportJsonEventBundle.js [chain-token.json]
 *
 * Exports a complete JSON event evidence bundle for AI-style event chains.
 * Bundle includes: event schema, event summary, benchmark data, chain token,
 * base token, delta tokens, verification summary, manifest, and checksums.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "output");
const JSON_BENCHMARK_DIR = path.join(OUTPUT_DIR, "json-benchmark");
const BUNDLES_DIR = path.join(OUTPUT_DIR, "json-event-bundles");

const BUNDLE_VERSION = "1.0";
const VSC_VERSION = "v1.15";
const SCHEMA_VERSION = "v1.0";

// ── Helpers ────────────────────────────────────────────────────────────────────

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

function copyFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function findFileByPattern(dir, pattern) {
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (pattern(entry)) {
        return path.join(dir, entry);
      }
    }
  } catch {}
  return null;
}

function findTokenById(tokenId) {
  // First search in json-benchmark directory (for JSON event tokens)
  const jsonBenchPattern = (name) => name.includes(tokenId) && name.endsWith(".json");
  if (fs.existsSync(JSON_BENCHMARK_DIR)) {
    const jsonBenchResult = findFileByPattern(JSON_BENCHMARK_DIR, jsonBenchPattern);
    if (jsonBenchResult) return jsonBenchResult;
  }
  
  // Then search in main output directory
  const pattern = (name) => name.includes(tokenId) && name.endsWith(".json");
  return findFileByPattern(OUTPUT_DIR, pattern);
}

function findJsonBenchmarkChainToken() {
  // Look in json-benchmark directory first
  if (fs.existsSync(JSON_BENCHMARK_DIR)) {
    const pattern = (name) => name.includes("chain") && name.endsWith(".json");
    const result = findFileByPattern(JSON_BENCHMARK_DIR, pattern);
    if (result) return result;
  }
  
  // Fallback: look in output/
  const pattern = (name) => {
    return name.includes("chain") && name.endsWith(".json") && 
           (name.includes("json") || name.includes("event"));
  };
  return findFileByPattern(OUTPUT_DIR, pattern);
}

// ── Main Export Function ───────────────────────────────────────────────────────

function exportJsonEventBundle(chainTokenPath) {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   VSC v1.15 — JSON Event Evidence Bundle Export            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  // Try to read JSON benchmark summary
  const benchmarkSummary = readJson(path.join(JSON_BENCHMARK_DIR, "json-benchmark-summary.json"));
  
  if (!benchmarkSummary) {
    console.error("\n✗ Error: JSON benchmark summary not found.");
    console.error("   Please run the JSON benchmark first:");
    console.error("   npm run vsc -- benchmark:json");
    process.exit(1);
  }
  
  console.log("\nJSON benchmark summary found:");
  console.log(`  Events: ${benchmarkSummary.event_model?.total_events || "unknown"}`);
  console.log(`  States: ${benchmarkSummary.event_model?.states || "unknown"}`);
  console.log(`  Session: ${benchmarkSummary.event_model?.session_id || "unknown"}`);
  
  // Extract token IDs from benchmark summary FIRST
  const baseTokenId = benchmarkSummary.tokens?.base_token_id;
  const latestTokenId = benchmarkSummary.tokens?.latest_delta_token_id;
  const chainTokenId = benchmarkSummary.tokens?.chain_token_id;
  const sessionId = benchmarkSummary.event_model?.session_id || "unknown";
  const totalEvents = benchmarkSummary.event_model?.total_events || 0;
  const stateCount = benchmarkSummary.event_model?.states || 0;
  
  console.log(`  Base Token ID:     ${baseTokenId || "unknown"}`);
  console.log(`  Latest Token ID:   ${latestTokenId || "unknown"}`);
  console.log(`  Chain Token ID:    ${chainTokenId || "unknown"}`);
  
  // Resolve chain token path
  let resolvedChainPath = chainTokenPath ? path.resolve(chainTokenPath) : null;
  
  if (!resolvedChainPath || !fs.existsSync(resolvedChainPath)) {
    // Construct chain token path from base/latest token IDs
    // Pattern: output/vsc-chain-<base>-to-<latest>.json
    if (baseTokenId && latestTokenId) {
      const constructedChainPath = path.join(OUTPUT_DIR, `vsc-chain-${baseTokenId}-to-${latestTokenId}.json`);
      if (fs.existsSync(constructedChainPath)) {
        resolvedChainPath = constructedChainPath;
        console.log(`  Located chain token: ${resolvedChainPath}`);
      }
    }
    
    // DO NOT fallback to old non-json chains while valid json-benchmark-summary.json exists
    // This prevents selecting wrong chains like 0689E7F37562 → 5B523E3D4A16
  }
  
  if (!resolvedChainPath || !fs.existsSync(resolvedChainPath)) {
    console.error("\n✗ Error: Could not locate JSON benchmark chain token.");
    console.error("   Please provide the chain token path:");
    console.error("   npm run vsc -- bundle:json output/json-benchmark/vsc-chain-*.json");
    process.exit(1);
  }
  
  console.log(`\nInput chain token: ${resolvedChainPath}`);
  
  // Read chain token
  const chainToken = readJson(resolvedChainPath);
  if (!chainToken) {
    console.error(`\n✗ Error: Failed to parse chain token: ${resolvedChainPath}`);
    process.exit(1);
  }
  
  // Extract chain hash from chain token
  const chainHash = chainToken.proof?.chainHash || chainToken.chainHash || "";
  const chainHashPrefix = chainHash.slice(0, 24);
  
  console.log(`\nChain token loaded: ${path.basename(resolvedChainPath)}`);
  console.log(`Base token ID:     ${baseTokenId}`);
  console.log(`Latest Token ID:   ${latestTokenId}`);
  console.log(`Chain hash prefix: ${chainHashPrefix}`);
  console.log(`Session ID:        ${sessionId}`);
  
  // Create bundle directory
  const bundleName = `vsc-json-event-bundle-${baseTokenId}-to-${latestTokenId}`;
  const bundleDir = path.join(BUNDLES_DIR, bundleName);
  
  if (fs.existsSync(bundleDir)) {
    console.log(`\nRemoving existing bundle: ${bundleDir}`);
    fs.rmSync(bundleDir, { recursive: true, force: true });
  }
  
  fs.mkdirSync(bundleDir, { recursive: true });
  console.log(`\nBundle directory:  ${bundleDir}`);
  
  // Track included files and warnings
  const includedFiles = [];
  const warnings = [];
  
  // ── Copy Chain Token ───────────────────────────────────────────────────────
  console.log("\n[01] Copying chain token...");
  const chainDest = path.join(bundleDir, "chain-token.json");
  copyFile(resolvedChainPath, chainDest);
  includedFiles.push({ src: resolvedChainPath, dest: "chain-token.json", type: "chain" });
  console.log(`     ✓ chain-token.json`);
  
  // ── Find and Copy Base Token ─────────────────────────────────────────────────
  console.log("\n[02] Locating base token...");
  const baseTokenPath = findTokenById(baseTokenId);
  if (!baseTokenPath) {
    warnings.push(`Base token not found: ${baseTokenId}`);
    console.log(`     ⚠ Base token not found in output/`);
  } else {
    const baseDest = path.join(bundleDir, "base-token.json");
    copyFile(baseTokenPath, baseDest);
    includedFiles.push({ src: baseTokenPath, dest: "base-token.json", type: "base", id: baseTokenId });
    console.log(`     ✓ base-token.json (${baseTokenId})`);
  }
  
  // ── Find and Copy Delta Tokens ───────────────────────────────────────────────
  console.log("\n[03] Locating delta tokens...");
  const deltaTokens = [];
  const steps = chainToken.steps || [];
  let missingDeltas = 0;
  
  if (steps.length === 0) {
    warnings.push("No delta steps found in chain token");
    console.log("     ⚠ No delta steps in chain");
  } else {
    fs.mkdirSync(path.join(bundleDir, "delta-tokens"), { recursive: true });
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      // Chain token uses fromTokenId/toTokenId fields
      const fromId = step.fromTokenId || step.from;
      const toId = step.toTokenId || step.to;
      const deltaId = step.deltaTokenId || step.id;
      
      if (!fromId || !toId) {
        warnings.push(`Step ${i + 1} missing from/to token IDs`);
        console.log(`     ⚠ Step ${i + 1}: missing from/to token IDs`);
        missingDeltas++;
        continue;
      }
      
      // Try to find delta token by from-to pattern
      // Pattern: vsc-<FROM>-to-<TO>-folder-delta.json
      let deltaPath = null;
      
      // Pattern 1: Direct from-to pattern search
      const fromToPattern = (name) => {
        return name.includes(fromId) && 
               name.includes(toId) && 
               name.includes("delta") && 
               name.endsWith(".json");
      };
      
      // Search in output/ first
      deltaPath = findFileByPattern(OUTPUT_DIR, fromToPattern);
      
      // Then search in json-benchmark/
      if (!deltaPath && fs.existsSync(JSON_BENCHMARK_DIR)) {
        deltaPath = findFileByPattern(JSON_BENCHMARK_DIR, fromToPattern);
      }
      
      // Pattern 2: Try by deltaTokenId if available
      if (!deltaPath && deltaId) {
        deltaPath = findTokenById(deltaId);
      }
      
      // Pattern 3: Try just the toId (latest token ID for this delta)
      if (!deltaPath) {
        deltaPath = findTokenById(toId);
      }
      
      if (!deltaPath) {
        warnings.push(`Delta token not found: ${fromId} → ${toId}`);
        console.log(`     ⚠ Delta ${i + 1}: ${fromId} → ${toId} not found`);
        missingDeltas++;
        continue;
      }
      
      // Zero-padded index for ordering
      const indexStr = String(i + 1).padStart(3, "0");
      const deltaDest = path.join(bundleDir, "delta-tokens", `delta-${indexStr}.json`);
      copyFile(deltaPath, deltaDest);
      deltaTokens.push({
        index: i + 1,
        from_token_id: fromId,
        to_token_id: toId,
        id: deltaId || `${fromId}-to-${toId}`,
        src: deltaPath,
        dest: `delta-tokens/delta-${indexStr}.json`
      });
      console.log(`     ✓ Delta ${indexStr}: ${fromId} → ${toId}`);
    }
  }
  
  console.log(`     Total deltas: ${deltaTokens.length}`);
  
  // Fail if any delta tokens are missing
  if (missingDeltas > 0) {
    console.error(`\n✗ Error: ${missingDeltas} delta token(s) could not be found.`);
    console.error("   Bundle export aborted due to missing required artifacts.");
    process.exit(1);
  }
  
  // ── Copy JSON Benchmark Summary ───────────────────────────────────────────────
  console.log("\n[04] Copying JSON benchmark summary...");
  const summarySrc = path.join(JSON_BENCHMARK_DIR, "json-benchmark-summary.json");
  if (fs.existsSync(summarySrc)) {
    const summaryDest = path.join(bundleDir, "json-benchmark-summary.json");
    copyFile(summarySrc, summaryDest);
    includedFiles.push({ src: summarySrc, dest: "json-benchmark-summary.json", type: "benchmark" });
    console.log(`     ✓ json-benchmark-summary.json`);
  } else {
    warnings.push("JSON benchmark summary not found");
    console.log(`     ⚠ json-benchmark-summary.json not found`);
  }
  
  // ── Copy JSON Benchmark Report ────────────────────────────────────────────────
  console.log("\n[05] Copying JSON benchmark report...");
  const reportSrc = path.join(JSON_BENCHMARK_DIR, "json-benchmark-report.md");
  if (fs.existsSync(reportSrc)) {
    const reportDest = path.join(bundleDir, "json-benchmark-report.md");
    copyFile(reportSrc, reportDest);
    includedFiles.push({ src: reportSrc, dest: "json-benchmark-report.md", type: "benchmark" });
    console.log(`     ✓ json-benchmark-report.md`);
  } else {
    warnings.push("JSON benchmark report not found");
    console.log(`     ⚠ json-benchmark-report.md not found`);
  }
  
  // ── Copy JSON Benchmark Chart Data ───────────────────────────────────────────
  console.log("\n[06] Copying JSON benchmark chart data...");
  const chartSrc = path.join(JSON_BENCHMARK_DIR, "json-benchmark-chart-data.json");
  if (fs.existsSync(chartSrc)) {
    const chartDest = path.join(bundleDir, "json-benchmark-chart-data.json");
    copyFile(chartSrc, chartDest);
    includedFiles.push({ src: chartSrc, dest: "json-benchmark-chart-data.json", type: "benchmark" });
    console.log(`     ✓ json-benchmark-chart-data.json`);
  } else {
    warnings.push("JSON benchmark chart data not found");
    console.log(`     ⚠ json-benchmark-chart-data.json not found`);
  }
  
  // ── Create Event Schema ───────────────────────────────────────────────────────
  console.log("\n[07] Creating event schema...");
  
  const eventSchema = {
    schema_name: "VSC JSON Event Schema",
    schema_version: SCHEMA_VERSION,
    primary_unit_of_proof: "Individual Event",
    event_types: [
      "prompt_response",
      "tool_call",
      "policy_check",
      "retrieval",
      "final_decision"
    ],
    required_event_fields: [
      "event_id",
      "sequence",
      "timestamp",
      "event_type",
      "actor",
      "session_id",
      "model",
      "input_hash",
      "output_hash",
      "policy_result",
      "tool_calls",
      "metadata"
    ],
    determinism_requirements: [
      "Fixed timestamp base (deterministic epoch)",
      "Deterministic event IDs (SHA-256 based)",
      "Deterministic session ID (fixed for benchmark run)",
      "Deterministic event ordering (sequence guaranteed)",
      "Canonical JSON serialization where possible",
      "No random or network-dependent event data"
    ],
    limitations: [
      "Synthetic deterministic data — not real AI inference",
      "Fixed session model — not multi-session orchestration",
      "No actual tool execution — simulated tool calls",
      "Research prototype — not enterprise production software"
    ]
  };
  
  fs.writeFileSync(
    path.join(bundleDir, "event-schema.json"),
    JSON.stringify(eventSchema, null, 2),
    "utf8"
  );
  includedFiles.push({ dest: "event-schema.json", type: "schema" });
  console.log("     ✓ event-schema.json");
  
  // ── Create Event Summary ─────────────────────────────────────────────────────
  console.log("\n[08] Creating event summary...");
  
  // Analyze event types from the benchmark data if available
  const eventsPerState = totalEvents / stateCount || 0;
  
  const eventSummary = {
    total_events: totalEvents,
    state_count: stateCount,
    events_per_state: eventsPerState,
    session_id: sessionId,
    base_token_id: baseTokenId,
    latest_token_id: latestTokenId,
    chain_token_id: chainToken.id || path.basename(resolvedChainPath, ".json"),
    chain_hash_prefix: chainHashPrefix,
    event_types_observed: [
      "prompt_response",
      "tool_call",
      "policy_check",
      "retrieval",
      "final_decision"
    ],
    first_event_sequence: 1,
    last_event_sequence: totalEvents,
    source_benchmark_summary: "json-benchmark-summary.json",
    notes: [
      "Events are generated deterministically for benchmark reproducibility.",
      "Each state contains all events from sequence 1 to N (accumulating log).",
      "See event-schema.json for the complete event structure."
    ]
  };
  
  fs.writeFileSync(
    path.join(bundleDir, "event-summary.json"),
    JSON.stringify(eventSummary, null, 2),
    "utf8"
  );
  includedFiles.push({ dest: "event-summary.json", type: "summary" });
  console.log("     ✓ event-summary.json");
  
  // ── Create Verification Summary ──────────────────────────────────────────────
  console.log("\n[09] Creating verification summary...");
  
  const restoreStatus = benchmarkSummary.restore_status || benchmarkSummary.restoreResult || "unknown";
  const verifyStatus = benchmarkSummary.verify_status || benchmarkSummary.verifyResult || "unknown";
  
  const verificationSummary = {
    bundle_version: BUNDLE_VERSION,
    bundle_type: "json_event_evidence_bundle",
    created_at: new Date().toISOString(),
    chain_token_id: chainToken.id || path.basename(resolvedChainPath, ".json"),
    base_token_id: baseTokenId,
    latest_token_id: latestTokenId,
    delta_count: deltaTokens.length,
    event_count: totalEvents,
    session_id: sessionId,
    chain_hash_prefix: chainHashPrefix,
    restore_status: restoreStatus,
    verify_status: verifyStatus,
    verification_status: "json_event_bundle_exported",
    source_json_benchmark_summary: "json-benchmark-summary.json",
    notes: [
      "This bundle contains exported JSON AI event evidence.",
      "Events are deterministic synthetic data for benchmark purposes.",
      "Verification requires checking root hash match from benchmark summary.",
      "See README.md for manual verification instructions.",
      "Research prototype — not enterprise production software."
    ]
  };
  
  fs.writeFileSync(
    path.join(bundleDir, "verification-summary.json"),
    JSON.stringify(verificationSummary, null, 2),
    "utf8"
  );
  includedFiles.push({ dest: "verification-summary.json", type: "meta" });
  console.log("     ✓ verification-summary.json");
  
  // ── Create Manifest ──────────────────────────────────────────────────────────
  console.log("\n[10] Creating manifest...");
  
  const manifest = {
    bundle_name: bundleName,
    bundle_version: BUNDLE_VERSION,
    bundle_type: "json_event_evidence_bundle",
    created_at: new Date().toISOString(),
    vsc_version: VSC_VERSION,
    event_model: {
      primary_unit_of_proof: "Individual Event",
      schema_version: SCHEMA_VERSION,
      event_types: eventSchema.event_types,
      required_fields: eventSchema.required_event_fields
    },
    benchmark: {
      total_events: totalEvents,
      state_count: stateCount,
      events_per_state: eventsPerState,
      session_id: sessionId,
      restore_status: restoreStatus,
      verify_status: verifyStatus
    },
    chain: {
      token_id: chainToken.id || path.basename(resolvedChainPath, ".json"),
      base_token_id: baseTokenId,
      latest_token_id: latestTokenId,
      delta_count: deltaTokens.length,
      chain_hash_prefix: chainHashPrefix,
      source_file: path.basename(resolvedChainPath)
    },
    base: {
      token_id: baseTokenId,
      source_file: baseTokenPath ? path.basename(baseTokenPath) : null,
      bundle_file: "base-token.json"
    },
    deltas: deltaTokens.map(d => ({
      index: d.index,
      from_token_id: d.from_token_id,
      to_token_id: d.to_token_id,
      token_id: d.id,
      source_file: path.basename(d.src),
      bundle_file: d.dest
    })),
    included_files: includedFiles.map(f => f.dest || f.src),
    checksums_file: "checksums.sha256",
    warnings: warnings,
    limitations: [
      "Recovery chunk folders not included (can be regenerated from tokens).",
      "Restored state folders not included (can be regenerated via restore).",
      "Synthetic deterministic events — not real AI inference.",
      "Research prototype — not enterprise production software.",
      "This is a bridge toward AI evidence logging, not a claim of enterprise-ready infrastructure."
    ]
  };
  
  fs.writeFileSync(
    path.join(bundleDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );
  includedFiles.push({ dest: "manifest.json", type: "meta" });
  console.log("     ✓ manifest.json");
  
  // ── Create Checksums ─────────────────────────────────────────────────────────
  console.log("\n[11] Computing checksums...");
  
  const checksumLines = [];
  
  function addChecksum(filePath, relativePath) {
    const fullPath = path.join(bundleDir, filePath);
    if (fs.existsSync(fullPath)) {
      const hash = sha256File(fullPath);
      checksumLines.push(`${hash}  ${relativePath || filePath}`);
    }
  }
  
  // Add checksums for all files in bundle
  addChecksum("chain-token.json", "chain-token.json");
  addChecksum("base-token.json", "base-token.json");
  addChecksum("event-schema.json", "event-schema.json");
  addChecksum("event-summary.json", "event-summary.json");
  addChecksum("json-benchmark-summary.json", "json-benchmark-summary.json");
  addChecksum("verification-summary.json", "verification-summary.json");
  addChecksum("manifest.json", "manifest.json");
  
  if (fs.existsSync(path.join(bundleDir, "json-benchmark-report.md"))) {
    addChecksum("json-benchmark-report.md", "json-benchmark-report.md");
  }
  
  if (fs.existsSync(path.join(bundleDir, "json-benchmark-chart-data.json"))) {
    addChecksum("json-benchmark-chart-data.json", "json-benchmark-chart-data.json");
  }
  
  for (const delta of deltaTokens) {
    addChecksum(delta.dest, delta.dest);
  }
  
  fs.writeFileSync(
    path.join(bundleDir, "checksums.sha256"),
    checksumLines.join("\n") + "\n",
    "utf8"
  );
  console.log(`     ✓ checksums.sha256 (${checksumLines.length} files)`);
  
  // ── Create README ───────────────────────────────────────────────────────────
  console.log("\n[12] Creating README...");
  
  const readme = `# VSC JSON Event Evidence Bundle

**Bundle:** ${bundleName}  
**Created:** ${new Date().toISOString()}  
**VSC Version:** ${VSC_VERSION}  
**Bundle Version:** ${BUNDLE_VERSION}  
**Schema Version:** ${SCHEMA_VERSION}

## Purpose

This is a portable evidence package containing **deterministic JSON AI event evidence** packaged with VSC proof artifacts. It bridges VSC from generic state-delta evidence toward AI decision-event evidence suitable for audit, post-incident review, and DigiEmu verification workflows.

## Event Model

**Primary unit of proof:** Individual Event

**Event types:**
- \+prompt_response\` — AI prompt/response cycle
- \+tool_call\` — External tool invocation
- \+policy_check\` — Safety/policy evaluation
- \+retrieval\` — Knowledge base lookup
- \+final_decision\` — Ultimate output/decision

**Required fields per event:**
\`event_id\`, \`sequence\`, \`timestamp\`, \`event_type\`, \`actor\`, \`session_id\`, \`model\`, \`input_hash\`, \`output_hash\`, \`policy_result\`, \`tool_calls\`, \`metadata\`

## Session Summary

| Property | Value |
|----------|-------|
| Session ID | \`${sessionId}\` |
| Total Events | ${totalEvents} |
| States | ${stateCount} |
| Events per State | ${eventsPerState.toFixed(1)} |
| Base Token ID | \`${baseTokenId}\` |
| Latest Token ID | \`${latestTokenId}\` |
| Chain Token ID | \`${chainToken.id || path.basename(resolvedChainPath, ".json")}\` |
| Delta Count | ${deltaTokens.length} |

## Included Artifacts

### Event Evidence
- \`event-schema.json\` — Event structure definition
- \`event-summary.json\` — Event statistics and session summary
- \`json-benchmark-summary.json\` — Benchmark metrics and results
- \`json-benchmark-report.md\` — Human-readable report
- \`json-benchmark-chart-data.json\` — Chart/plot data

### VSC Proof
- \`chain-token.json\` — Complete delta chain
- \`base-token.json\` — Initial state snapshot
- \`delta-tokens/delta-*.json\` — ${deltaTokens.length} ordered delta steps

### Metadata
- \`manifest.json\` — Complete bundle inventory
- \`verification-summary.json\` — Verification status and instructions
- \`checksums.sha256\` — SHA-256 checksums for all files

## How to Inspect

View JSON files directly:

\`\`\`bash
# Pretty-print event schema
cat event-schema.json | python -m json.tool

# View event summary
cat event-summary.json | jq '.'

# Check a delta token
cat delta-tokens/delta-001.json | jq '.proof'
\`\`\`

## How to Reproduce

To regenerate this bundle from scratch:

\`\`\`bash
# 1. Run JSON event benchmark
npm run vsc -- benchmark:json

# 2. Export evidence bundle
npm run vsc -- bundle:json

# Or with explicit chain token:
npm run vsc -- bundle:json output/json-benchmark/vsc-chain-*.json
\`\`\`

## How to Verify Manually

### 1. Check Benchmark Results

\`\`\`bash
# View summary
cat json-benchmark-summary.json | jq '.verifyResult, .restoreResult'
\`\`\`

Expected: \`PASS\` for both restore and verify.

### 2. Restore the Chain

\`\`\`bash
# Restore latest state
npm run vsc -- restore chain-token.json

# Verify root hash
npm run vsc -- verify chain-token.json <restored-folder>
\`\`\`

### 3. Check Checksums

\`\`\`bash
# Verify file integrity
sha256sum -c checksums.sha256
\`\`\`

## Verification Status

**Current Status:** ${verificationSummary.verification_status}

- **Restore Status:** ${restoreStatus}
- **Verify Status:** ${verifyStatus}

## Limitations

- **Synthetic Data:** Events are deterministically generated, not real AI inference.
- **Single Session:** Fixed session ID — not multi-session orchestration.
- **Simulated Tools:** Tool calls are recorded but not actually executed.
- **Research Prototype:** This is a bridge toward AI evidence logging, not enterprise-ready infrastructure.
- **No Streaming:** Events are batch-generated, not streamed in real-time.
- **No WAL:** No write-ahead logging for durability guarantees.

## Determinism

This bundle is **deterministic and reproducible**:

- Fixed timestamp base
- Deterministic event IDs (SHA-256 based)
- Fixed session ID per benchmark run
- Canonical JSON serialization
- No random or network-dependent data

---

*VSC JSON Event Evidence Bundle — Portable AI event proof for verifiable state commitments*
`;
  
  fs.writeFileSync(
    path.join(bundleDir, "README.md"),
    readme,
    "utf8"
  );
  includedFiles.push({ dest: "README.md", type: "meta" });
  console.log("     ✓ README.md");
  
  // ── Final Summary ───────────────────────────────────────────────────────────
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║   JSON EVENT EVIDENCE BUNDLE EXPORT COMPLETE                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  console.log(`\nBundle: ${bundleDir}`);
  console.log(`Files included: ${includedFiles.length}`);
  console.log(`  - Event evidence: 4 (schema, summary, benchmark summary, report, chart)`);
  console.log(`  - Chain token: 1`);
  console.log(`  - Base token: ${baseTokenPath ? 1 : 0}`);
  console.log(`  - Delta tokens: ${deltaTokens.length}`);
  console.log(`  - Metadata: 4 (README, manifest, verification-summary, checksums)`);
  
  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const warning of warnings) {
      console.log(`  ⚠ ${warning}`);
    }
    console.error("\n✗ Export FAIL - bundle incomplete due to warnings");
    process.exit(1);
  }
  
  console.log("\n✓ Export PASS");
  console.log("\nNext steps:");
  console.log(`  1. Inspect:    cd ${bundleDir}`);
  console.log("  2. Verify:     cat json-benchmark-summary.json | jq '.verifyResult'");
  console.log("  3. Share:      Distribute the bundle directory or zip it");
  console.log("");
}

// ── Main ───────────────────────────────────────────────────────────────────────

const chainTokenPath = process.argv[2];
exportJsonEventBundle(chainTokenPath);
