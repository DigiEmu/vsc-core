import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { spawnSync } from "child_process";

const REPO_ROOT = path.resolve(".");

const ENCODE_FOLDER = path.join(
  REPO_ROOT,
  "src",
  "encodeFolderCli.js"
);

const ENCODE_DELTA = path.join(
  REPO_ROOT,
  "src",
  "encodeFolderDeltaCli.js"
);

const CREATE_CHAIN = path.join(
  REPO_ROOT,
  "src",
  "createDeltaChainCli.js"
);

const RESTORE_FOLDER = path.join(
  REPO_ROOT,
  "src",
  "restoreFolder.js"
);

const RESTORE_CHAIN = path.join(
  REPO_ROOT,
  "src",
  "restoreDeltaChain.js"
);

const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "vsc-chain-regression-")
);

function sha256(buffer) {
  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

function writeState(dir, values) {
  fs.mkdirSync(dir, { recursive: true });

  for (const [name, content] of Object.entries(values)) {
    fs.writeFileSync(
      path.join(dir, name),
      content,
      "utf8"
    );
  }
}

function runNode(script, args) {
  const result = spawnSync(
    process.execPath,
    [script, ...args],
    {
      cwd: tempRoot,
      encoding: "utf8"
    }
  );

  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);

    throw new Error(
      `Command failed: node ${script} ${args.join(" ")}`
    );
  }

  return result.stdout;
}

function readManifest() {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        tempRoot,
        "output",
        "manifest.json"
      ),
      "utf8"
    )
  );
}

function onlyByMode(mode) {
  const entries = readManifest().filter(
    entry => entry.mode === mode
  );

  if (entries.length !== 1) {
    throw new Error(
      `Expected exactly one manifest entry for mode ${mode}, got ${entries.length}`
    );
  }

  return entries[0];
}

function deltaFrom(fromTokenId) {
  const entries = readManifest().filter(
    entry =>
      entry.mode === "FOLDER_DELTA" &&
      entry.baseline === fromTokenId
  );

  if (entries.length !== 1) {
    throw new Error(
      `Expected exactly one FOLDER_DELTA from ${fromTokenId}, got ${entries.length}`
    );
  }

  return entries[0];
}

function readToken(tokenPath) {
  return JSON.parse(
    fs.readFileSync(tokenPath, "utf8")
  );
}

function modifiedPaths(tokenPath) {
  return (readToken(tokenPath).operations || [])
    .filter(op => op.op === "MODIFY")
    .map(op => op.relativePath)
    .sort();
}

function sameStringArray(actual, expected) {
  return (
    actual.length === expected.length &&
    actual.every(
      (value, index) => value === expected[index]
    )
  );
}

