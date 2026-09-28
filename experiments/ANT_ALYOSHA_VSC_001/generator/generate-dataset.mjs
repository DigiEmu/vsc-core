#!/usr/bin/env node

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "dataset");

const EXPERIMENT_ID = "ANT_ALYOSHA_VSC_001";
const GENERATOR_VERSION = "0.1";

function sha256(value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(value, "utf8");

  return crypto
    .createHash("sha256")
    .update(bytes)
    .digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }

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

function checkpointId(n) {
  return `CP${String(n).padStart(2, "0")}`;
}

function makeTarget(n) {
  const cp = checkpointId(n);

  return {
    record_id: `${cp}-TARGET-R`,
    record_type: "retrieval_target",
    project_code: `MERIDIAN-${700 + n}`,
    verification_value: `K${10 + n}`,
    status: n % 2 === 0 ? "AMBER" : "GREEN",
  };
}

function makeConstraint(n) {
  const cp = checkpointId(n);

  return {
    record_id: `${cp}-RULE-C`,
    record_type: "constraint",
    rule:
      "If the requested measurement is absent from the supplied record, answer exactly UNKNOWN.",
    supplied_record: {
      asset_id: `ASSET-${100 + n}`,
      status: "ACTIVE"
    },
    requested_field: "measurement",
  };
}

function makeLogic(n) {
  const cp = checkpointId(n);

  return {
    record_id: `${cp}-RULE-X`,
    record_type: "logical_relation",
    symbols: {
      a: `A${n}`,
      b: `B${n}`,
      c: `C${n}`,
      d: `D${n}`,
    },
    relations: [
      `A${n} implies B${n}`,
      `B${n} implies C${n}`,
      `C${n} excludes D${n}`
    ]
  };
}

function makeInterference(n) {
  const cp = checkpointId(n);
  const target = `ORBIT-${800 + n}`;

  return {
    record_id: `${cp}-TARGET-I`,
    record_type: "interference_target",
    target: {
      identifier: target,
      verification_code: `V${20 + n}`
    },
    distractors: [
      {
        identifier: `ORBIT-${80 + n}`,
        verification_code: `V${20 + n}`
      },
      {
        identifier: target,
        verification_code: `V${70 + n}`
      },
      {
        identifier: `ORBIT-${900 + n}`,
        verification_code: `V${70 + n}`
      }
    ]
  };
}

function makeProbes(n, target, constraint, logic, interference) {
  const cp = checkpointId(n);

  return [
    {
      probe_id: `${cp}-R1`,
      checkpoint_id: cp,
      probe_type: "retrieval",
      source_record_id: target.record_id,
      prompt:
        `Return only ANSWER=<value>. What is the verification_value for ${target.project_code}?`,
      expected_answer: `ANSWER=${target.verification_value}`,
      scoring_type: "exact"
    },
    {
      probe_id: `${cp}-C1`,
      checkpoint_id: cp,
      probe_type: "constraint",
      source_record_id: constraint.record_id,
      prompt:
        `Return only ANSWER=<value>. What is the measurement for ${constraint.supplied_record.asset_id}?`,
      expected_answer: "ANSWER=UNKNOWN",
      scoring_type: "exact"
    },
    {
      probe_id: `${cp}-X1`,
      checkpoint_id: cp,
      probe_type: "logic",
      source_record_id: logic.record_id,
      prompt:
        `Return only ANSWER=TRUE or ANSWER=FALSE. ` +
        `Given the frozen relations, can ${logic.symbols.c} and ${logic.symbols.d} both hold?`,
      expected_answer: "ANSWER=FALSE",
      scoring_type: "exact"
    },
    {
      probe_id: `${cp}-I1`,
      checkpoint_id: cp,
      probe_type: "interference",
      source_record_id: interference.record_id,
      prompt:
        `Return only ANSWER=<identifier>. Which identifier is the designated interference target?`,
      expected_answer: `ANSWER=${interference.target.identifier}`,
      scoring_type: "exact"
    }
  ];
}

function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const blocks = [];
  const probes = [];
  const answerKey = [];

  for (let n = 1; n <= 10; n++) {
    const cp = checkpointId(n);

    const records = [
      makeTarget(n),
      makeConstraint(n),
      makeLogic(n),
      makeInterference(n)
    ];

    for (const record of records) {
      const content = serialize(record);

      blocks.push({
        block_id: record.record_id,
        checkpoint_id: cp,
        block_type: record.record_type,
        sha256: sha256(content),
        content: record
      });
    }

    const cpProbes = makeProbes(
      n,
      records[0],
      records[1],
      records[2],
      records[3]
    );

    for (const probe of cpProbes) {
      const probeWithoutExpected = {
        probe_id: probe.probe_id,
        checkpoint_id: probe.checkpoint_id,
        probe_type: probe.probe_type,
        source_record_id: probe.source_record_id,
        prompt: probe.prompt,
        scoring_type: probe.scoring_type
      };

      probes.push({
        ...probeWithoutExpected,
        sha256: sha256(serialize(probeWithoutExpected))
      });

      answerKey.push({
        probe_id: probe.probe_id,
        expected_answer: probe.expected_answer,
        source_record_id: probe.source_record_id,
        scoring_type: probe.scoring_type
      });
    }
  }

  const blockFile = serialize(blocks);
  const probeFile = serialize(probes);
  const answerFile = serialize(answerKey);

  fs.writeFileSync(path.join(OUT, "context-blocks.json"), blockFile);
  fs.writeFileSync(path.join(OUT, "probes.json"), probeFile);
  fs.writeFileSync(path.join(OUT, "answer-key.json"), answerFile);

  const manifest = {
    experiment_id: EXPERIMENT_ID,
    generator_version: GENERATOR_VERSION,
    checkpoint_count: 10,
    primary_probe_count: probes.length,
    context_block_count: blocks.length,
    files: {
      "context-blocks.json": sha256(blockFile),
      "probes.json": sha256(probeFile),
      "answer-key.json": sha256(answerFile)
    }
  };

  const manifestFile = serialize(manifest);

  fs.writeFileSync(
    path.join(OUT, "dataset-manifest.json"),
    manifestFile
  );

  const completeDatasetHash = sha256(
    blockFile + probeFile + answerFile + manifestFile
  );

  fs.writeFileSync(
    path.join(OUT, "DATASET_SHA256.txt"),
    `${completeDatasetHash}  ANT_ALYOSHA_VSC_001_DATASET\n`
  );

  console.log(`Experiment: ${EXPERIMENT_ID}`);
  console.log(`Generator:  ${GENERATOR_VERSION}`);
  console.log(`Blocks:     ${blocks.length}`);
  console.log(`Probes:     ${probes.length}`);
  console.log(`Dataset:    ${completeDatasetHash}`);
}

main();
