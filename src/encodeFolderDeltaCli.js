import fs from "fs";
import path from "path";
import crypto from "crypto";
import { saveSvg } from "./renderSvg.js";
import { saveGalleryPage } from "./renderGallery.js";

const baseTokenPath = process.argv[2];
const currentFolderPath = process.argv[3];
const inputType = process.argv[4] || "FOLDER_DELTA";

if (!baseTokenPath || !currentFolderPath) {
  console.error("Usage:");
  console.error('npm run encode-folder-delta output\\vsc-BASE-folder-recovery.json .\\folder FOLDER_DELTA');
  process.exit(1);
}

if (!fs.existsSync(baseTokenPath)) {
  console.error(`Base token not found: ${baseTokenPath}`);
  process.exit(1);
}

const resolvedFolder = path.resolve(currentFolderPath);

if (!fs.existsSync(resolvedFolder)) {
  console.error(`Folder not found: ${resolvedFolder}`);
  process.exit(1);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

const IGNORED_DIRS = new Set(["node_modules", ".git", "output", ".svn", ".hg"]);
const CHUNK_SIZE = 4096;

function collectFiles(dir, baseDir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.isDirectory()) continue;
    if (IGNORED_DIRS.has(entry.name)) continue;
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

// Read baseline token — may be FOLDER_RECOVERY or FOLDER_DELTA
const baselineToken = JSON.parse(fs.readFileSync(baseTokenPath, "utf8"));

if (baselineToken.mode !== "FOLDER_RECOVERY" && baselineToken.mode !== "FOLDER_DELTA") {
  console.error(`Baseline token mode is "${baselineToken.mode}", expected "FOLDER_RECOVERY" or "FOLDER_DELTA".`);
  process.exit(1);
}

// fromToken is always the baseline token passed in
const fromTokenId   = baselineToken.id;
const fromTokenMode = baselineToken.mode;

// originalBaseTokenId is the root FOLDER_RECOVERY ancestor
let originalBaseTokenId  = baselineToken.mode === "FOLDER_RECOVERY"
  ? baselineToken.id
  : (baselineToken.baseTokenId || baselineToken.baseline || baselineToken.id);

// baseFolderRootHash is always the root FOLDER_RECOVERY hash
let baseFolderRootHash;
let sourceFolderName;

// Build baseline file map: relativePath -> { hash, sizeBytes }
const baseFileMap = new Map();

if (baselineToken.mode === "FOLDER_RECOVERY") {
  // Direct: use token.files
  baseFolderRootHash = baselineToken.proof.folderRootHash;
  sourceFolderName   = baselineToken.sourceFolderName;
  for (const f of baselineToken.files) {
    baseFileMap.set(f.relativePath, { hash: f.hash, sizeBytes: f.sizeBytes });
  }
} else {
  // FOLDER_DELTA baseline: reconstruct previous target file map
  // 1. Find the root FOLDER_RECOVERY token
  const outputDir = path.resolve("output");
  const manifestPath = path.join(outputDir, "manifest.json");
  let rootRecoveryToken = null;

  // Try manifest first
  if (fs.existsSync(manifestPath)) {
    const mf = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const entry = mf.find(e => e.id === originalBaseTokenId && e.mode === "FOLDER_RECOVERY");
    if (entry) {
      const rp = path.join(outputDir, entry.json);
      if (fs.existsSync(rp)) rootRecoveryToken = JSON.parse(fs.readFileSync(rp, "utf8"));
    }
  }

  // Fallback: filename pattern
  if (!rootRecoveryToken) {
    const candidate = path.join("output", `vsc-${originalBaseTokenId}-folder-recovery.json`);
    if (fs.existsSync(candidate)) {
      rootRecoveryToken = JSON.parse(fs.readFileSync(candidate, "utf8"));
    }
  }

  if (!rootRecoveryToken) {
    console.error(`Cannot find root FOLDER_RECOVERY token for id "${originalBaseTokenId}".`);
    console.error(`Ensure output/vsc-${originalBaseTokenId}-folder-recovery.json exists.`);
    process.exit(1);
  }

  baseFolderRootHash = rootRecoveryToken.proof.folderRootHash;
  sourceFolderName   = rootRecoveryToken.sourceFolderName;

  // Start from root file map
  for (const f of rootRecoveryToken.files) {
    baseFileMap.set(f.relativePath, { hash: f.hash, sizeBytes: f.sizeBytes });
  }

  // Apply the baseline delta's operations to advance to that target state
  for (const op of (baselineToken.operations || [])) {
    if (op.op === "DELETE") {
      baseFileMap.delete(op.relativePath);
    } else if (op.op === "ADD") {
      baseFileMap.set(op.relativePath, { hash: op.hash || op.newHash, sizeBytes: op.sizeBytes });
    } else if (op.op === "MODIFY") {
      baseFileMap.set(op.relativePath, { hash: op.newHash || op.hash, sizeBytes: op.sizeBytes });
    }
  }
}

const fromFolderRootHash = baselineToken.proof?.targetFolderRootHash
  || baselineToken.proof?.folderRootHash
  || "";

// Scan current folder
const allCurrentFiles = collectFiles(resolvedFolder, resolvedFolder);
allCurrentFiles.sort((a, b) => a.relPath.localeCompare(b.relPath));

// Build current file map
const currentFileMap = new Map();
for (const { fullPath, relPath } of allCurrentFiles) {
  const buffer = fs.readFileSync(fullPath);
  const hash = sha256(buffer);
  currentFileMap.set(relPath, { fullPath, buffer, hash, sizeBytes: buffer.length });
}

// Detect changes
const added = [];
const modified = [];
const deleted = [];

for (const [relPath, cur] of currentFileMap) {
  if (!baseFileMap.has(relPath)) {
    added.push(relPath);
  } else if (baseFileMap.get(relPath).hash !== cur.hash) {
    modified.push(relPath);
  }
}

for (const relPath of baseFileMap.keys()) {
  if (!currentFileMap.has(relPath)) {
    deleted.push(relPath);
  }
}

// Compute target folder root hash from current state (deterministic, same rule as encodeFolderCli)
const currentFilesForHash = [];
for (const [relPath, cur] of currentFileMap) {
  currentFilesForHash.push({ relativePath: relPath, hash: cur.hash, sizeBytes: cur.sizeBytes });
}
currentFilesForHash.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

const rootHashInput = currentFilesForHash
  .map((f) => `${f.relativePath}:${f.hash}:${f.sizeBytes}\n`)
  .join("");
const targetFolderRootHash = sha256(Buffer.from(rootHashInput, "utf8"));
const deltaTokenId = targetFolderRootHash.slice(0, 12).toUpperCase();

const outputDir = path.resolve("output");
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const deltaDirName = `delta-${fromTokenId}-to-${deltaTokenId}`;
const deltaDir = path.join(outputDir, deltaDirName);
const chunksDir = path.join(deltaDir, "chunks");
if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir, { recursive: true });

