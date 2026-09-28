#!/usr/bin/env node

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATASET = path.join(ROOT, "dataset");
const OUT = path.join(ROOT, "workload");

const EXPERIMENT_ID = "ANT_ALYOSHA_VSC_001";
const WORKLOAD_VERSION = "0.1";

/*
  These are deterministic byte-growth targets, not claims about exact
  Qwen token counts.

  The remote runtime MUST record actual token/context measurements.
*/
const TARGET_CONTEXT_CHARS = [
  20000,
  40000,
  60000,
  80000,
  100000,
  120000,
  140000,
  160000,
  180000,
  200000
];

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8"))
    .digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);

  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonical(value[key]);
    }
    return out;
  }

  return value;
}

function serialize(value) {
  return JSON.stringify(canonical(value), null, 2) + "\n";
}

function cp(n) {
  return `CP${String(n).padStart(2, "0")}`;
}

function deterministicFiller(checkpoint, index) {
  const subjects = [
    "archive",
    "catalogue",
    "ledger",
    "inventory",
    "registry",
    "schedule",
    "directory",
    "index"
  ];

  const states = [
    "stored",
    "reviewed",
    "indexed",
    "catalogued",
    "recorded",
    "sorted"
  ];

  const subject = subjects[(checkpoint + index) % subjects.length];
  const state = states[(checkpoint * 3 + index) % states.length];

  /*
    Deliberately generic prose. No ANT/VSC terminology, no experimental
    instructions, and no synthetic answer-key identifiers.
  */
  return (
    `FILLER-${cp(checkpoint)}-${String(index).padStart(5, "0")}: ` +
    `The ${subject} entry ${index} was ${state} during routine documentation. ` +
    `This neutral record exists only to provide deterministic context growth. ` +
    `It contains no experimental instruction and establishes no evaluation rule.\n`
  );
}

function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const blocks = JSON.parse(
    fs.readFileSync(path.join(DATASET, "context-blocks.json"), "utf8")
  );

  const probes = JSON.parse(
    fs.readFileSync(path.join(DATASET, "probes.json"), "utf8")
  );

  const answerKey = JSON.parse(
    fs.readFileSync(path.join(DATASET, "answer-key.json"), "utf8")
  );

  const stages = [];
  let accumulated = "";

  for (let n = 1; n <= 10; n++) {
    const checkpoint = cp(n);

    const checkpointBlocks = blocks.filter(
      x => x.checkpoint_id === checkpoint
    );

    const checkpointProbes = probes.filter(
      x => x.checkpoint_id === checkpoint
    );

    accumulated += `\n=== ${checkpoint} CONTROLLED RECORDS ===\n`;

    for (const block of checkpointBlocks) {
      accumulated += serialize(block.content);
    }

    let fillerIndex = 1;
    const targetChars = TARGET_CONTEXT_CHARS[n - 1];

    while (accumulated.length < targetChars) {
      accumulated += deterministicFiller(n, fillerIndex++);
    }

    const contextFile = `${checkpoint}-context.txt`;
    const probeFile = `${checkpoint}-probes.json`;

    fs.writeFileSync(
      path.join(OUT, contextFile),
      accumulated,
      "utf8"
    );

    fs.writeFileSync(
      path.join(OUT, probeFile),
      serialize(checkpointProbes),
      "utf8"
    );

    stages.push({
      checkpoint_id: checkpoint,
      intended_context_target: `~${n * 5}k tokens (approximate target only)`,
      deterministic_character_count: accumulated.length,
      context_file: contextFile,
      context_sha256: sha256(accumulated),
      probe_file: probeFile,
      probe_sha256: sha256(serialize(checkpointProbes)),
      primary_probe_count: checkpointProbes.length
    });
  }

  const manifest = {
    experiment_id: EXPERIMENT_ID,
    workload_version: WORKLOAD_VERSION,
    construction: "cumulative deterministic text workload",
    exact_token_count_claimed: false,
    actual_runtime_token_measurement_required: true,
    stages
  };

  const manifestText = serialize(manifest);

  fs.writeFileSync(
    path.join(OUT, "workload-manifest.json"),
    manifestText,
    "utf8"
  );

  /*
    Leak scan: exact expected answers must not occur in filler/context
    except where their underlying controlled source record necessarily
    contains the source value.

    We therefore additionally forbid the complete constrained ANSWER=
    strings from appearing anywhere in context.
  */
  for (const answer of answerKey) {
    for (const stage of stages) {
      const text = fs.readFileSync(
        path.join(OUT, stage.context_file),
        "utf8"
      );

      if (text.includes(answer.expected_answer)) {
        throw new Error(
          `Answer-key leak: ${answer.probe_id} in ${stage.context_file}`
        );
      }
    }
  }

  const workloadHashMaterial = stages
    .map(x => `${x.context_sha256}:${x.probe_sha256}`)
    .join("\n") + "\n" + sha256(manifestText);

  const workloadHash = sha256(workloadHashMaterial);

  fs.writeFileSync(
    path.join(OUT, "WORKLOAD_SHA256.txt"),
    `${workloadHash}  ANT_ALYOSHA_VSC_001_WORKLOAD\n`,
    "ascii"
  );

  console.log(`Experiment: ${EXPERIMENT_ID}`);
  console.log(`Workload:   ${WORKLOAD_VERSION}`);
  console.log(`Stages:     ${stages.length}`);
  console.log(`Final chars:${stages.at(-1).deterministic_character_count}`);
  console.log(`Hash:       ${workloadHash}`);
}

main();
