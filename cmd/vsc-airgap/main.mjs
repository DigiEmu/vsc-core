#!/usr/bin/env node
/**
 * vsc-airgap — VSC Air-Gapped Evaluation Runner
 *
 * CLI: vsc-airgap transform --input <path> --output <path> --evidence <path>
 *
 * Network-less, offline VSC transformation and evidence generation.
 * Uses only existing VSC text-encoding logic:
 *   src/encodeText.js::encodeTextToVscToken
 *   src/decodeText.js::decodeVscToken
 *   src/verify.js::verifyDecodedMessage
 *
 * Security constraints:
 *   - no network is used
 *   - no raw message content is printed to stdout/stderr
 *   - no credentials, system prompts, or messages arrays are accepted
 *   - evidence.json contains only metadata and hashes
 */

import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { encodeTextToVscToken } from "../../src/encodeText.js";
import { decodeVscToken } from "../../src/decodeText.js";
import { verifyDecodedMessage } from "../../src/verify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RUNNER_VERSION = "v0.1";
const ALLOWED_TOP_KEYS = new Set(["run_id", "message", "type", "config"]);
const ALLOWED_CONFIG_KEYS = new Set(["model", "temperature", "seed", "num_ctx", "stream"]);

function sha256Bytes(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function usage() {
  console.error("Usage: vsc-airgap transform --input <path> --output <path> --evidence <path>");
  process.exit(1);
}

function parseArgs(argv) {
  if (argv.length < 6 || argv[0] !== "transform") {
    usage();
  }
  let inputPath, outputPath, evidencePath;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input") inputPath = argv[++i];
    else if (a === "--output") outputPath = argv[++i];
    else if (a === "--evidence") evidencePath = argv[++i];
    else usage();
  }
  if (!inputPath || !outputPath || !evidencePath) {
    usage();
  }
  return { inputPath, outputPath, evidencePath };
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(2);
}

function safeRunId(input) {
  if (input === undefined) {
    return crypto.randomUUID();
  }
  if (typeof input !== "string" || input.length === 0) {
    fail("run_id must be a non-empty string");
  }
  return input;
}

function validateInput(json) {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    fail("input must be a JSON object");
  }

  for (const key of Object.keys(json)) {
    if (!ALLOWED_TOP_KEYS.has(key)) {
      fail(`input contains unsupported field: ${key}`);
    }
  }

  if (typeof json.message !== "string" || json.message.length === 0) {
    fail("input.message must be a non-empty string");
  }

  if (json.type !== undefined && typeof json.type !== "string") {
    fail("input.type must be a string");
  }

  if (json.config !== undefined) {
    if (json.config === null || typeof json.config !== "object" || Array.isArray(json.config)) {
      fail("input.config must be an object");
    }
    for (const key of Object.keys(json.config)) {
      if (!ALLOWED_CONFIG_KEYS.has(key)) {
        fail(`input.config contains unsupported field: ${key}`);
      }
    }
  }

  return {
    runId: safeRunId(json.run_id),
    message: json.message,
    type: (json.type || "TEXT").toUpperCase(),
    config: json.config || {},
  };
}

function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const k of keys) {
    sorted[k] = obj[k];
  }
  return sorted;
}

function main() {
  const { inputPath, outputPath, evidencePath } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
    fail("input file not found");
  }

  const t0 = process.hrtime.bigint();

  let inputRaw;
  try {
    inputRaw = fs.readFileSync(inputPath);
  } catch {
    fail("cannot read input file");
  }

  let inputJson;
  try {
    inputJson = JSON.parse(inputRaw);
  } catch {
    fail("input is not valid JSON");
  }

  const { runId, message, type } = validateInput(inputJson);

  // Transform using existing VSC text-encoding logic.
  const token = encodeTextToVscToken(message, type);

  // Verify the token decodes back to the uppercased message.
  const decoded = decodeVscToken(token);
  if (!verifyDecodedMessage(decoded, token)) {
    fail("VSC token verification failed");
  }

  // Write transformed output.
  const tokenJson = JSON.stringify(token, null, 2);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, tokenJson, "utf8");
  const outputRaw = Buffer.from(tokenJson, "utf8");

  const t1 = process.hrtime.bigint();
  const durationMs = Number(t1 - t0) / 1_000_000;

  const evidence = sortObject({
    input_bytes: inputRaw.length,
    input_sha256: sha256Bytes(inputRaw),
    processing_duration_ms: durationMs,
    run_id: runId,
    status: "PASS",
    transformed_output_bytes: outputRaw.length,
    transformed_output_sha256: sha256Bytes(outputRaw),
    vsc_token_delta_count: token.delta.length,
    vsc_token_message_length: token.messageLength,
    vsc_version: token.version,
  });

  const evidenceDir = path.dirname(evidencePath);
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");

  // stdout: metadata only, no message content.
  console.log(JSON.stringify({
    run_id: runId,
    status: "PASS",
    input_bytes: inputRaw.length,
    transformed_output_bytes: outputRaw.length,
    vsc_token_message_length: token.messageLength,
    vsc_token_delta_count: token.delta.length,
    runner_version: RUNNER_VERSION,
  }, null, 2));
}

main();
