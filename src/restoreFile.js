import fs from "fs";
import path from "path";
import crypto from "crypto";

const tokenPath = process.argv[2];

if (!tokenPath) {
  console.error("Missing token path.");
  console.error("Usage:");
  console.error('npm run restore output\\vsc-XXXXX-pdf-recovery.json');
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

if (token.mode !== "RECOVERY") {
  console.error(`Token mode is "${token.mode}", expected "RECOVERY".`);
  process.exit(1);
}

const tokenDir = path.dirname(tokenPath);
const outputDir = path.resolve("output");
const recoveryDirName = token.recovery?.directory || `recovery-${token.id}`;
const recoveryDir = path.join(outputDir, recoveryDirName);

if (!fs.existsSync(recoveryDir)) {
  console.error(`Recovery directory not found: ${recoveryDir}`);
  process.exit(1);
}

const safeName = (token.file?.name || "restored-file").replaceAll(" ", "_");
const restoredPath = path.join(recoveryDir, `restored-${safeName}`);

console.log("");
console.log("VSC RECOVERY RESTORE");
console.log("--------------------");
console.log("Token:        ", tokenPath);
console.log("Token ID:     ", token.id);
console.log("File:         ", token.file?.name);
console.log("Expected size:", token.file?.sizeBytes, "bytes");
console.log("Chunks:       ", token.chunks?.length);
console.log("");

const buffers = [];
let allChunksOk = true;

for (const chunk of token.chunks) {
  const chunkPath = path.join(recoveryDir, chunk.file);

  if (!fs.existsSync(chunkPath)) {
    console.error(`Missing chunk file: ${chunkPath}`);
    allChunksOk = false;
    continue;
  }

  const chunkBuffer = fs.readFileSync(chunkPath);
  const actualHash = sha256(chunkBuffer);

  if (actualHash !== chunk.hash) {
    console.error(
      `Chunk ${chunk.chunkIndex} hash mismatch!`
    );
    console.error(`  Expected: ${chunk.hash}`);
    console.error(`  Got:      ${actualHash}`);
    allChunksOk = false;
  }

  buffers.push(chunkBuffer);
}

if (!allChunksOk) {
  console.error("");
  console.error("Verify: FAIL (chunk integrity error)");
  process.exit(1);
}

const restored = Buffer.concat(buffers);
fs.writeFileSync(restoredPath, restored);

const restoredHash = sha256(restored);
const expectedHash = token.proof?.payloadHash;
const isValid = restoredHash === expectedHash;

console.log("Restored file:", restoredPath);
console.log("Restored size:", restored.length, "bytes");
console.log("Hash:         ", restoredHash);
console.log("Verify:       ", isValid ? "PASS" : "FAIL");
console.log("");

if (!isValid) {
  console.error("Hash mismatch against token proof!");
  console.error(`  Expected: ${expectedHash}`);
  console.error(`  Got:      ${restoredHash}`);
  process.exit(1);
}