// Build operations
const operations = [];
let deltaSizeBytes = 0;
let deltaChunkCount = 0;

// Helper: chunk a buffer and save to delta chunks dir
function chunkAndSave(relPath, fileIdx, buffer) {
  const fileHash = sha256(buffer);
  const fileChunkCount = Math.ceil(buffer.length / CHUNK_SIZE) || 1;
  const chunks = [];

  for (let ci = 0; ci < fileChunkCount; ci++) {
    const start = ci * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, buffer.length);
    const chunk = buffer.subarray(start, end);
    const chunkHash = sha256(chunk);

    const pf = String(fileIdx).padStart(6, "0");
    const pc = String(ci).padStart(6, "0");
    const chunkFileName = `file-${pf}-chunk-${pc}.bin`;
    fs.writeFileSync(path.join(chunksDir, chunkFileName), chunk);

    chunks.push({
      chunkIndex: ci,
      offset: start,
      size: chunk.length,
      hash: chunkHash,
      file: `chunks/${chunkFileName}`
    });

    deltaSizeBytes += chunk.length;
    deltaChunkCount++;
  }

  return { fileHash, fileChunkCount, chunks };
}

let fileIdx = 0;

for (const relPath of added) {
  const cur = currentFileMap.get(relPath);
  const { fileChunkCount, chunks } = chunkAndSave(relPath, fileIdx++, cur.buffer);
  operations.push({
    op: "ADD",
    relativePath: relPath,
    sizeBytes: cur.sizeBytes,
    hash: cur.hash,
    chunkCount: fileChunkCount,
    chunks
  });
}

for (const relPath of modified) {
  const cur = currentFileMap.get(relPath);
  const base = baseFileMap.get(relPath);
  const { fileChunkCount, chunks } = chunkAndSave(relPath, fileIdx++, cur.buffer);
  operations.push({
    op: "MODIFY",
    relativePath: relPath,
    oldHash: base.hash,
    newHash: cur.hash,
    sizeBytes: cur.sizeBytes,
    chunkCount: fileChunkCount,
    chunks
  });
}

