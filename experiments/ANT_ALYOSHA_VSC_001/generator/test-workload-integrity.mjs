#!/usr/bin/env node

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WORKLOAD = path.join(ROOT, "workload");
const DATASET = path.join(ROOT, "dataset");
const BUILDER = path.join(ROOT, "generator", "build-workload.mjs");

let pass = 0;
let fail = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8"))
    .digest("hex");
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function workloadFiles() {
  return fs.readdirSync(WORKLOAD)
    .filter(x => fs.statSync(path.join(WORKLOAD, x)).isFile())
    .sort();
}

function snapshot() {
  return Object.fromEntries(
    workloadFiles().map(name => [
      name,
      sha256(fs.readFileSync(path.join(WORKLOAD, name)))
    ])
  );
}

const before = snapshot();

const regen = spawnSync(process.execPath, [BUILDER], {
  encoding: "utf8"
});

if (regen.status !== 0) {
  console.error(regen.stdout);
  console.error(regen.stderr);
  process.exit(1);
}

const after = snapshot();

const manifest = readJson(
  path.join(WORKLOAD, "workload-manifest.json")
);

const answerKey = readJson(
  path.join(DATASET, "answer-key.json")
);

test("workload regeneration is byte-identical", () => {
  const names = new Set([
    ...Object.keys(before),
    ...Object.keys(after)
  ]);

  for (const name of names) {
    assert(before[name] === after[name], `${name} changed`);
  }
});

test("exactly 10 workload stages exist", () => {
  assert(manifest.stages.length === 10,
    `found ${manifest.stages.length}`);
});

test("checkpoint IDs are CP01 through CP10", () => {
  manifest.stages.forEach((stage, index) => {
    const expected = `CP${String(index + 1).padStart(2, "0")}`;
    assert(stage.checkpoint_id === expected,
      `expected ${expected}, found ${stage.checkpoint_id}`);
  });
});

test("every stage has exactly four probes", () => {
  for (const stage of manifest.stages) {
    assert(stage.primary_probe_count === 4,
      `${stage.checkpoint_id} has ${stage.primary_probe_count}`);

    const probes = readJson(path.join(WORKLOAD, stage.probe_file));

    assert(probes.length === 4,
      `${stage.probe_file} contains ${probes.length}`);
  }
});

test("all context hashes match manifest", () => {
  for (const stage of manifest.stages) {
    const content = fs.readFileSync(
      path.join(WORKLOAD, stage.context_file)
    );

    assert(
      sha256(content) === stage.context_sha256,
      `${stage.context_file} hash mismatch`
    );
  }
});

test("all probe hashes match manifest", () => {
  for (const stage of manifest.stages) {
    const content = fs.readFileSync(
      path.join(WORKLOAD, stage.probe_file)
    );

    assert(
      sha256(content) === stage.probe_sha256,
      `${stage.probe_file} hash mismatch`
    );
  }
});

test("context character counts match manifest", () => {
  for (const stage of manifest.stages) {
    const text = fs.readFileSync(
      path.join(WORKLOAD, stage.context_file),
      "utf8"
    );

    assert(
      text.length === stage.deterministic_character_count,
      `${stage.context_file} character count mismatch`
    );
  }
});

test("context grows monotonically", () => {
  let previous = 0;

  for (const stage of manifest.stages) {
    assert(
      stage.deterministic_character_count > previous,
      `${stage.checkpoint_id} did not grow`
    );

    previous = stage.deterministic_character_count;
  }
});

test("all workload probe IDs are unique", () => {
  const ids = [];

  for (const stage of manifest.stages) {
    const probes = readJson(path.join(WORKLOAD, stage.probe_file));

    for (const probe of probes) {
      ids.push(probe.probe_id);
    }
  }

  assert(new Set(ids).size === 40,
    `unique probe IDs: ${new Set(ids).size}`);
});

test("workload contains all 40 answer-key probes", () => {
  const workloadIds = new Set();

  for (const stage of manifest.stages) {
    const probes = readJson(path.join(WORKLOAD, stage.probe_file));

    for (const probe of probes) {
      workloadIds.add(probe.probe_id);
    }
  }

  for (const answer of answerKey) {
    assert(
      workloadIds.has(answer.probe_id),
      `missing ${answer.probe_id}`
    );
  }
});

test("no constrained expected ANSWER string leaks into context", () => {
  for (const stage of manifest.stages) {
    const text = fs.readFileSync(
      path.join(WORKLOAD, stage.context_file),
      "utf8"
    );

    for (const answer of answerKey) {
      assert(
        !text.includes(answer.expected_answer),
        `${answer.probe_id} leaked into ${stage.context_file}`
      );
    }
  }
});

test("workload declares exact token count as unknown", () => {
  assert(
    manifest.exact_token_count_claimed === false,
    "exact_token_count_claimed must be false"
  );

  assert(
    manifest.actual_runtime_token_measurement_required === true,
    "runtime token measurement must be required"
  );
});

test("final workload exceeds 200000 deterministic characters", () => {
  const finalStage = manifest.stages.at(-1);

  assert(
    finalStage.deterministic_character_count >= 200000,
    `only ${finalStage.deterministic_character_count}`
  );
});

console.log("");
console.log(`Workload validation results: ${pass} PASS, ${fail} FAIL`);

process.exit(fail === 0 ? 0 : 1);
