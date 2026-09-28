#!/usr/bin/env node
/**
 * VSC Air-Gapped Evaluation Runner — Acceptance Test
 *
 * Runs the vsc-airgap transform against synthetic fixtures and verifies:
 *   1. identical input produces byte-identical vsc-request.json
 *   2. deterministic evidence fields are stable
 *   3. stdout/stderr contain no prompt/message content
 *   4. invalid inputs fail closed
 *   5. system-prompt or messages inputs fail closed
 *   6. evidence.json contains no message, system, or secret fields
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const RUNNER = process.execPath;
const RUNNER_SCRIPT = path.join(ROOT, "cmd", "vsc-airgap", "main.mjs");
const FIXTURE = path.join(ROOT, "airgap", "fixtures", "benchmark-input-example.json");
const OUT_DIR = path.join(ROOT, "output", "airgap-acceptance");

function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function clean() {
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function run(inputPath, runId) {
  const output = path.join(OUT_DIR, `${runId}-vsc-request.json`);
  const evidence = path.join(OUT_DIR, `${runId}-evidence.json`);
  const result = spawnSync(RUNNER, [
    RUNNER_SCRIPT,
    "transform",
    "--input", inputPath,
    "--output", output,
    "--evidence", evidence,
  ], { encoding: "utf8" });
  return { result, output, evidence };
}

function assertEq(label, a, b) {
  if (a !== b) {
    throw new Error(`FAIL: ${label} mismatch: ${a} !== ${b}`);
  }
}

function assertContains(label, haystack, needle) {
  if (haystack.includes(needle)) {
    throw new Error(`FAIL: ${label} contains forbidden text "${needle}"`);
  }
}

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passCount++;
  } catch (e) {
    console.error(`FAIL: ${name} — ${e.message}`);
    failCount++;
  }
}

function main() {
  clean();

  test("valid transform run A succeeds", () => {
    const { result, output } = run(FIXTURE, "runA");
    if (result.status !== 0) throw new Error(`exit ${result.status}: ${result.stderr}`);
    if (!fs.existsSync(output)) throw new Error("vsc-request.json not created");
  });

  test("valid transform run B succeeds", () => {
    const { result, output } = run(FIXTURE, "runB");
    if (result.status !== 0) throw new Error(`exit ${result.status}: ${result.stderr}`);
    if (!fs.existsSync(output)) throw new Error("vsc-request.json not created");
  });

  test("identical input produces byte-identical vsc-request.json", () => {
    const outA = path.join(OUT_DIR, "runA-vsc-request.json");
    const outB = path.join(OUT_DIR, "runB-vsc-request.json");
    assertEq("vsc-request hash", sha256File(outA), sha256File(outB));
  });

  test("deterministic evidence fields are stable", () => {
    const evA = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "runA-evidence.json"), "utf8"));
    const evB = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "runB-evidence.json"), "utf8"));
    const deterministic = [
      "input_bytes",
      "input_sha256",
      "run_id",
      "status",
      "transformed_output_bytes",
      "transformed_output_sha256",
      "vsc_token_delta_count",
      "vsc_token_message_length",
      "vsc_version",
    ];
    for (const k of deterministic) {
      assertEq(`evidence.${k}`, JSON.stringify(evA[k]), JSON.stringify(evB[k]));
    }
  });

  test("stdout and stderr do not contain message", () => {
    const { result } = run(FIXTURE, "runC");
    const out = (result.stdout || "") + (result.stderr || "");
    const msg = "DETERMINISTIC RECONSTRUCTION";
    assertContains("stdout/stderr", out, msg);
  });

  test("evidence.json does not contain message or system fields", () => {
    const ev = fs.readFileSync(path.join(OUT_DIR, "runC-evidence.json"), "utf8");
    assertContains("evidence", ev, "DETERMINISTIC");
    assertContains("evidence", ev, "system");
    assertContains("evidence", ev, "api_key");
  });

  test("vsc-request.json does not contain credentials or system prompt", () => {
    const out = fs.readFileSync(path.join(OUT_DIR, "runC-vsc-request.json"), "utf8");
    assertContains("vsc-request", out, "api_key");
    assertContains("vsc-request", out, "system");
  });

  test("invalid JSON fails closed", () => {
    const bad = path.join(OUT_DIR, "invalid.json");
    fs.writeFileSync(bad, "{ not json");
    const { result } = run(bad, "invalid");
    if (result.status !== 2) throw new Error(`expected exit 2, got ${result.status}`);
  });

  test("input with system field fails closed", () => {
    const bad = path.join(OUT_DIR, "system.json");
    fs.writeFileSync(bad, JSON.stringify({ run_id: "x", message: "HELLO", system: "do not use" }));
    const { result } = run(bad, "system");
    if (result.status !== 2) throw new Error(`expected exit 2, got ${result.status}`);
  });

  test("input with messages field fails closed", () => {
    const bad = path.join(OUT_DIR, "messages.json");
    fs.writeFileSync(bad, JSON.stringify({ run_id: "x", message: "HELLO", messages: [] }));
    const { result } = run(bad, "messages");
    if (result.status !== 2) throw new Error(`expected exit 2, got ${result.status}`);
  });

  test("input with api_key in config fails closed", () => {
    const bad = path.join(OUT_DIR, "apikey.json");
    fs.writeFileSync(bad, JSON.stringify({ run_id: "x", message: "HELLO", config: { api_key: "secret" } }));
    const { result } = run(bad, "apikey");
    if (result.status !== 2) throw new Error(`expected exit 2, got ${result.status}`);
  });

  console.log("");
  console.log(`Acceptance results: ${passCount} PASS, ${failCount} FAIL`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();
