import fs from "fs";
import path from "path";
import crypto from "crypto";

const deltaTokenPath = process.argv[2];
const restoredFolderPath = process.argv[3];

if (!deltaTokenPath || !restoredFolderPath) {
  console.error("Usage:");
  console.error('npm run verify-folder-delta output\\vsc-BASE-to-DELTA-folder-delta.json output\\delta-BASE-to-DELTA\\restored-folderName');
  process.exit(1);
}

if (!fs.existsSync(deltaTokenPath)) {
  console.error(`Delta token not found: ${deltaTokenPath}`);
  process.exit(1);
}

if (!fs.existsSync(restoredFolderPath)) {
  console.error(`Restored folder not found: ${restoredFolderPath}`);
  process.exit(1);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

const deltaToken = JSON.parse(fs.readFileSync(deltaTokenPath, "utf8"));

console.log("");
console.log("VSC FOLDER DELTA VERIFY");
console.log("-----------------------");
console.log("Delta token ID: ", deltaToken.id);
console.log("Base token ID:  ", deltaToken.baseTokenId);
console.log("Token:          ", deltaTokenPath);
console.log("Restored folder:", restoredFolderPath);
console.log("");

const addedOps = deltaToken.operations.filter((op) => op.op === "ADD");
const modifiedOps = deltaToken.operations.filter((op) => op.op === "MODIFY");
const deletedOps = deltaToken.operations.filter((op) => op.op === "DELETE");

let passCount = 0;
let failCount = 0;

// Check ADD: files must exist with correct hash
for (const op of addedOps) {
  const filePath = path.join(restoredFolderPath, op.relativePath);
  if (!fs.existsSync(filePath)) {
    console.log(`  FAIL  MISSING (ADD)  ${op.relativePath}`);
    failCount++;
    continue;
  }
  const buf = fs.readFileSync(filePath);
  const actualHash = sha256(buf);
  if (actualHash === op.hash) {
    console.log(`  PASS  ADD     ${op.relativePath}  (${buf.length} bytes)`);
    passCount++;
  } else {
    console.log(`  FAIL  ADD HASH MISMATCH  ${op.relativePath}`);
    console.log(`         Expected: ${op.hash}`);
    console.log(`         Got:      ${actualHash}`);
    failCount++;
  }
}

// Check MODIFY: files must exist with newHash
for (const op of modifiedOps) {
  const filePath = path.join(restoredFolderPath, op.relativePath);
  if (!fs.existsSync(filePath)) {
    console.log(`  FAIL  MISSING (MODIFY)  ${op.relativePath}`);
    failCount++;
    continue;
  }
  const buf = fs.readFileSync(filePath);
  const actualHash = sha256(buf);
  if (actualHash === op.newHash) {
    console.log(`  PASS  MODIFY  ${op.relativePath}  (${buf.length} bytes)`);
    passCount++;
  } else {
    console.log(`  FAIL  MODIFY HASH MISMATCH  ${op.relativePath}`);
    console.log(`         Expected: ${op.newHash}`);
    console.log(`         Got:      ${actualHash}`);
    failCount++;
  }
}

// Check DELETE: files must NOT exist
for (const op of deletedOps) {
  const filePath = path.join(restoredFolderPath, op.relativePath);
  if (!fs.existsSync(filePath)) {
    console.log(`  PASS  DELETE  ${op.relativePath}  (correctly absent)`);
    passCount++;
  } else {
    console.log(`  FAIL  DELETE  ${op.relativePath}  (still exists!)`);
    failCount++;
  }
}

// Compute folder root hash of the entire restored folder
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

const allFiles = collectFiles(restoredFolderPath, restoredFolderPath);
allFiles.sort((a, b) => a.relPath.localeCompare(b.relPath));

const rootHashInput = allFiles
  .map(({ fullPath, relPath }) => {
    const buf = fs.readFileSync(fullPath);
    return `${relPath}:${sha256(buf)}:${buf.length}\n`;
  })
  .join("");
const computedRootHash = sha256(Buffer.from(rootHashInput, "utf8"));

const expectedRootHash = deltaToken.proof?.targetFolderRootHash;
const rootHashMatch = computedRootHash === expectedRootHash;
const isValid = failCount === 0 && rootHashMatch;

console.log("");
console.log("VSC FOLDER DELTA VERIFY RESULT");
console.log("------------------------------");
console.log("Added checked:      ", addedOps.length);
console.log("Modified checked:   ", modifiedOps.length);
console.log("Deleted checked:    ", deletedOps.length);
console.log("PASS count:         ", passCount);
console.log("FAIL count:         ", failCount);
console.log("Expected root hash: ", expectedRootHash);
console.log("Computed root hash: ", computedRootHash);
console.log("Root hash match:    ", rootHashMatch ? "YES" : "NO");
console.log("Verify:             ", isValid ? "PASS" : "FAIL");
console.log("");

if (!isValid) {
  process.exit(1);
}