for (const relPath of deleted) {
  const base = baseFileMap.get(relPath);
  operations.push({
    op: "DELETE",
    relativePath: relPath,
    oldHash: base.hash,
    sizeBytes: base.sizeBytes
  });
}

// Delta payload hash: hash of all operation hashes in order
const deltaPayloadInput = operations
  .map((op) => `${op.op}:${op.relativePath}:${op.newHash || op.hash || op.oldHash}`)
  .join("\n");
const deltaPayloadHash = sha256(Buffer.from(deltaPayloadInput, "utf8"));

const token = {
  protocol: "VSC",
  version: "1.6",
  mode: "FOLDER_DELTA",
  id: deltaTokenId,
  type: inputType.toUpperCase(),
  baseline: fromTokenId,
  encoding: "BINARY_FOLDER_DELTA",
  baseTokenId: originalBaseTokenId,
  fromTokenId,
  fromTokenMode,
  fromFolderRootHash,
  baseFolderRootHash,
  targetFolderRootHash,
  sourceFolderName,
  createdAt: new Date().toISOString(),
  summary: {
    addedCount: added.length,
    modifiedCount: modified.length,
    deletedCount: deleted.length,
    changedFileCount: added.length + modified.length + deleted.length,
    deltaSizeBytes,
    deltaChunkCount
  },
  operations,
  proof: {
    hashAlgorithm: "SHA-256",
    baseFolderRootHash,
    fromFolderRootHash,
    targetFolderRootHash,
    deltaPayloadHash
  },
  recovery: {
    directory: deltaDirName,
    chunksDirectory: `${deltaDirName}/chunks`,
    restoreFolderName: `restored-${sourceFolderName}`,
    restoreRule: "apply_delta_on_base"
  }
};

const baseName = `vsc-${fromTokenId}-to-${deltaTokenId}-folder-delta`;
const jsonFile = `${baseName}.json`;
const svgFile = `${baseName}.svg`;
const jsonPath = path.join(outputDir, jsonFile);
const svgPath = path.join(outputDir, svgFile);

fs.writeFileSync(jsonPath, JSON.stringify(token, null, 2), "utf8");

try {
  saveSvg(token, svgPath);
} catch {
  // SVG is best-effort for delta tokens
}

// Manifest update
const manifestPath = path.join(outputDir, "manifest.json");
let manifest = [];
if (fs.existsSync(manifestPath)) {
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { manifest = []; }
}

const entry = {
  id: token.id,
  protocol: token.protocol,
  version: token.version,
  mode: token.mode,
  type: token.type,
  encoding: token.encoding,
  baseline: token.baseline,
  messageLength: deltaSizeBytes,
  deltaCount: operations.length,
  hashAlgorithm: token.proof.hashAlgorithm,
  payloadHash: targetFolderRootHash,
  json: jsonFile,
  svg: svgFile,
  fileName: token.sourceFolderName,
  fileSizeBytes: deltaSizeBytes,
  chunkCount: deltaChunkCount,
  recoveryDir: deltaDirName,
  createdAt: token.createdAt
};

const existingIndex = manifest.findIndex(
  (item) => item.id === token.id && item.mode === "FOLDER_DELTA"
);
if (existingIndex >= 0) {
  manifest[existingIndex] = entry;
} else {
  manifest.push(entry);
}
manifest.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

try {
  saveGalleryPage(manifest, path.join(outputDir, "gallery.html"));
} catch {
  // Gallery is best-effort
}

console.log("");
console.log("VSC FOLDER DELTA TOKEN CREATED");
console.log("------------------------------");
console.log("From token ID:          ", fromTokenId);
console.log("From token mode:        ", fromTokenMode);
console.log("Base token ID:          ", originalBaseTokenId);
console.log("Delta token ID:         ", deltaTokenId);
console.log("Added files:            ", added.length);
console.log("Modified files:         ", modified.length);
console.log("Deleted files:          ", deleted.length);
console.log("Delta size bytes:       ", deltaSizeBytes);
console.log("Delta chunks:           ", deltaChunkCount);
console.log("Target folder root hash:", targetFolderRootHash);
console.log("Token path:             ", jsonPath);
console.log("Delta dir:              ", deltaDir);
console.log("");
if (added.length) console.log("Added:   ", added.join(", "));
if (modified.length) console.log("Modified:", modified.join(", "));
if (deleted.length) console.log("Deleted: ", deleted.join(", "));
console.log("");
