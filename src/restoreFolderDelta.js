import fs from "fs";
import path from "path";
import crypto from "crypto";

const baseTokenPath = process.argv[2];
const deltaTokenPath = process.argv[3];

if (!baseTokenPath || !deltaTokenPath) {
  console.error("Usage:");
  console.error('npm run restore-folder-delta output\\vsc-BASE-folder-recovery.json output\\vsc-BASE-to-DELTA-folder-delta.json');
  process.exit(1);
}

if (!fs.existsSync(baseTokenPath)) {
  console.error(`Base token not found: ${baseTokenPath}`);
  process.exit(1);
}

if (!fs.existsSync(deltaTokenPath)) {
  console.error(`Delta token not found: ${deltaTokenPath}`);
  process.exit(1);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const baseToken = JSON.parse(fs.readFileSync(baseTokenPath, "utf8"));
const deltaToken = JSON.parse(fs.readFileSync(deltaTokenPath, "utf8"));

if (deltaToken.mode !== "FOLDER_DELTA") {
  console.error(`Delta token mode is "${deltaToken.mode}", expected "FOLDER_DELTA".`);
  process.exit(1);
}

const outputDir = path.resolve("output");
const baseRecoveryDir = path.join(outputDir, `recovery-${baseToken.id}`);
const baseRestoredFolder = path.join(baseRecoveryDir, `restored-${baseToken.sourceFolderName}`);

if (!fs.existsSync(baseRestoredFolder)) {
  console.error(`Base restored folder not found: ${baseRestoredFolder}`);
  console.error(`Please run: npm run restore-folder ${baseTokenPath}`);
  process.exit(1);
}

const deltaDirName = deltaToken.recovery?.directory || `delta-${baseToken.id}-to-${deltaToken.id}`;
const deltaDir = path.join(outputDir, deltaDirName);
const restoreFolderName = deltaToken.recovery?.restoreFolderName || `restored-${baseToken.sourceFolderName}`;
const restoreRoot = path.join(deltaDir, restoreFolderName);

console.log("");
console.log("VSC FOLDER DELTA RESTORE");
console.log("------------------------");
console.log("Base token ID:  ", baseToken.id);
console.log("Delta token ID: ", deltaToken.id);
console.log("Base folder:    ", baseRestoredFolder);
console.log("Target folder:  ", restoreRoot);
console.log("");

// Copy base restored folder into delta restore target
if (fs.existsSync(restoreRoot)) {
  fs.rmSync(restoreRoot, { recursive: true, force: true });
}
copyDirRecursive(baseRestoredFolder, restoreRoot);
console.log("Base folder copied to restore target.");

// Apply operations
let operationsApplied = 0;
let opErrors = 0;

for (const op of deltaToken.operations) {
  if (op.op === "DELETE") {
    const filePath = path.join(restoreRoot, op.relativePath);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath);
    }
    console.log(`  DELETE  ${op.relativePath}`);
    operationsApplied++;

  } else if (op.op === "ADD" || op.op === "MODIFY") {
    const buffers = [];
    let chunkOk = true;

    for (const chunk of op.chunks) {
      const chunkPath = path.join(deltaDir, chunk.file);
      if (!fs.existsSync(chunkPath)) {
        console.error(`  MISSING chunk: ${chunkPath}`);
        chunkOk = false;
        opErrors++;
        break;
      }
      const chunkBuffer = fs.readFileSync(chunkPath);
      const actualChunkHash = sha256(chunkBuffer);
      if (actualChunkHash !== chunk.hash) {
        console.error(`  CHUNK HASH FAIL: ${chunk.file}`);
        chunkOk = false;
        opErrors++;
        break;
      }
      buffers.push(chunkBuffer);
    }

    if (!chunkOk) continue;

    const restored = Buffer.concat(buffers);
    const restoredHash = sha256(restored);
    const expectedHash = op.newHash || op.hash;

    if (restoredHash !== expectedHash) {
      console.error(`  FILE HASH FAIL: ${op.relativePath}`);
      console.error(`    Expected: ${expectedHash}`);
      console.error(`    Got:      ${restoredHash}`);
      opErrors++;
      continue;
    }

    const destPath = path.join(restoreRoot, op.relativePath);
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(destPath, restored);

    console.log(`  ${op.op.padEnd(6)}  ${op.relativePath}  (${restored.length} bytes)`);
    operationsApplied++;
  }
}

// Compute final folder root hash
function collectRestoredFiles(dir, baseDir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectRestoredFiles(fullPath, baseDir, results);
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replaceAll("\\", "/");
      results.push({ fullPath, relPath });
    }
  }
  return results;
}

const restoredFiles = collectRestoredFiles(restoreRoot, restoreRoot);
restoredFiles.sort((a, b) => a.relPath.localeCompare(b.relPath));

const rootHashEntries = restoredFiles.map(({ fullPath, relPath }) => {
  const buf = fs.readFileSync(fullPath);
  return { relativePath: relPath, hash: sha256(buf), sizeBytes: buf.length };
});

const rootHashInput = rootHashEntries
  .map((f) => `${f.relativePath}:${f.hash}:${f.sizeBytes}\n`)
  .join("");
const restoredRootHash = sha256(Buffer.from(rootHashInput, "utf8"));

const expectedTargetRootHash = deltaToken.proof?.targetFolderRootHash;
const isValid = opErrors === 0 && restoredRootHash === expectedTargetRootHash;

console.log("");
console.log("VSC FOLDER DELTA RESTORE RESULT");
console.log("--------------------------------");
console.log("Operations applied:       ", operationsApplied);
console.log("Errors:                   ", opErrors);
console.log("Restored folder:          ", restoreRoot);
console.log("Expected target root hash:", expectedTargetRootHash);
console.log("Restored target root hash:", restoredRootHash);
console.log("Verify:                   ", isValid ? "PASS" : "FAIL");
console.log("");

if (!isValid) {
  if (opErrors > 0) {
    console.error(`${opErrors} operation(s) failed.`);
  } else {
    console.error("Folder root hash mismatch.");
  }
  process.exit(1);
}
