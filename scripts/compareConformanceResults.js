// VSC v2.8.2 — Conformance Comparison Runner
// Reads the v2.7 fixture index, runs the Go verifier --json for each fixture,
// and compares actual results against expected results.
// Exits 0 only when all fixtures produce COMPARE_PASS.
// Read-only: never writes to fixture bundle directories.
//
// Usage:
//   node scripts/compareConformanceResults.js           (human-readable table)
//   node scripts/compareConformanceResults.js --json    (machine-readable JSON)

import { spawnSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Comparison result classes ────────────────────────────────────────────────
// COMPARE_PASS means both implementations agree on the expected result class.
// It does not make any claim about real-world truth, legality, or correctness.
// COMPARE_FAIL means the implementations disagree; it does not mean wrongdoing.
// COMPARE_ERROR means the runner itself could not complete a comparison step.
const COMPARE_PASS       = "COMPARE_PASS";
const COMPARE_FAIL       = "COMPARE_FAIL";
const COMPARE_ERROR      = "COMPARE_ERROR";
const COMPARE_INCOMPLETE = "COMPARE_INCOMPLETE";

// ── Fixture index ────────────────────────────────────────────────────────────
const FIXTURE_INDEX_PATH = join(ROOT, "conformance", "v2.7", "fixture-index.json");
// Paths inside the fixture index are relative to the index file's own directory.
const FIXTURE_INDEX_DIR  = dirname(FIXTURE_INDEX_PATH);

function loadFixtureIndex() {
  if (!existsSync(FIXTURE_INDEX_PATH)) {
    console.error(`ERROR: fixture index not found: ${FIXTURE_INDEX_PATH}`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(FIXTURE_INDEX_PATH, "utf8"));
  } catch (e) {
    console.error(`ERROR: cannot parse fixture index: ${e.message}`);
    process.exit(2);
  }
}

// ── Go verifier runner ───────────────────────────────────────────────────────
function runGoVerifier(bundleAbsPath) {
  const result = spawnSync(
    "go",
    ["run", "./cmd/vsc-go", "verify-bundle", "--json", bundleAbsPath],
    { cwd: ROOT, encoding: "utf8" }
  );
  return {
    exitCode: result.status ?? 2,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    spawnError: result.error ? result.error.message : null,
  };
}

// ── Per-fixture comparison ───────────────────────────────────────────────────
function compareFixture(fixture) {
  const { id, path: relPath, expected_result, expected_exit_code } = fixture;

  if (!expected_result) {
    return { id, comparison: COMPARE_INCOMPLETE, reason: "expected_result missing in fixture index" };
  }

  const bundlePath = resolve(FIXTURE_INDEX_DIR, relPath);
  if (!existsSync(bundlePath)) {
    return { id, comparison: COMPARE_ERROR, reason: `bundle path not found: ${relPath}` };
  }

  const run = runGoVerifier(bundlePath);

  if (run.spawnError) {
    return { id, comparison: COMPARE_ERROR, reason: `go verifier spawn error: ${run.spawnError}` };
  }

  // The JSON result field is the semantic source of truth for comparison.
  // Raw process exit codes can vary across shells and platforms (e.g. `go run`
  // on Windows exits 1 for any non-zero child, collapsing multi-value codes).
  // We parse the JSON and derive the canonical exit code from the result class.
  let parsed = null;
  try {
    parsed = JSON.parse(run.stdout);
  } catch (_) {
    return {
      id,
      comparison: COMPARE_ERROR,
      reason: `cannot parse Go verifier JSON output (exit ${run.exitCode})`,
      expected: expected_result,
      actual: null,
      expected_exit: expected_exit_code,
      actual_exit: run.exitCode,
    };
  }

  const actual_result = parsed.result ?? null;

  if (!actual_result) {
    return { id, comparison: COMPARE_INCOMPLETE, reason: "result field missing in Go verifier output" };
  }

  // Derive the actual exit code from the JSON result class.
  // `go run` on Windows exits 1 for any non-zero child exit, so the raw OS exit
  // code from spawnSync is unreliable for multi-value exit codes (2, 3).
  // The JSON result is authoritative; we map it to the canonical exit code.
  const resultToExit = { PASS: 0, FAIL: 1, ERROR: 2, "PROOF-ONLY": 3 };
  const actual_exit  = resultToExit[actual_result] ?? run.exitCode;

  const resultMatch = actual_result === expected_result;
  const exitMatch   = expected_exit_code == null || actual_exit === expected_exit_code;

  const comparison = resultMatch && exitMatch ? COMPARE_PASS : COMPARE_FAIL;
  const reason = comparison === COMPARE_FAIL
    ? [
        !resultMatch ? `result mismatch: expected ${expected_result}, got ${actual_result}` : null,
        !exitMatch   ? `exit code mismatch: expected ${expected_exit_code}, got ${actual_exit}` : null,
      ].filter(Boolean).join("; ")
    : "";

  return {
    id,
    comparison,
    reason,
    expected: expected_result,
    actual: actual_result,
    expected_exit: expected_exit_code,
    actual_exit,
  };
}

// ── Formatting ───────────────────────────────────────────────────────────────
const COL = {
  fixture:       33,
  expected:      11,
  actual:        11,
  exp_exit:      11,
  act_exit:      11,
  comparison:    20,
};

function pad(s, n) { return String(s ?? "—").padEnd(n); }

function printHeader() {
  console.log(`\nVSC v2.8.2 — Conformance Comparison Runner`);
  console.log(`Fixture index: ${FIXTURE_INDEX_PATH}`);
  console.log(`Verifier:      go run ./cmd/vsc-go verify-bundle --json`);
  console.log();
}

function printTable(rows) {
  const header =
    pad("fixture_id",      COL.fixture) +
    pad("expected",        COL.expected) +
    pad("actual",          COL.actual) +
    pad("exp_exit",        COL.exp_exit) +
    pad("act_exit",        COL.act_exit) +
    "comparison";
  const divider = "─".repeat(header.length);
  console.log(divider);
  console.log(header);
  console.log(divider);
  for (const r of rows) {
    const line =
      pad(r.id,            COL.fixture) +
      pad(r.expected,      COL.expected) +
      pad(r.actual,        COL.actual) +
      pad(r.expected_exit, COL.exp_exit) +
      pad(r.actual_exit,   COL.act_exit) +
      r.comparison;
    console.log(line);
    if (r.reason) console.log(`  ↳ ${r.reason}`);
  }
  console.log(divider);
}

// ── JSON output ───────────────────────────────────────────────────────────────
function buildJsonReport(rows, finalResult) {
  const passed     = rows.filter(r => r.comparison === COMPARE_PASS);
  const failed     = rows.filter(r => r.comparison === COMPARE_FAIL);
  const errored    = rows.filter(r => r.comparison === COMPARE_ERROR);
  const incomplete = rows.filter(r => r.comparison === COMPARE_INCOMPLETE);

  const comparisons = rows.map(r => ({
    fixture_id:             r.id,
    expected_result:        r.expected   ?? null,
    actual_result:          r.actual     ?? null,
    expected_exit_code_class: r.expected_exit ?? null,
    actual_exit_code_class:   r.actual_exit   ?? null,
    comparison:             r.comparison,
    ...(r.reason ? { reason: r.reason } : {}),
  }));

  const errors = rows
    .filter(r => r.comparison === COMPARE_ERROR || r.comparison === COMPARE_INCOMPLETE)
    .map(r => ({ fixture_id: r.id, message: r.reason ?? "unknown error" }));

  return {
    profile:          "vsc-node-go-comparison-result-v2.8.2",
    schema_version:   "2.8.2",
    runner: {
      name:           "compareConformanceResults",
      implementation: "node",
    },
    input: {
      fixture_index:  "conformance/v2.7/fixture-index.json",
    },
    result:           finalResult,
    fixtures_total:   rows.length,
    fixtures_passed:  passed.length,
    fixtures_failed:  failed.length + errored.length + incomplete.length,
    comparisons,
    errors,
  };
}

// ── Exit code mapping ────────────────────────────────────────────────────────
// Error and incomplete conditions take precedence over fail so that a runner
// misconfiguration is not silently reported as a simple fixture failure.
function finalResultAndExit(rows) {
  const failed     = rows.filter(r => r.comparison === COMPARE_FAIL);
  const errored    = rows.filter(r => r.comparison === COMPARE_ERROR);
  const incomplete = rows.filter(r => r.comparison === COMPARE_INCOMPLETE);

  if (errored.length > 0)                           return { result: COMPARE_ERROR,      exitCode: 2 };
  if (incomplete.length > 0 && failed.length === 0) return { result: COMPARE_INCOMPLETE, exitCode: 3 };
  if (failed.length > 0)                            return { result: COMPARE_FAIL,       exitCode: 1 };
  return                                                   { result: COMPARE_PASS,       exitCode: 0 };
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const jsonMode = process.argv.includes("--json");

  const index    = loadFixtureIndex();
  const fixtures = index.fixtures ?? [];

  if (!fixtures.length) {
    if (jsonMode) {
      process.stdout.write(JSON.stringify({ error: "fixture index contains no fixtures" }, null, 2) + "\n");
    } else {
      console.error("ERROR: fixture index contains no fixtures.");
    }
    process.exit(2);
  }

  const rows = fixtures.map(compareFixture);
  const { result: finalResult, exitCode } = finalResultAndExit(rows);

  if (jsonMode) {
    const report = buildJsonReport(rows, finalResult);
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(exitCode);
  }

  // ── Human-readable output ─────────────────────────────────────────────────
  printHeader();
  console.log(`Running ${fixtures.length} fixture(s)...\n`);
  printTable(rows);

  const passed     = rows.filter(r => r.comparison === COMPARE_PASS);
  const failed     = rows.filter(r => r.comparison === COMPARE_FAIL);
  const errored    = rows.filter(r => r.comparison === COMPARE_ERROR);
  const incomplete = rows.filter(r => r.comparison === COMPARE_INCOMPLETE);

  console.log(`\nResults: ${passed.length} COMPARE_PASS  |  ${failed.length} COMPARE_FAIL  |  ${errored.length} COMPARE_ERROR  |  ${incomplete.length} COMPARE_INCOMPLETE`);
  console.log(`\nFinal result: ${finalResult}`);
  process.exit(exitCode);
}

main();
