import fs from "fs";
import path from "path";
import crypto from "crypto";

const chainTokenPath = process.argv[2];

if (!chainTokenPath) {
  console.error("Usage:");
  console.error("  npm run restore-chain <chainTokenPath>");
  process.exit(1);
}

if (!fs.existsSync(chainTokenPath)) {
  console.error(`Chain token not found: ${chainTokenPath}`);
  process.exit(1);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function collectFiles(dir, baseDir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, baseDir, results);
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replaceAll("\\", "/");
      results.push({ fullPath, relPath });
    }
  }
  return results;
}

function computeFolderRootHash(dir) {
  const files = collectFiles(dir, dir);
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));
  const hashInput = files
    .map(({ fullPath, relPath }) => {
      const buf = fs.readFileSync(fullPath);
      return `${relPath}:${sha256(buf)}:${buf.length}\n`;
    })
    .join("");
  return sha256(Buffer.from(hashInput, "utf8"));
}

// ── Load chain token ──────────────────────────────────────────────────────────

const chain = JSON.parse(fs.readFileSync(chainTokenPath, "utf8"));

if (chain.mode !== "DELTA_CHAIN") {
  console.error(`Token mode is "${chain.mode}", expected "DELTA_CHAIN".`);
  process.exit(1);
}

const outputDir          = path.resolve("output");
const sourceFolderName   = chain.sourceFolderName;
const baseRestoredFolder = path.join(outputDir, `recovery-${chain.baseTokenId}`, `restored-${sourceFolderName}`);

if (!fs.existsSync(baseRestoredFolder)) {
  console.error(`Base restored folder not found: ${baseRestoredFolder}`);
  console.error(`Please run first: npm run restore-folder output\\${chain.baseTokenPath}`);
  process.exit(1);
}

// Chain restore target
const chainDirName   = `chain-${chain.baseTokenId}-to-${chain.latestTokenId}`;
const chainDir       = path.join(outputDir, chainDirName);
const restoreRoot    = path.join(chainDir, `restored-${sourceFolderName}`);

console.log("");
console.log("VSC DELTA CHAIN RESTORE");
console.log("-----------------------");
console.log("Base token ID:   ", chain.baseTokenId);
console.log("Latest token ID: ", chain.latestTokenId);
console.log("Steps:           ", chain.steps.length);
console.log("Restore target:  ", restoreRoot);
console.log("");

// Copy base into chain restore target
if (fs.existsSync(restoreRoot)) {
  fs.rmSync(restoreRoot, { recursive: true, force: true });
}
copyDirRecursive(baseRestoredFolder, restoreRoot);
console.log("Base folder copied to chain restore target.");
console.log("");

// ── Apply each delta step ────────────────────────────────────────────────────

let totalErrors = 0;

for (const step of chain.steps) {
  console.log(`Applying step ${step.index}: ${step.fromTokenId} → ${step.toTokenId}`);

  const deltaTokenPath = path.join(outputDir, step.deltaTokenPath);
  if (!fs.existsSync(deltaTokenPath)) {
    console.error(`  Delta token not found: ${deltaTokenPath}`);
    totalErrors++;
    continue;
  }

  const deltaToken = JSON.parse(fs.readFileSync(deltaTokenPath, "utf8"));
  const deltaDir   = path.join(outputDir,
    deltaToken.recovery?.directory || `delta-${step.fromTokenId}-to-${step.toTokenId}`
  );

  let stepErrors = 0;

  for (const op of deltaToken.operations || []) {
    if (op.op === "DELETE") {
      const filePath = path.join(restoreRoot, op.relativePath);
      if (fs.existsSync(filePath)) fs.rmSync(filePath);
      console.log(`  DELETE  ${op.relativePath}`);

    } else if (op.op === "ADD" || op.op === "MODIFY") {
      const buffers = [];
      let chunkOk = true;

      for (const chunk of op.chunks || []) {
        const chunkPath = path.join(deltaDir, chunk.file);
        if (!fs.existsSync(chunkPath)) {
          console.error(`  MISSING chunk: ${chunkPath}`);
          chunkOk = false;
          stepErrors++;
          break;
        }
        const chunkBuffer = fs.readFileSync(chunkPath);
        if (sha256(chunkBuffer) !== chunk.hash) {
          console.error(`  CHUNK HASH FAIL: ${chunk.file}`);
          chunkOk = false;
          stepErrors++;
          break;
        }
        buffers.push(chunkBuffer);
      }

      if (!chunkOk) continue;

      const restored     = Buffer.concat(buffers);
      const restoredHash = sha256(restored);
      const expectedHash = op.newHash || op.hash;

      if (restoredHash !== expectedHash) {
        console.error(`  FILE HASH FAIL: ${op.relativePath}`);
        stepErrors++;
        continue;
      }

      const destPath = path.join(restoreRoot, op.relativePath);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, restored);
      console.log(`  ${op.op.padEnd(6)}  ${op.relativePath}  (${restored.length} bytes)`);
    }
  }

  // Verify step root hash
  const stepRootHash    = computeFolderRootHash(restoreRoot);
  const expectedStepHash = step.targetFolderRootHash;
  const stepMatch        = stepErrors === 0 && stepRootHash === expectedStepHash;

  console.log(`  Step root hash match: ${stepMatch ? "YES" : "NO"}`);
  if (!stepMatch) {
    console.error(`  Expected: ${expectedStepHash}`);
    console.error(`  Got:      ${stepRootHash}`);
    totalErrors++;
  }
  console.log("");
}

// ── Final verification ────────────────────────────────────────────────────────

const finalRootHash = computeFolderRootHash(restoreRoot);
const expectedFinal = chain.proof.latestFolderRootHash;
const finalMatch    = totalErrors === 0 && finalRootHash === expectedFinal;

console.log("VSC DELTA CHAIN RESTORE RESULT");
console.log("------------------------------");
console.log("Restored folder:       ", restoreRoot);
console.log("Expected root hash:    ", expectedFinal);
console.log("Final root hash:       ", finalRootHash);
console.log("Final root hash match: ", finalMatch ? "YES" : "NO");
console.log("Verify:                ", finalMatch ? "PASS" : "FAIL");
console.log("");

if (!finalMatch) {
  console.error("Chain restore failed.");
  process.exit(1);
}
