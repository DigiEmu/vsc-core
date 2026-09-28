#!/usr/bin/env node

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATASET = path.join(ROOT, "dataset");
const GENERATOR = path.join(ROOT, "generator", "generate-dataset.mjs");

let pass = 0;
let fail = 0;

function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    pass++;
  } catch (e) {
    console.error(`FAIL: ${name} — ${e.message}`);
    fail++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATASET, name), "utf8"));
}

const files = [
  "context-blocks.json",
  "probes.json",
  "answer-key.json",
  "dataset-manifest.json",
  "DATASET_SHA256.txt"
];

function snapshot() {
  return Object.fromEntries(
    files.map(name => [name, sha256File(path.join(DATASET, name))])
  );
}

const before = snapshot();

const regen = spawnSync(process.execPath, [GENERATOR], {
  encoding: "utf8"
});

if (regen.status !== 0) {
  console.error(regen.stdout);
  console.error(regen.stderr);
  process.exit(1);
}

const after = snapshot();

const blocks = readJson("context-blocks.json");
const probes = readJson("probes.json");
const answers = readJson("answer-key.json");
const manifest = readJson("dataset-manifest.json");

test("regeneration is byte-identical", () => {
  for (const name of files) {
    assert(
      before[name] === after[name],
      `${name} changed after regeneration`
    );
  }
});

test("exactly 40 context blocks exist", () => {
  assert(blocks.length === 40, `found ${blocks.length}`);
});

test("exactly 40 primary probes exist", () => {
  assert(probes.length === 40, `found ${probes.length}`);
});

test("exactly 40 answer-key entries exist", () => {
  assert(answers.length === 40, `found ${answers.length}`);
});

test("all block IDs are unique", () => {
  const ids = blocks.map(x => x.block_id);
  assert(new Set(ids).size === ids.length, "duplicate block_id");
});

test("all probe IDs are unique", () => {
  const ids = probes.map(x => x.probe_id);
  assert(new Set(ids).size === ids.length, "duplicate probe_id");
});

test("all answer-key probe IDs are unique", () => {
  const ids = answers.map(x => x.probe_id);
  assert(new Set(ids).size === ids.length, "duplicate answer probe_id");
});

test("every probe has exactly one answer-key entry", () => {
  const answerIds = new Set(answers.map(x => x.probe_id));

  for (const probe of probes) {
    assert(answerIds.has(probe.probe_id), `missing answer for ${probe.probe_id}`);
  }

  assert(answerIds.size === probes.length, "answer/probe cardinality mismatch");
});

test("every probe source record exists", () => {
  const blockIds = new Set(blocks.map(x => x.block_id));

  for (const probe of probes) {
    assert(
      blockIds.has(probe.source_record_id),
      `missing source ${probe.source_record_id}`
    );
  }
});

test("every answer source record exists", () => {
  const blockIds = new Set(blocks.map(x => x.block_id));

  for (const answer of answers) {
    assert(
      blockIds.has(answer.source_record_id),
      `missing source ${answer.source_record_id}`
    );
  }
});

test("probe and answer-key source records agree", () => {
  const byId = new Map(answers.map(x => [x.probe_id, x]));

  for (const probe of probes) {
    const answer = byId.get(probe.probe_id);

    assert(
      answer.source_record_id === probe.source_record_id,
      `source mismatch for ${probe.probe_id}`
    );
  }
});

test("each checkpoint has exactly R1 C1 X1 I1", () => {
  for (let n = 1; n <= 10; n++) {
    const cp = `CP${String(n).padStart(2, "0")}`;

    const types = probes
      .filter(x => x.checkpoint_id === cp)
      .map(x => x.probe_id.split("-").at(-1))
      .sort();

    assert(
      JSON.stringify(types) === JSON.stringify(["C1", "I1", "R1", "X1"]),
      `${cp}: ${types.join(",")}`
    );
  }
});

test("all primary scoring types are exact", () => {
  for (const answer of answers) {
    assert(
      answer.scoring_type === "exact",
      `${answer.probe_id} is ${answer.scoring_type}`
    );
  }
});

test("all expected answers use constrained ANSWER format", () => {
  for (const answer of answers) {
    assert(
      /^ANSWER=.+$/.test(answer.expected_answer),
      `${answer.probe_id}: ${answer.expected_answer}`
    );
  }
});

test("manifest cardinalities are correct", () => {
  assert(manifest.checkpoint_count === 10, "checkpoint_count");
  assert(manifest.context_block_count === 40, "context_block_count");
  assert(manifest.primary_probe_count === 40, "primary_probe_count");
});

test("manifest file hashes match actual files", () => {
  for (const [name, expected] of Object.entries(manifest.files)) {
    const actual = sha256File(path.join(DATASET, name));
    assert(actual === expected, `${name} hash mismatch`);
  }
});

console.log("");
console.log(`Dataset integrity results: ${pass} PASS, ${fail} FAIL`);

process.exit(fail === 0 ? 0 : 1);
