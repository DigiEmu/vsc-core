import fs from "fs";
import path from "path";
import crypto from "crypto";

const tokenPath = process.argv[2];

if (!tokenPath) {
  console.error("Missing token path.");
  console.error("Usage:");
  console.error('npm run restore-folder output\\vsc-XXXXX-folder-recovery.json');
  process.exit(1);
}

if (!fs.existsSync(tokenPath)) {
  console.error(`Token not found: ${tokenPath}`);
  process.exit(1);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));

if (token.mode !== "FOLDER_RECOVERY") {
  console.error(`Token mode is "${token.mode}", expected "FOLDER_RECOVERY".`);
  process.exit(1);
}

const outputDir = path.resolve("output");
const recoveryDirName = token.recovery?.directory || `recovery-${token.id}`;
const recoveryDir = path.join(outputDir, recoveryDirName);
const restoreFolderName = token.recovery?.restoreFolderName || `restored-${token.sourceFolderName}`;
const restoreRoot = path.join(recoveryDir, restoreFolderName);

if (!fs.existsSync(recoveryDir)) {
  console.error(`Recovery directory not found: ${recoveryDir}`);
  process.exit(1);
}

console.log("");
console.log("VSC FOLDER RESTORE");
console.log("------------------");
console.log("Token:         ", tokenPath);
console.log("Token ID:      ", token.id);
console.log("Source folder: ", token.sourceFolderName);
console.log("Files:         ", token.fileCount);
console.log("Total chunks:  ", token.totalChunkCount);
console.log("");

if (!fs.existsSync(restoreRoot)) {
  fs.mkdirSync(restoreRoot, { recursive: true });
}

let allFilesOk = true;
let filesRestored = 0;

const restoredFileEntries = [];

for (const fileEntry of token.files) {
  const chunks = fileEntry.chunks;
  const buffers = [];
  let fileOk = true;

  for (const chunk of chunks) {
    const chunkPath = path.join(recoveryDir, chunk.file);

    if (!fs.existsSync(chunkPath)) {
      console.error(`  MISSING chunk: ${chunkPath}`);
      fileOk = false;
      allFilesOk = false;
      continue;
    }

    const chunkBuffer = fs.readFileSync(chunkPath);
    const actualChunkHash = sha256(chunkBuffer);

    if (actualChunkHash !== chunk.hash) {
      console.error(`  CHUNK HASH FAIL: ${chunk.file}`);
      console.error(`    Expected: ${chunk.hash}`);
      console.error(`    Got:      ${actualChunkHash}`);
      fileOk = false;
      allFilesOk = false;
    }

    buffers.push(chunkBuffer);
  }

  if (!fileOk) continue;

  const restored = Buffer.concat(buffers);
  const restoredHash = sha256(restored);

  if (restoredHash !== fileEntry.hash) {
    console.error(`  FILE HASH FAIL: ${fileEntry.relativePath}`);
    console.error(`    Expected: ${fileEntry.hash}`);
    console.error(`    Got:      ${restoredHash}`);
    allFilesOk = false;
    continue;
  }

  const destPath = path.join(restoreRoot, fileEntry.relativePath);
  const destDir = path.dirname(destPath);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.writeFileSync(destPath, restored);
  filesRestored++;

  restoredFileEntries.push({
    relativePath: fileEntry.relativePath,
    hash: restoredHash,
    sizeBytes: restored.length
  });

  console.log(`  OK  ${fileEntry.relativePath}  (${restored.length} bytes)`);
}

// Sort by relativePath for deterministic root hash
restoredFileEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

const rootHashInput = restoredFileEntries
  .map((f) => `${f.relativePath}:${f.hash}:${f.sizeBytes}\n`)
  .join("");
const restoredRootHash = sha256(Buffer.from(rootHashInput, "utf8"));

const expectedRootHash = token.proof?.folderRootHash;
const isValid = allFilesOk && restoredRootHash === expectedRootHash;

console.log("");
console.log("VSC FOLDER RESTORE RESULT");
console.log("-------------------------");
console.log("Restored folder:   ", restoreRoot);
console.log("Files restored:    ", filesRestored, "/", token.fileCount);
console.log("Expected root hash:", expectedRootHash);
console.log("Restored root hash:", restoredRootHash);
console.log("Verify:            ", isValid ? "PASS" : "FAIL");
console.log("");

if (!isValid) {
  if (!allFilesOk) {
    console.error("One or more files failed chunk or hash verification.");
  } else {
    console.error("Folder root hash mismatch.");
  }
  process.exit(1);
}