function compareFolders(expectedDir, actualDir) {
  const expectedFiles = fs
    .readdirSync(expectedDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort();

  const actualFiles = fs
    .readdirSync(actualDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort();

  if (!sameStringArray(actualFiles, expectedFiles)) {
    return {
      pass: false,
      compared: 0,
      expectedFiles,
      actualFiles
    };
  }

  let compared = 0;

  for (const fileName of expectedFiles) {
    const expectedBuffer = fs.readFileSync(
      path.join(expectedDir, fileName)
    );

    const actualBuffer = fs.readFileSync(
      path.join(actualDir, fileName)
    );

    if (
      sha256(expectedBuffer) !==
      sha256(actualBuffer)
    ) {
      return {
        pass: false,
        compared,
        mismatch: fileName
      };
    }

    compared++;
  }

  return {
    pass: true,
    compared
  };
}

try {
  const state0 = path.join(tempRoot, "state-000");
  const state1 = path.join(tempRoot, "state-001");
  const state2 = path.join(tempRoot, "state-002");
  const state3 = path.join(tempRoot, "state-003");

  writeState(state0, {
    "a.txt": "A0\n",
    "b.txt": "B0\n",
    "c.txt": "C0\n",
    "d.txt": "D0\n"
  });

  writeState(state1, {
    "a.txt": "A0\n",
    "b.txt": "B1\n",
    "c.txt": "C0\n",
    "d.txt": "D0\n"
  });

  writeState(state2, {
    "a.txt": "A0\n",
    "b.txt": "B1\n",
    "c.txt": "C2\n",
    "d.txt": "D0\n"
  });

  writeState(state3, {
    "a.txt": "A0\n",
    "b.txt": "B1\n",
    "c.txt": "C2\n",
    "d.txt": "D3\n"
  });

  runNode(
    ENCODE_FOLDER,
    [state0, "FOLDER"]
  );

  const base = onlyByMode(
    "FOLDER_RECOVERY"
  );

  const baseTokenPath = path.join(
    tempRoot,
    "output",
    base.json
  );

  runNode(
    ENCODE_DELTA,
    [baseTokenPath, state1, "FOLDER_DELTA"]
  );

  const delta1 = deltaFrom(base.id);

  const delta1Path = path.join(
    tempRoot,
    "output",
    delta1.json
  );

  runNode(
    ENCODE_DELTA,
    [delta1Path, state2, "FOLDER_DELTA"]
  );

  const delta2 = deltaFrom(delta1.id);

  const delta2Path = path.join(
    tempRoot,
    "output",
    delta2.json
  );

  runNode(
    ENCODE_DELTA,
    [delta2Path, state3, "FOLDER_DELTA"]
  );

  const delta3 = deltaFrom(delta2.id);

  const delta3Path = path.join(
    tempRoot,
    "output",
    delta3.json
  );

  const delta1Modified =
    modifiedPaths(delta1Path);

  const delta2Modified =
    modifiedPaths(delta2Path);

  const delta3Modified =
    modifiedPaths(delta3Path);

  const deltaMinimalityPass =
    sameStringArray(
      delta1Modified,
      ["b.txt"]
    ) &&
    sameStringArray(
      delta2Modified,
      ["c.txt"]
    ) &&
    sameStringArray(
      delta3Modified,
      ["d.txt"]
    );

  runNode(
    CREATE_CHAIN,
    [
      baseTokenPath,
      delta1Path,
      delta2Path,
      delta3Path
    ]
  );

  const chain = onlyByMode(
    "DELTA_CHAIN"
  );

  const chainPath = path.join(
    tempRoot,
    "output",
    chain.json
  );

  const chainToken = readToken(chainPath);

  const linkagePass =
    chainToken.steps.length === 3 &&
    chainToken.steps[0].fromTokenId === base.id &&
    chainToken.steps[0].toTokenId === delta1.id &&
    chainToken.steps[1].fromTokenId === delta1.id &&
    chainToken.steps[1].toTokenId === delta2.id &&
    chainToken.steps[2].fromTokenId === delta2.id &&
    chainToken.steps[2].toTokenId === delta3.id;

  runNode(
    RESTORE_FOLDER,
    [baseTokenPath]
  );

  runNode(
    RESTORE_CHAIN,
    [chainPath]
  );

  const restoredDir = path.join(
    tempRoot,
    "output",
    `chain-${base.id}-to-${delta3.id}`,
    "restored-state-000"
  );

  const folderComparison =
    compareFolders(state3, restoredDir);

  console.log(
    "VSC CHAINED FOLDER DELTA REGRESSION"
  );
  console.log(
    "-----------------------------------"
  );

  console.log(
    `delta-1 MODIFY: ${delta1Modified.join(", ")}`
  );

  console.log(
    `delta-2 MODIFY: ${delta2Modified.join(", ")}`
  );

  console.log(
    `delta-3 MODIFY: ${delta3Modified.join(", ")}`
  );

  console.log("");

  console.log(
    `Delta minimality: ${deltaMinimalityPass ? "PASS" : "FAIL"}`
  );

  console.log(
    `Chain linkage:    ${linkagePass ? "PASS" : "FAIL"}`
  );

  console.log(
    `Restore SHA256:   ${folderComparison.pass ? "PASS" : "FAIL"}`
  );

  console.log(
    `Files compared:   ${folderComparison.compared}`
  );

  const pass =
    deltaMinimalityPass &&
    linkagePass &&
    folderComparison.pass &&
    folderComparison.compared === 4;

  console.log("");

  console.log(
    `Regression result: ${pass ? "PASS" : "FAIL"}`
  );

  if (!pass) {
    process.exitCode = 1;
  }
} finally {
  fs.rmSync(
    tempRoot,
    {
      recursive: true,
      force: true
    }
  );
}
