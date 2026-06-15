import fs from "fs";
import path from "path";
import crypto from "crypto";
import { saveSvg } from "./renderSvg.js";
import { saveGalleryPage } from "./renderGallery.js";

const folderPath = process.argv[2];
const inputType = process.argv[3] || "FOLDER";

if (!folderPath) {
  console.error("Missing folder path.");
  console.error("Usage:");
  console.error('npm run encode-folder ".\\my-folder" FOLDER');
  process.exit(1);
}

const resolvedFolder = path.resolve(folderPath);

if (!fs.existsSync(resolvedFolder)) {
  console.error(`Folder not found: ${resolvedFolder}`);
  process.exit(1);
}

const stat = fs.statSync(resolvedFolder);
if (!stat.isDirectory()) {
  console.error(`Path is not a directory: ${resolvedFolder}`);
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

const outputDir = "output";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const allFiles = collectFiles(resolvedFolder, resolvedFolder);
allFiles.sort((a, b) => a.relPath.localeCompare(b.relPath));

const folderName = path.basename(resolvedFolder);

let totalSizeBytes = 0;
let totalChunkCount = 0;
const fileEntries = [];
const delta = [];

const tempChunksData = [];

for (let fileIdx = 0; fileIdx < allFiles.length; fileIdx++) {
  const { fullPath, relPath } = allFiles[fileIdx];
  const buffer = fs.readFileSync(fullPath);
  const fileSize = buffer.length;
  const fileHash = sha256(buffer);
  const fileChunkCount = Math.ceil(fileSize / CHUNK_SIZE) || 1;

  const safePath = relPath.replaceAll("/", "_").replaceAll(" ", "_");

  totalSizeBytes += fileSize;
  totalChunkCount += fileChunkCount;

  const fileChunks = [];

  for (let chunkIndex = 0; chunkIndex < fileChunkCount; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    const chunk = buffer.subarray(start, end);
    const chunkHash = sha256(chunk);

    const paddedFile = String(fileIdx).padStart(6, "0");
    const paddedChunk = String(chunkIndex).padStart(6, "0");
    const chunkFileName = `file-${paddedFile}-chunk-${paddedChunk}.bin`;
    const relChunkPath = `chunks/${chunkFileName}`;

    fileChunks.push({
      chunkIndex,
      offset: start,
      size: chunk.length,
      hash: chunkHash,
      file: relChunkPath
    });

    tempChunksData.push({ chunkFileName, chunk });

    for (let nibbleIndex = 0; nibbleIndex < chunkHash.length; nibbleIndex++) {
      const value = parseInt(chunkHash[nibbleIndex], 16);
      if (value !== 0 && nibbleIndex % 8 === 0) {
        delta.push({
          fileIndex: fileIdx,
          relPath,
          chunkIndex,
          nibbleIndex,
          value,
          offset: start
        });
      }
    }
  }

  fileEntries.push({
    fileIndex: fileIdx,
    relativePath: relPath,
    safePath,
    sizeBytes: fileSize,
    hash: fileHash,
    chunkCount: fileChunkCount,
    chunks: fileChunks
  });
}

// Folder root hash: deterministic, sorted by relativePath
const rootHashInput = fileEntries
  .map((f) => `${f.relativePath}:${f.hash}:${f.sizeBytes}\n`)
  .join("");
const folderRootHash = sha256(Buffer.from(rootHashInput, "utf8"));
const tokenId = folderRootHash.slice(0, 12).toUpperCase();

// Now we know the tokenId, create directories
const recoveryDirName = `recovery-${tokenId}`;
const recoveryDir = path.join(outputDir, recoveryDirName);
const chunksDir = path.join(recoveryDir, "chunks");

if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

// Write all chunks to disk
for (const { chunkFileName, chunk } of tempChunksData) {
  fs.writeFileSync(path.join(chunksDir, chunkFileName), chunk);
}

const deltaForToken = fileEntries.map((f) => ({
  relativePath: f.relativePath,
  sizeBytes: f.sizeBytes,
  hashPrefix: f.hash.slice(0, 12),
  chunkCount: f.chunkCount
}));

const token = {
  protocol: "VSC",
  version: "1.3",
  mode: "FOLDER_RECOVERY",
  id: tokenId,
  type: inputType.toUpperCase(),
  baseline: "0",
  encoding: "BINARY_FOLDER",
  sourceFolderName: folderName,
  sourceFolderPath: resolvedFolder,
  createdAt: new Date().toISOString(),
  fileCount: fileEntries.length,
  totalSizeBytes,
  totalChunkCount,
  messageLength: totalSizeBytes,
  files: fileEntries,
  delta: deltaForToken,
  proof: {
    hashAlgorithm: "SHA-256",
    folderRootHash,
    payloadHash: folderRootHash
  },
  recovery: {
    directory: recoveryDirName,
    chunksDirectory: `${recoveryDirName}/chunks`,
    restoreFolderName: `restored-${folderName}`,
    restoreRule: "reconstruct_relative_paths"
  }
};

const safeType = inputType.toLowerCase();
const baseName = `vsc-${tokenId}-${safeType}-recovery`;
const jsonFile = `${baseName}.json`;
const svgFile = `${baseName}.svg`;
const jsonPath = path.join(outputDir, jsonFile);
const svgPath = path.join(outputDir, svgFile);

fs.writeFileSync(jsonPath, JSON.stringify(token, null, 2), "utf8");

try {
  saveSvg(token, svgPath);
} catch {
  // SVG generation is best-effort for folder tokens
}

// Manifest update
const manifestPath = path.join(outputDir, "manifest.json");
let manifest = [];

if (fs.existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    manifest = [];
  }
}

const entry = {
  id: token.id,
  protocol: token.protocol,
  version: token.version,
  mode: token.mode,
  type: token.type,
  encoding: token.encoding,
  baseline: token.baseline,
  messageLength: token.totalSizeBytes,
  deltaCount: token.delta.length,
  hashAlgorithm: token.proof.hashAlgorithm,
  payloadHash: token.proof.folderRootHash,
  json: jsonFile,
  svg: svgFile,
  fileName: token.sourceFolderName,
  fileSizeBytes: token.totalSizeBytes,
  chunkCount: token.totalChunkCount,
  recoveryDir: token.recovery.directory,
  createdAt: token.createdAt
};

const existingIndex = manifest.findIndex(
  (item) => item.id === token.id && item.mode === "FOLDER_RECOVERY"
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
  // Gallery update is best-effort
}

console.log("");
console.log("VSC FOLDER RECOVERY TOKEN CREATED");
console.log("----------------------------------");
console.log("Source folder:   ", resolvedFolder);
console.log("File count:      ", fileEntries.length);
console.log("Total size bytes:", totalSizeBytes);
console.log("Total chunks:    ", totalChunkCount);
console.log("Token ID:        ", tokenId);
console.log("Folder root hash:", folderRootHash);
console.log("Token path:      ", jsonPath);
console.log("Recovery dir:    ", recoveryDir);
console.log("");
console.log("Files created:");
console.log(`- ${jsonPath}`);
if (fs.existsSync(svgPath)) console.log(`- ${svgPath}`);
console.log(`- ${recoveryDir} (${totalChunkCount} chunks)`);
console.log("- output/manifest.json");
console.log("- output/gallery.html");
console.log("");
