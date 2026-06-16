#!/usr/bin/env node
/**
 * runBenchmark.js — VSC v1.12 Benchmark Mode
 *
 * Usage:  npm run vsc -- benchmark [profile]
 *    or:  npm run benchmark [profile]
 *    or:  node scripts/runBenchmark.js [profile]
 *
 * Profiles: small (10 states), medium (100 states - default), large (1000 states)
 *
 * Measures storage-load reduction, restore time, and verify time.
 * Produces reproducible, deterministic benchmark outputs.
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BENCHMARK_DIR = path.join(ROOT, "output", "benchmark");
const FIXTURE_DIR = path.join(ROOT, "test-benchmark");
const NODE = process.execPath;

// ── Configuration ───────────────────────────────────────────────────────────

const PROFILES = {
  small: { states: 10, description: "Fast smoke benchmark" },
  medium: { states: 100, description: "Default benchmark" },
  large: { states: 1000, description: "Extended benchmark (optional)" }
};

const DEFAULT_PROFILE = "medium";

// Deterministic seed for any pseudo-random operations
const SEED = 12345;

// ── Helpers ────────────────────────────────────────────────────────────────────

function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function fmtBytes(n) {
  if (!n || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function run(script, args = [], capture = false) {
  const scriptPath = path.join(ROOT, script);
  const result = spawnSync(NODE, [scriptPath, ...args], {
    stdio: capture ? "pipe" : "inherit",
    cwd: ROOT,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    console.error(`\n✗ Script failed (exit ${result.status}): ${script} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
  return result.stdout || "";
}

function runSilent(script, args = []) {
  const scriptPath = path.join(ROOT, script);
  const result = spawnSync(NODE, [scriptPath, ...args], {
    stdio: "pipe",
    cwd: ROOT,
    encoding: "utf8"
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function cleanDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function getDirectorySize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let size = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      size += getDirectorySize(fullPath);
    } else if (entry.isFile()) {
      size += fs.statSync(fullPath).size;
    }
  }
  return size;
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Simple seeded RNG for deterministic "random" choices
function seededRandom(seed) {
  let s = seed;
  return function() {
    s = Math.sin(s * 12.9898 + 78.233) * 43758.5453123;
    return s - Math.floor(s);
  };
}

// ── Fixture Generation ───────────────────────────────────────────────────────

function createBenchmarkFixture(states) {
  console.log(`\n[01] Creating benchmark fixture (${states} states)...`);
  console.log("     " + "─".repeat(40));

  // Clean and create fixture directory
  cleanDirectory(FIXTURE_DIR);

  // Create base state (state 0)
  const baseDir = path.join(FIXTURE_DIR, "state-000");
  fs.mkdirSync(baseDir, { recursive: true });

  // Create initial files (deterministic)
  const files = [
    { name: "config.json", content: JSON.stringify({ version: "1.0.0", setting: "value1" }, null, 2) },
    { name: "readme.md", content: "# Benchmark Fixture\n\nBase state for VSC benchmark.\n" },
    { name: "data/items.json", content: JSON.stringify({ items: [{ id: 1, name: "item1" }, { id: 2, name: "item2" }] }, null, 2) },
    { name: "meta/timestamp.txt", content: new Date(2024, 0, 1, 0, 0, 0).toISOString() },
    { name: "logs/initial.log", content: "[2024-01-01T00:00:00.000Z] System initialized\n" }
  ];

  for (const file of files) {
    const filePath = path.join(baseDir, file.name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file.content, "utf8");
  }

  console.log(`     Base state created: ${files.length} files`);

  // Create subsequent states with small changes
  const rnd = seededRandom(SEED);
  const changeTypes = ["edit_text", "add_metadata", "change_json", "add_small_file", "modify_log"];

  for (let stateIdx = 1; stateIdx < states; stateIdx++) {
    const prevStateDir = path.join(FIXTURE_DIR, `state-${String(stateIdx - 1).padStart(3, "0")}`);
    const currStateDir = path.join(FIXTURE_DIR, `state-${String(stateIdx).padStart(3, "0")}`);

    // Copy previous state
    copyDirectory(prevStateDir, currStateDir);

    // Apply deterministic change
    const changeType = changeTypes[stateIdx % changeTypes.length];
    applyDeterministicChange(currStateDir, stateIdx, changeType);

    if (stateIdx % 10 === 0 || stateIdx === states - 1) {
      console.log(`     State ${String(stateIdx).padStart(3, "0")} created (${changeType})`);
    }
  }

  // Calculate total traditional storage (sum of all state folder sizes)
  let traditionalTotal = 0;
  for (let i = 0; i < states; i++) {
    const stateDir = path.join(FIXTURE_DIR, `state-${String(i).padStart(3, "0")}`);
    traditionalTotal += getDirectorySize(stateDir);
  }

  console.log(`     Total traditional storage: ${fmtBytes(traditionalTotal)}`);
  console.log("");

  return { states, traditionalTotal };
}

function applyDeterministicChange(stateDir, stateIdx, changeType) {
  const timestamp = new Date(2024, 0, 1, 0, stateIdx, 0).toISOString();

  switch (changeType) {
    case "edit_text": {
      const readmePath = path.join(stateDir, "readme.md");
      if (fs.existsSync(readmePath)) {
        const content = fs.readFileSync(readmePath, "utf8");
        fs.writeFileSync(readmePath, content + `\nUpdate ${stateIdx}: ${timestamp}\n`, "utf8");
      }
      break;
    }
    case "add_metadata": {
      const metaPath = path.join(stateDir, "meta/state-info.txt");
      fs.mkdirSync(path.dirname(metaPath), { recursive: true });
      fs.writeFileSync(metaPath, `State: ${stateIdx}\nSequence: ${stateIdx}\n`, "utf8");
      break;
    }
    case "change_json": {
      const configPath = path.join(stateDir, "config.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        config.setting = `value${stateIdx}`;
        config.sequence = stateIdx;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
      }
      break;
    }
    case "add_small_file": {
      const logPath = path.join(stateDir, `logs/event-${stateIdx}.log`);
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.writeFileSync(logPath, `[${timestamp}] Event ${stateIdx} occurred\n`, "utf8");
      break;
    }
    case "modify_log": {
      const logPath = path.join(stateDir, "logs/initial.log");
      if (fs.existsSync(logPath)) {
        fs.appendFileSync(logPath, `[${timestamp}] Log entry ${stateIdx}\n`, "utf8");
      }
      break;
    }
  }
}

// ── Manifest Helpers ─────────────────────────────────────────────────────────

function readManifest() {
  const p = path.join(ROOT, "output", "manifest.json");
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return []; }
}

function latestEntry(pred) {
  return readManifest()
    .filter(pred)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

// ── Benchmark Runner ───────────────────────────────────────────────────────────

function runBenchmark(profile) {
  const config = PROFILES[profile];
  if (!config) {
    console.error(`Unknown profile: ${profile}`);
    console.error(`Valid profiles: ${Object.keys(PROFILES).join(", ")}`);
    process.exit(1);
  }

  const startTime = Date.now();

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   VSC v1.12 — BENCHMARK MODE                               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`Profile: ${profile}`);
  console.log(`States:  ${config.states}`);
  console.log(`Description: ${config.description}`);

  // Prepare output directory
  cleanDirectory(BENCHMARK_DIR);

  // Create fixtures
  const { traditionalTotal } = createBenchmarkFixture(config.states);

  // Run VSC encoding for base state
  console.log(`[02] Creating base snapshot...`);
  console.log("     " + "─".repeat(40));

  const baseStartTime = Date.now();
  const baseStateDir = path.join(FIXTURE_DIR, "state-000");
  run("src/encodeFolderCli.js", [baseStateDir, "FOLDER"]);
  const baseTime = Date.now() - baseStartTime;

  const baseEntry = latestEntry(e => e.mode === "FOLDER_RECOVERY");
  if (!baseEntry) {
    console.error("✗ Failed to create base snapshot");
    process.exit(1);
  }

  const baseJsonPath = path.join(ROOT, "output", path.basename(baseEntry.json));
  const baseToken = JSON.parse(fs.readFileSync(baseJsonPath, "utf8"));
  const baseBytes = baseEntry.fileSizeBytes || 0;

  console.log(`     Base token: ${baseEntry.id}`);
  console.log(`     Base size: ${fmtBytes(baseBytes)}`);
  console.log(`     Base time: ${fmtDuration(baseTime)}`);
  console.log("");

  // Create deltas for each subsequent state
  console.log(`[03] Creating deltas (${config.states - 1} deltas)...`);
  console.log("     " + "─".repeat(40));

  const deltaStartTime = Date.now();
  let prevTokenPath = baseJsonPath;
  let prevTokenId = baseEntry.id;
  const deltaPaths = [];
  const deltaSizes = [];

  for (let i = 1; i < config.states; i++) {
    const stateDir = path.join(FIXTURE_DIR, `state-${String(i).padStart(3, "0")}`);

    run("src/encodeFolderDeltaCli.js", [prevTokenPath, stateDir, "FOLDER_DELTA"]);

    const deltaEntry = latestEntry(e =>
      e.mode === "FOLDER_DELTA" && e.baseline === prevTokenId
    );

    if (!deltaEntry) {
      console.error(`✗ Failed to create delta for state ${i}`);
      process.exit(1);
    }

    const deltaJsonPath = path.join(ROOT, "output", path.basename(deltaEntry.json));
    const deltaSize = deltaEntry.fileSizeBytes || 0;

    deltaPaths.push(deltaJsonPath);
    deltaSizes.push(deltaSize);

    prevTokenPath = deltaJsonPath;
    prevTokenId = deltaEntry.id;

    if (i % 10 === 0 || i === config.states - 1) {
      console.log(`     Delta ${String(i).padStart(3, "0")}: ${deltaEntry.id} (${fmtBytes(deltaSize)})`);
    }
  }

  const deltaTime = Date.now() - deltaStartTime;
  const deltaBytesTotal = deltaSizes.reduce((a, b) => a + b, 0);

  console.log(`     Total delta size: ${fmtBytes(deltaBytesTotal)}`);
  console.log(`     Delta generation time: ${fmtDuration(deltaTime)}`);
  console.log("");

  // Create chain
  console.log(`[04] Building delta chain...`);
  console.log("     " + "─".repeat(40));

  const chainStartTime = Date.now();
  run("src/createDeltaChainCli.js", [baseJsonPath, ...deltaPaths]);
  const chainTime = Date.now() - chainStartTime;

  const chainEntry = latestEntry(e =>
    e.mode === "DELTA_CHAIN" && e.baseline === baseEntry.id
  );

  if (!chainEntry) {
    console.error("✗ Failed to create delta chain");
    process.exit(1);
  }

  const chainJsonPath = path.join(ROOT, "output", path.basename(chainEntry.json));
  const chainToken = JSON.parse(fs.readFileSync(chainJsonPath, "utf8"));

  console.log(`     Chain token: ${chainEntry.id}`);
  console.log(`     Steps: ${chainToken.steps?.length || 0}`);
  console.log(`     Chain time: ${fmtDuration(chainTime)}`);
  console.log("");

  // Restore base first (prerequisite)
  console.log(`[05] Restoring base folder...`);
  run("src/restoreFolder.js", [baseJsonPath]);

  // Restore from chain
  console.log(`[06] Restoring from chain (latest state)...`);
  console.log("     " + "─".repeat(40));

  const restoreStartTime = Date.now();
  run("src/restoreDeltaChain.js", [chainJsonPath]);
  const restoreTime = Date.now() - restoreStartTime;

  // Determine restored folder path (chain restore uses sourceFolderName from base token)
  const restoredDir = path.join(
    ROOT, "output",
    `chain-${chainToken.baseTokenId}-to-${chainToken.latestTokenId}`,
    `restored-${chainToken.sourceFolderName || "state-000"}`
  );

  console.log(`     Restore time: ${fmtDuration(restoreTime)}`);
  console.log("");

  // Verify
  console.log(`[07] Verifying restored state...`);
  console.log("     " + "─".repeat(40));

  const verifyStartTime = Date.now();
  run("src/verifyDeltaChain.js", [chainJsonPath, restoredDir]);
  const verifyTime = Date.now() - verifyStartTime;

  console.log(`     Verify time: ${fmtDuration(verifyTime)}`);
  console.log("");

  // Calculate metrics
  const vscTotalBytes = baseBytes + deltaBytesTotal;
  const savedBytes = traditionalTotal - vscTotalBytes;
  const totalChainReduction = traditionalTotal > 0
    ? ((savedBytes / traditionalTotal) * 100).toFixed(2)
    : "0.00";

  // Delta-only reduction compares deltas to one full copy baseline
  const comparableFullCopy = baseBytes; // One state as baseline
  const deltaOnlyReduction = comparableFullCopy > 0
    ? ((comparableFullCopy - deltaBytesTotal) / comparableFullCopy * 100).toFixed(2)
    : "0.00";

  const avgDeltaBytes = deltaSizes.length > 0
    ? Math.round(deltaBytesTotal / deltaSizes.length)
    : 0;
  const largestDeltaBytes = deltaSizes.length > 0 ? Math.max(...deltaSizes) : 0;
  const smallestDeltaBytes = deltaSizes.length > 0 ? Math.min(...deltaSizes) : 0;

  // Total benchmark time
  const totalTime = Date.now() - startTime;

  // ── Output Results ──────────────────────────────────────────────────────────

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   BENCHMARK RESULTS                                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  console.log("\nStorage Comparison:");
  console.log(`  Traditional full-copy storage: ${fmtBytes(traditionalTotal)}`);
  console.log(`  VSC total storage:             ${fmtBytes(vscTotalBytes)}`);
  console.log(`    - Base:                      ${fmtBytes(baseBytes)}`);
  console.log(`    - Deltas total:              ${fmtBytes(deltaBytesTotal)}`);
  console.log(`  Saved bytes:                   ${fmtBytes(savedBytes)}`);
  console.log(`  Total chain reduction:         ${totalChainReduction}%`);
  console.log(`  Delta-only reduction:          ${deltaOnlyReduction}%`);
  console.log(`  Average delta size:            ${fmtBytes(avgDeltaBytes)}`);
  console.log(`  Largest delta:                 ${fmtBytes(largestDeltaBytes)}`);
  console.log(`  Smallest delta:                ${fmtBytes(smallestDeltaBytes)}`);

  console.log("\nTiming:");
  console.log(`  Base snapshot time:     ${fmtDuration(baseTime)}`);
  console.log(`  Delta generation time:  ${fmtDuration(deltaTime)}`);
  console.log(`  Chain creation time:    ${fmtDuration(chainTime)}`);
  console.log(`  Restore time:           ${fmtDuration(restoreTime)}`);
  console.log(`  Verify time:            ${fmtDuration(verifyTime)}`);
  console.log(`  Total benchmark time:   ${fmtDuration(totalTime)}`);

  console.log("\nChain Info:");
  console.log(`  State count:            ${config.states}`);
  console.log(`  Delta count:            ${deltaPaths.length}`);
  console.log(`  Chain length:           ${(chainToken.steps?.length || 0) + 1}`);
  console.log(`  Base token ID:          ${chainToken.baseTokenId}`);
  console.log(`  Latest delta token ID:  ${chainToken.latestTokenId}`);
  console.log(`  Chain token ID:         ${chainEntry.id}`);
  console.log(`  Chain hash prefix:      ${(chainToken.proof?.chainHash || "").slice(0, 24)}`);

  console.log("\nVerification:");
  console.log(`  Restore:                PASS`);
  console.log(`  Verify:                 PASS`);

  console.log("\nOutput Files:");
  console.log(`  - ${path.join(BENCHMARK_DIR, "benchmark-summary.json")}`);
  console.log(`  - ${path.join(BENCHMARK_DIR, "benchmark-report.md")}`);
  console.log(`  - ${path.join(BENCHMARK_DIR, "benchmark-chart-data.json")}`);

  // ── Write JSON Summary ─────────────────────────────────────────────────────

  const summary = {
    source: "benchmark",
    profile,
    timestamp: new Date().toISOString(),
    state_count: config.states,
    delta_count: deltaPaths.length,
    base_bytes: baseBytes,
    delta_bytes_total: deltaBytesTotal,
    vsc_total_bytes: vscTotalBytes,
    traditional_full_copy_bytes: traditionalTotal,
    saved_bytes: savedBytes,
    total_chain_reduction_percent: parseFloat(totalChainReduction),
    delta_only_reduction_percent: parseFloat(deltaOnlyReduction),
    avg_delta_bytes: avgDeltaBytes,
    largest_delta_bytes: largestDeltaBytes,
    smallest_delta_bytes: smallestDeltaBytes,
    timings: {
      base_snapshot_time_ms: baseTime,
      delta_generation_total_time_ms: deltaTime,
      chain_creation_time_ms: chainTime,
      restore_time_ms: restoreTime,
      verify_time_ms: verifyTime,
      total_benchmark_time_ms: totalTime
    },
    tokens: {
      base_token_id: chainToken.baseTokenId,
      latest_delta_token_id: chainToken.latestTokenId,
      chain_token_id: chainEntry.id,
      chain_hash_prefix: (chainToken.proof?.chainHash || "").slice(0, 24)
    },
    verification: {
      restore_pass: true,
      verify_pass: true
    },
    notes: [
      "Benchmark fixture generated deterministically with seeded operations",
      "Changes include: text edits, metadata additions, JSON field changes, small file additions",
      "Total chain reduction compares VSC storage to storing full copies of every state",
      "Delta-only reduction compares delta storage to a single full-copy baseline",
      "Results are specific to this profile and fixture composition"
    ]
  };

  fs.writeFileSync(
    path.join(BENCHMARK_DIR, "benchmark-summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );

  // ── Write Markdown Report ──────────────────────────────────────────────────

  const report = `# VSC Benchmark Report

Generated: ${new Date().toISOString()}

## Benchmark Profile

- **Profile:** ${profile}
- **States:** ${config.states}
- **Description:** ${config.description}

## What Was Measured

This benchmark measures VSC's storage-load reduction and restore/verify performance:

1. **Base snapshot creation** — Full folder state encoded once
2. **Delta generation** — Incremental changes between consecutive states
3. **Chain construction** — Ordered linking of base + deltas
4. **State restoration** — Reconstruction of latest state from chain
5. **Verification** — Root hash comparison of restored state

## Storage Comparison

| Metric | Value |
|--------|-------|
| Traditional full-copy storage | ${fmtBytes(traditionalTotal)} |
| VSC total storage | ${fmtBytes(vscTotalBytes)} |
| ├─ Base | ${fmtBytes(baseBytes)} |
| └─ Deltas total | ${fmtBytes(deltaBytesTotal)} |
| **Saved bytes** | **${fmtBytes(savedBytes)}** |
| **Total chain reduction** | **${totalChainReduction}%** |
| Delta-only reduction | ${deltaOnlyReduction}% |

### Delta Size Distribution

| Metric | Value |
|--------|-------|
| Average delta | ${fmtBytes(avgDeltaBytes)} |
| Largest delta | ${fmtBytes(largestDeltaBytes)} |
| Smallest delta | ${fmtBytes(smallestDeltaBytes)} |

## Timing Results

| Operation | Duration |
|-----------|----------|
| Base snapshot | ${fmtDuration(baseTime)} |
| Delta generation (${config.states - 1} deltas) | ${fmtDuration(deltaTime)} |
| Chain creation | ${fmtDuration(chainTime)} |
| Restore latest state | ${fmtDuration(restoreTime)} |
| Verify restored state | ${fmtDuration(verifyTime)} |
| **Total benchmark time** | **${fmtDuration(totalTime)}** |

## Chain Information

- **States:** ${config.states}
- **Deltas:** ${deltaPaths.length}
- **Chain length:** ${(chainToken.steps?.length || 0) + 1} (base + ${chainToken.steps?.length || 0} deltas)
- **Base token ID:** \`${chainToken.baseTokenId}\`
- **Latest delta token ID:** \`${chainToken.latestTokenId}\`
- **Chain token ID:** \`${chainEntry.id}\`
- **Chain hash prefix:** \`${(chainToken.proof?.chainHash || "").slice(0, 24)}\`

## Verification Results

| Check | Status |
|-------|--------|
| Restore | **PASS** |
| Verify | **PASS** |

## Interpretation

**Total chain reduction (${totalChainReduction}%)** represents the storage savings of VSC's base+delta approach compared to storing a full copy of every state. This metric answers: "How much less storage does VSC use?"

**Delta-only reduction (${deltaOnlyReduction}%)** represents the size of deltas relative to a single full-copy baseline. This metric answers: "How small are changes compared to full states?"

## Limitations

- Benchmark fixture uses small, text-based files
- Results are specific to this profile and fixture composition
- Real-world workloads may show different characteristics
- No compression or deduplication beyond delta encoding
- Network storage and distributed scenarios not tested

## Reproduction

To reproduce this benchmark:

\`\`\`bash
npm run vsc -- benchmark ${profile}
# or
npm run benchmark ${profile}
\`\`\`

---

*VSC v1.12 Benchmark Mode — Storage-load reduction through verifiable state-delta chains*
`;

  fs.writeFileSync(
    path.join(BENCHMARK_DIR, "benchmark-report.md"),
    report,
    "utf8"
  );

  // ── Write Chart Data ─────────────────────────────────────────────────────────

  const chartData = {
    title: `VSC Benchmark: ${profile} (${config.states} states)`,
    storage: {
      labels: ["Traditional Full-Copy", "VSC (Base + Deltas)"],
      values: [traditionalTotal, vscTotalBytes],
      breakdown: {
        vsc_base: baseBytes,
        vsc_deltas: deltaBytesTotal
      },
      unit: "bytes",
      reduction_percent: parseFloat(totalChainReduction)
    },
    timing: {
      labels: ["Base Snapshot", "Delta Generation", "Chain Creation", "Restore", "Verify"],
      values_ms: [baseTime, deltaTime, chainTime, restoreTime, verifyTime],
      unit: "milliseconds"
    },
    delta_distribution: {
      count: deltaSizes.length,
      avg_bytes: avgDeltaBytes,
      min_bytes: smallestDeltaBytes,
      max_bytes: largestDeltaBytes,
      sizes: deltaSizes.length <= 100 ? deltaSizes : undefined // Only include if not too large
    },
    notes: [
      "Chart-ready data for visualization",
      "No UI dependencies required",
      "All values in base units (bytes, milliseconds)"
    ]
  };

  fs.writeFileSync(
    path.join(BENCHMARK_DIR, "benchmark-chart-data.json"),
    JSON.stringify(chartData, null, 2),
    "utf8"
  );

  // ── Final Summary ──────────────────────────────────────────────────────────

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║   BENCHMARK COMPLETE                                       ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  return summary;
}

// ── Main ───────────────────────────────────────────────────────────────────────

const profileArg = process.argv[2] || DEFAULT_PROFILE;
runBenchmark(profileArg);
