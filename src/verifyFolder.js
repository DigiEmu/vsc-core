import fs from "fs";
import path from "path";
import crypto from "crypto";

const tokenPath = process.argv[2];
const restoredFolderPath = process.argv[3];

if (!tokenPath || !restoredFolderPath) {
  console.error("Usage:");
  console.error('npm run verify-folder output\\vsc-XXXXX-folder-recovery.json output\\recovery-XXXXX\\restored-folderName');
  process.exit(1);
}

if (!fs.existsSync(tokenPath)) {
  console.error(`Token not found: ${tokenPath}`);
  process.exit(1);
}

if (!fs.existsSync(restoredFolderPath)) {
  console.error(`Restored folder not found: ${restoredFolderPath}`);
  process.exit(1);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));

console.log("");
console.log("VSC FOLDER VERIFY");
console.log("-----------------");
console.log("Token ID:       ", token.id);
console.log("Token:          ", tokenPath);
console.log("Restored folder:", restoredFolderPath);
console.log("Files to check: ", token.fileCount);
console.log("");

let passCount = 0;
let failCount = 0;

const verifiedEntries = [];

for (const fileEntry of token.files) {
  const restoredFilePath = path.join(restoredFolderPath, fileEntry.relativePath);

  if (!fs.existsSync(restoredFilePath)) {
    console.log(`  FAIL  MISSING  ${fileEntry.relativePath}`);
    failCount++;
    continue;
  }

  const buffer = fs.readFileSync(restoredFilePath);
  const actualHash = sha256(buffer);

  if (actualHash === fileEntry.hash) {
    console.log(`  PASS  ${fileEntry.relativePath}  (${buffer.length} bytes)`);
    passCount++;

    verifiedEntries.push({
      relativePath: fileEntry.relativePath,
      hash: actualHash,
      sizeBytes: buffer.length
    });
  } else {
    console.log(`  FAIL  HASH MISMATCH  ${fileEntry.relativePath}`);
    console.log(`         Expected: ${fileEntry.hash}`);
    console.log(`         Got:      ${actualHash}`);
    failCount++;
  }
}

// Compute folder root hash from verified files (sorted deterministically)
verifiedEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

const rootHashInput = verifiedEntries
  .map((f) => `${f.relativePath}:${f.hash}:${f.sizeBytes}\n`)
  .join("");
const computedRootHash = sha256(Buffer.from(rootHashInput, "utf8"));

const expectedRootHash = token.proof?.folderRootHash;
const rootHashMatch = computedRootHash === expectedRootHash;
const isValid = failCount === 0 && rootHashMatch;

console.log("");
console.log("VSC FOLDER VERIFY RESULT");
console.log("------------------------");
console.log("Files checked:      ", token.fileCount);
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
