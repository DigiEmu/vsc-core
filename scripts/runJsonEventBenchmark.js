#!/usr/bin/env node
/**
 * runJsonEventBenchmark.js — VSC v1.13 JSON Event Benchmark
 *
 * Usage:  npm run vsc -- benchmark:json [profile]
 *    or:  npm run json-benchmark [profile]
 *    or:  node scripts/runJsonEventBenchmark.js [profile]
 *
 * Profiles: small (10 states), medium (100 states - default), large (1000 states)
 *
 * Generates deterministic AI-style JSON event logs and measures VSC storage-load
 * reduction for structured event state.
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BENCHMARK_DIR = path.join(ROOT, "output", "json-benchmark");
const FIXTURE_DIR = path.join(ROOT, "test-json-benchmark");
const NODE = process.execPath;

// ── Configuration ───────────────────────────────────────────────────────────

const PROFILES = {
  small: { states: 10, eventsPerState: 1, description: "Fast smoke test" },
  medium: { states: 100, eventsPerState: 1, description: "Default local benchmark" },
  large: { states: 1000, eventsPerState: 1, description: "Extended benchmark (optional)" }
};

const DEFAULT_PROFILE = "medium";

// Deterministic seed for pseudo-random operations
const SEED = 54321;

// Base timestamp for deterministic event generation
const BASE_TIMESTAMP = new Date("2024-01-01T00:00:00.000Z").getTime();

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

// Simple seeded RNG for deterministic choices
function seededRandom(seed) {
  let s = seed;
  return function() {
    s = Math.sin(s * 12.9898 + 78.233) * 43758.5453123;
    return s - Math.floor(s);
  };
}

// ── JSON Event Generation ─────────────────────────────────────────────────────

const EVENT_TYPES = ["prompt_response", "tool_call", "policy_check", "retrieval", "final_decision"];
const MODELS = ["gpt-4", "claude-3", "llama-3", "mistral-large"];
const ACTORS = ["ai_agent", "orchestrator", "validator", "retriever"];
const POLICY_RESULTS = ["allowed", "blocked", "flagged", "review_required"];

function generateEvent(sequence, sessionId, prevEventId = null) {
  const rnd = seededRandom(SEED + sequence);
  const eventType = EVENT_TYPES[sequence % EVENT_TYPES.length];
  const model = MODELS[sequence % MODELS.length];
  const actor = ACTORS[sequence % ACTORS.length];
  
  // Deterministic timestamp with small increments
  const timestamp = new Date(BASE_TIMESTAMP + sequence * 1000).toISOString();
  
  // Deterministic event ID based on sequence
  const eventId = sha256(`event-${sessionId}-${sequence}`).slice(0, 24).toUpperCase();
  
  // Previous event hash chain
  const prevHash = prevEventId ? sha256(prevEventId).slice(0, 16) : "0";
  
  // Generate placeholder content based on event type
  let inputHash, outputHash, toolCalls, policyResult, metadata;
  
  switch (eventType) {
    case "prompt_response":
      inputHash = sha256(`prompt-${sequence}`).slice(0, 16);
      outputHash = sha256(`response-${sequence}`).slice(0, 16);
      toolCalls = [];
      policyResult = POLICY_RESULTS[sequence % POLICY_RESULTS.length];
      metadata = { tokens_in: 100 + sequence, tokens_out: 50 + sequence };
      break;
      
    case "tool_call":
      inputHash = sha256(`tool-input-${sequence}`).slice(0, 16);
      outputHash = sha256(`tool-output-${sequence}`).slice(0, 16);
      toolCalls = [{
        tool: "search",
        args: { query: `query-${sequence}`, limit: 5 },
        result_hash: sha256(`tool-result-${sequence}`).slice(0, 16)
      }];
      policyResult = "allowed";
      metadata = { tool_latency_ms: 150 + sequence * 10 };
      break;
      
    case "policy_check":
      inputHash = sha256(`policy-input-${sequence}`).slice(0, 16);
      outputHash = sha256(`policy-output-${sequence}`).slice(0, 16);
      toolCalls = [];
      policyResult = sequence % 10 === 0 ? "blocked" : "allowed";
      metadata = { policy_version: "1.0.0", rules_checked: ["safety", "privacy"] };
      break;
      
    case "retrieval":
      inputHash = sha256(`retrieval-input-${sequence}`).slice(0, 16);
      outputHash = sha256(`retrieval-output-${sequence}`).slice(0, 16);
      toolCalls = [];
      policyResult = "allowed";
      metadata = { sources: [`doc-${sequence}`, `doc-${sequence + 1}`], relevance: 0.85 + (sequence % 10) / 100 };
      break;
      
    case "final_decision":
      inputHash = sha256(`decision-input-${sequence}`).slice(0, 16);
      outputHash = sha256(`decision-output-${sequence}`).slice(0, 16);
      toolCalls = [];
      policyResult = "allowed";
      metadata = { confidence: 0.92 + (sequence % 8) / 100, reasoning_steps: 3 + (sequence % 3) };
      break;
  }
  
  return {
    event_id: eventId,
    sequence: sequence,
    timestamp: timestamp,
    event_type: eventType,
    actor: actor,
    session_id: sessionId,
    model: model,
    input_hash: inputHash,
    output_hash: outputHash,
    policy_result: policyResult,
    tool_calls: toolCalls,
    metadata: metadata,
    prev_event_hash: prevHash,
    canonical: true
  };
}

function generateEventsJson(eventCount, sessionId, startSequence = 0) {
  const events = [];
  let prevEventId = null;
  
  for (let i = 0; i < eventCount; i++) {
    const sequence = startSequence + i;
    const event = generateEvent(sequence, sessionId, prevEventId);
    events.push(event);
    prevEventId = event.event_id;
  }
  
  return {
    schema_version: "1.0",
    session_id: sessionId,
    event_count: events.length,
    generated_at: new Date(BASE_TIMESTAMP + startSequence * 1000).toISOString(),
    canonical: true,
    events: events
  };
}

// ── Fixture Generation ───────────────────────────────────────────────────────

function createJsonBenchmarkFixture(profile) {
  const config = PROFILES[profile];
  console.log(`\n[01] Creating JSON event benchmark fixture (${config.states} states)...`);
  console.log("     " + "─".repeat(50));
  
  // Clean and create fixture directory
  cleanDirectory(FIXTURE_DIR);
  
  const sessionId = sha256(`benchmark-session-${SEED}`).slice(0, 16).toUpperCase();
  
  // Create base state (state 0) - empty or minimal events
  const baseDir = path.join(FIXTURE_DIR, "state-000");
  fs.mkdirSync(baseDir, { recursive: true });
  
  const baseEvents = generateEventsJson(config.eventsPerState, sessionId, 0);
  fs.writeFileSync(
    path.join(baseDir, "events.json"),
    JSON.stringify(baseEvents, null, 2),
    "utf8"
  );
  
  console.log(`     Base state created: ${baseEvents.events.length} events`);
  
  // Create subsequent states with accumulating events
  for (let stateIdx = 1; stateIdx < config.states; stateIdx++) {
    const currStateDir = path.join(FIXTURE_DIR, `state-${String(stateIdx).padStart(3, "0")}`);
    fs.mkdirSync(currStateDir, { recursive: true });
    
    // Each state contains events from 0 to stateIdx (accumulating)
    const eventCount = (stateIdx + 1) * config.eventsPerState;
    const stateEvents = generateEventsJson(eventCount, sessionId, 0);
    
    fs.writeFileSync(
      path.join(currStateDir, "events.json"),
      JSON.stringify(stateEvents, null, 2),
      "utf8"
    );
    
    if (stateIdx % 10 === 0 || stateIdx === config.states - 1) {
      console.log(`     State ${String(stateIdx).padStart(3, "0")}: ${eventCount} events`);
    }
  }
  
  // Calculate total traditional storage
  let traditionalTotal = 0;
  for (let i = 0; i < config.states; i++) {
    const stateDir = path.join(FIXTURE_DIR, `state-${String(i).padStart(3, "0")}`);
    traditionalTotal += getDirectorySize(stateDir);
  }
  
  const totalEvents = config.states * config.eventsPerState;
  console.log(`     Total events: ${totalEvents}`);
  console.log(`     Total traditional storage: ${fmtBytes(traditionalTotal)}`);
  console.log("");
  
  return { 
    states: config.states, 
    eventsPerState: config.eventsPerState,
    totalEvents,
    traditionalTotal,
    sessionId
  };
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

function runJsonBenchmark(profile) {
  const config = PROFILES[profile];
  if (!config) {
    console.error(`Unknown profile: ${profile}`);
    console.error(`Valid profiles: ${Object.keys(PROFILES).join(", ")}`);
    process.exit(1);
  }
  
  const startTime = Date.now();
  
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   VSC v1.13 — JSON EVENT BENCHMARK                         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`Profile: ${profile}`);
  console.log(`States:  ${config.states}`);
  console.log(`Events per state: ${config.eventsPerState}`);
  console.log(`Description: ${config.description}`);
  
  // Prepare output directory
  cleanDirectory(BENCHMARK_DIR);
  
  // Create fixtures
  const { 
    states, 
    eventsPerState, 
    totalEvents, 
    traditionalTotal, 
    sessionId 
  } = createJsonBenchmarkFixture(profile);
  
  // Run VSC encoding for base state
  console.log(`[02] Creating base snapshot...`);
  console.log("     " + "─".repeat(50));
  
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
  console.log("     " + "─".repeat(50));
  
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
  console.log("     " + "─".repeat(50));
  
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
  console.log("     " + "─".repeat(50));
  
  const restoreStartTime = Date.now();
  run("src/restoreDeltaChain.js", [chainJsonPath]);
  const restoreTime = Date.now() - restoreStartTime;
  
  // Determine restored folder path
  const restoredDir = path.join(
    ROOT, "output",
    `chain-${chainToken.baseTokenId}-to-${chainToken.latestTokenId}`,
    `restored-${chainToken.sourceFolderName || "state-000"}`
  );
  
  console.log(`     Restore time: ${fmtDuration(restoreTime)}`);
  console.log("");
  
  // Verify
  console.log(`[07] Verifying restored state...`);
  console.log("     " + "─".repeat(50));
  
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
  const comparableFullCopy = baseBytes;
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
  console.log("║   JSON EVENT BENCHMARK RESULTS                           ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  console.log("\nEvent Model:");
  console.log(`  Total events:        ${totalEvents}`);
  console.log(`  States:              ${config.states}`);
  console.log(`  Events per state:    ${config.eventsPerState}`);
  console.log(`  Session ID:          ${sessionId}`);
  
  console.log("\nStorage Comparison:");
  console.log(`  Raw JSON full-copy:  ${fmtBytes(traditionalTotal)}`);
  console.log(`  VSC total storage:   ${fmtBytes(vscTotalBytes)}`);
  console.log(`    - Base:            ${fmtBytes(baseBytes)}`);
  console.log(`    - Deltas total:    ${fmtBytes(deltaBytesTotal)}`);
  console.log(`  Saved bytes:         ${fmtBytes(savedBytes)}`);
  console.log(`  Total chain reduction: ${totalChainReduction}%`);
  console.log(`  Delta-only reduction:  ${deltaOnlyReduction}%`);
  console.log(`  Average delta size:  ${fmtBytes(avgDeltaBytes)}`);
  console.log(`  Largest delta:       ${fmtBytes(largestDeltaBytes)}`);
  console.log(`  Smallest delta:      ${fmtBytes(smallestDeltaBytes)}`);
  
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
  console.log(`  - ${path.join(BENCHMARK_DIR, "json-benchmark-summary.json")}`);
  console.log(`  - ${path.join(BENCHMARK_DIR, "json-benchmark-report.md")}`);
  console.log(`  - ${path.join(BENCHMARK_DIR, "json-benchmark-chart-data.json")}`);
  
  // ── Write JSON Summary ─────────────────────────────────────────────────────
  
  const summary = {
    source: "json-benchmark",
    profile,
    timestamp: new Date().toISOString(),
    event_model: {
      schema_version: "1.0",
      total_events: totalEvents,
      states: config.states,
      events_per_state: config.eventsPerState,
      session_id: sessionId,
      event_types: EVENT_TYPES,
      primary_unit: "Individual Event"
    },
    state_count: config.states,
    delta_count: deltaPaths.length,
    storage: {
      raw_json_full_copy_bytes: traditionalTotal,
      vsc_base_bytes: baseBytes,
      vsc_delta_bytes_total: deltaBytesTotal,
      vsc_total_bytes: vscTotalBytes,
      saved_bytes: savedBytes,
      total_chain_reduction_percent: parseFloat(totalChainReduction),
      delta_only_reduction_percent: parseFloat(deltaOnlyReduction),
      avg_delta_bytes: avgDeltaBytes,
      largest_delta_bytes: largestDeltaBytes,
      smallest_delta_bytes: smallestDeltaBytes
    },
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
      "JSON Event Benchmark: deterministic AI-style event logs",
      "Primary unit of proof: Individual Event",
      "Events accumulated per state to model growing event logs",
      "Total chain reduction compares VSC storage to storing full copies of every state",
      "Delta-only reduction compares delta storage to a single full-copy baseline",
      "Results are specific to this profile and fixture composition",
      "This is a research prototype, not enterprise production software"
    ]
  };
  
  fs.writeFileSync(
    path.join(BENCHMARK_DIR, "json-benchmark-summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
  
  // ── Write Markdown Report ──────────────────────────────────────────────────
  
  const report = `# VSC JSON Event Benchmark Report

Generated: ${new Date().toISOString()}

## Benchmark Profile

- **Profile:** ${profile}
- **States:** ${config.states}
- **Events per state:** ${config.eventsPerState}
- **Total events:** ${totalEvents}
- **Description:** ${config.description}

## Event Model

This benchmark models AI-style decision events as structured JSON:

### Primary Unit of Proof: Individual Event

Each event represents one discrete AI-relevant decision step:

| Field | Description |
|-------|-------------|
| event_id | Unique deterministic identifier |
| sequence | Ordered position in event stream |
| timestamp | Deterministic ISO timestamp |
| event_type | ${EVENT_TYPES.join(", ")} |
| actor | ${ACTORS.join(", ")} |
| session_id | Session context |
| model | AI model identifier |
| input_hash | Hash of input content |
| output_hash | Hash of output content |
| policy_result | ${POLICY_RESULTS.join(", ")} |
| tool_calls | Structured tool invocations |
| metadata | Event-specific metrics |
| prev_event_hash | Chain integrity link |

### State Representation

- Each state is a folder containing a canonical \`events.json\` file
- State N contains all events from 0 to N (accumulating log)
- The existing folder-based VSC engine snapshots/deltas the JSON state

## Storage Comparison

| Metric | Value |
|--------|-------|
| Raw JSON full-copy storage | ${fmtBytes(traditionalTotal)} |
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

**Total chain reduction (${totalChainReduction}%)** represents the storage savings of VSC's base+delta approach compared to storing a full copy of every event log state. This metric answers: "How much storage does VSC save for accumulating event logs?"

**Delta-only reduction (${deltaOnlyReduction}%)** represents the size of deltas relative to a single full-copy baseline. This metric answers: "How small are the changes compared to full event log states?"

## Limitations

- Deterministic synthetic events, not real AI system logs
- Accumulating event model (each state contains all previous events)
- No deduplication or compression beyond delta encoding
- Real AI event workloads may have different characteristics
- Network storage and distributed scenarios not tested
- Research prototype, not enterprise production software

## Reproduction

To reproduce this benchmark:

\`\`\`bash
npm run vsc -- benchmark:json ${profile}
# or
npm run json-benchmark ${profile}
\`\`\`

---

*VSC v1.13 JSON Event Benchmark — Measuring storage-load reduction for structured AI event evidence*
`;
  
  fs.writeFileSync(
    path.join(BENCHMARK_DIR, "json-benchmark-report.md"),
    report,
    "utf8"
  );
  
  // ── Write Chart Data ─────────────────────────────────────────────────────────
  
  const chartData = {
    title: `VSC JSON Event Benchmark: ${profile} (${config.states} states, ${totalEvents} events)`,
    event_model: {
      schema_version: "1.0",
      total_events: totalEvents,
      states: config.states,
      events_per_state: config.eventsPerState
    },
    storage: {
      labels: ["Raw JSON Full-Copy", "VSC (Base + Deltas)"],
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
      sizes: deltaSizes.length <= 100 ? deltaSizes : undefined
    },
    notes: [
      "Chart-ready data for visualization",
      "No UI dependencies required",
      "All values in base units (bytes, milliseconds)"
    ]
  };
  
  fs.writeFileSync(
    path.join(BENCHMARK_DIR, "json-benchmark-chart-data.json"),
    JSON.stringify(chartData, null, 2),
    "utf8"
  );
  
  // ── Final Summary ──────────────────────────────────────────────────────────
  
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║   JSON EVENT BENCHMARK COMPLETE                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");
  
  return summary;
}

// ── Main ───────────────────────────────────────────────────────────────────────

const profileArg = process.argv[2] || DEFAULT_PROFILE;
runJsonBenchmark(profileArg);
