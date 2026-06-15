import fs from "fs";
import path from "path";
import crypto from "crypto";

const chainTokenPath        = process.argv[2];
const restoredChainFolderPath = process.argv[3];

if (!chainTokenPath || !restoredChainFolderPath) {
  console.error("Usage:");
  console.error("  npm run verify-chain <chainTokenPath> <restoredChainFolderPath>");
  process.exit(1);
}

if (!fs.existsSync(chainTokenPath)) {
  console.error(`Chain token not found: ${chainTokenPath}`);
  process.exit(1);
}

if (!fs.existsSync(restoredChainFolderPath)) {
  console.error(`Restored folder not found: ${restoredChainFolderPath}`);
  process.exit(1);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
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

function fmtBytes(n) {
  if (!n || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Load chain token ──────────────────────────────────────────────────────────

const chain = JSON.parse(fs.readFileSync(chainTokenPath, "utf8"));

if (chain.mode !== "DELTA_CHAIN") {
  console.error(`Token mode is "${chain.mode}", expected "DELTA_CHAIN".`);
  process.exit(1);
}

const summary = chain.summary || {};
const proof   = chain.proof   || {};

console.log("");
console.log("VSC DELTA CHAIN VERIFY");
console.log("----------------------");
console.log("Chain token:           ", chainTokenPath);
console.log("Restored folder:       ", restoredChainFolderPath);
console.log("Base token ID:         ", chain.baseTokenId);
console.log("Latest token ID:       ", chain.latestTokenId);
console.log("Steps:                 ", (chain.steps || []).length);
console.log("Total delta size:      ", fmtBytes(summary.totalDeltaSizeBytes));
console.log("Estimated full copy:   ", fmtBytes(summary.estimatedFullCopyBytes));
console.log("Estimated reduction:   ", `${summary.estimatedReductionPercent ?? "?"}%`);
console.log("");

// ── Compute folder root hash ──────────────────────────────────────────────────

const computedHash = computeFolderRootHash(restoredChainFolderPath);
const expectedHash = proof.latestFolderRootHash || chain.latestFolderRootHash || "";
const match        = computedHash === expectedHash;

console.log("Expected root hash:    ", expectedHash);
console.log("Computed root hash:    ", computedHash);
console.log("Root hash match:       ", match ? "YES" : "NO");
console.log("Verify:                ", match ? "PASS" : "FAIL");
console.log("");

if (!match) {
  console.error("Chain verify failed: root hash mismatch.");
  process.exit(1);
}
