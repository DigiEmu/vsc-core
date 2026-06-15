import fs from "fs";
import path from "path";
import crypto from "crypto";
import { saveSvg } from "./renderSvg.js";
import { saveGalleryPage } from "./renderGallery.js";

const filePath = process.argv[2];
const inputType = process.argv[3] || "PDF";

if (!filePath) {
  console.error("Missing file path.");
  console.error("Usage:");
  console.error('npm run encode-recovery ".\\file.pdf" PDF');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

const outputDir = "output";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const buffer = fs.readFileSync(filePath);
const fileName = path.basename(filePath);
const fileSize = buffer.length;
const payloadHash = sha256(buffer);
const tokenId = payloadHash.slice(0, 12).toUpperCase();

const safeType = inputType.toLowerCase();
const recoveryDir = path.join(outputDir, `recovery-${tokenId}`);
const chunksDir = path.join(recoveryDir, "chunks");

if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

const CHUNK_SIZE = 4096;
const chunkCount = Math.ceil(fileSize / CHUNK_SIZE);
const chunks = [];
const delta = [];

for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
  const start = chunkIndex * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, fileSize);
  const chunk = buffer.subarray(start, end);
  const chunkHash = sha256(chunk);

  const paddedIndex = String(chunkIndex).padStart(6, "0");
  const chunkFileName = `chunk-${paddedIndex}.bin`;
  const chunkFilePath = path.join(chunksDir, chunkFileName);

  fs.writeFileSync(chunkFilePath, chunk);

  const relPath = path.join("chunks", chunkFileName).replaceAll("\\", "/");

  chunks.push({
    chunkIndex,
    offset: start,
    size: chunk.length,
    hash: chunkHash,
    file: relPath
  });

  for (let nibbleIndex = 0; nibbleIndex < chunkHash.length; nibbleIndex++) {
    const value = parseInt(chunkHash[nibbleIndex], 16);

    if (value !== 0 && nibbleIndex % 5 === 0) {
      delta.push({
        chunkIndex,
        nibbleIndex,
        value,
        offset: start
      });
    }
  }
}

const token = {
  protocol: "VSC",
  version: "1.2",
  mode: "RECOVERY",
  id: tokenId,
  type: inputType.toUpperCase(),
  baseline: "0",
  encoding: "BINARY",
  file: {
    name: fileName,
    path: filePath,
    sizeBytes: fileSize,
    chunkSize: CHUNK_SIZE,
    chunkCount
  },
  messageLength: fileSize,
  chunks,
  delta,
  proof: {
    hashAlgorithm: "SHA-256",
    payloadHash
  },
  recovery: {
    directory: `recovery-${tokenId}`,
    chunksDirectory: `recovery-${tokenId}/chunks`,
    chunkCount,
    chunkSize: CHUNK_SIZE
  }
};

const baseName = `vsc-${tokenId}-${safeType}-recovery`;
const jsonFile = `${baseName}.json`;
const svgFile = `${baseName}.svg`;
const jsonPath = path.join(outputDir, jsonFile);
const svgPath = path.join(outputDir, svgFile);

fs.writeFileSync(jsonPath, JSON.stringify(token, null, 2), "utf8");
saveSvg(token, svgPath);

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
  messageLength: token.file.sizeBytes,
  deltaCount: token.delta.length,
  hashAlgorithm: token.proof.hashAlgorithm,
  payloadHash: token.proof.payloadHash,
  json: jsonFile,
  svg: svgFile,
  fileName: token.file.name,
  fileSizeBytes: token.file.sizeBytes,
  chunkCount: token.file.chunkCount,
  recoveryDir: token.recovery.directory,
  createdAt: new Date().toISOString()
};

const existingIndex = manifest.findIndex(
  (item) => item.id === token.id && item.type === token.type && item.mode === "RECOVERY"
);

if (existingIndex >= 0) {
  manifest[existingIndex] = entry;
} else {
  manifest.push(entry);
}

manifest.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
saveGalleryPage(manifest, path.join(outputDir, "gallery.html"));

console.log("");
console.log("VSC RECOVERY TOKEN ENCODE");
console.log("-------------------------");
console.log("File:         ", fileName);
console.log("Size bytes:   ", fileSize);
console.log("Chunks:       ", chunkCount);
console.log("Token ID:     ", tokenId);
console.log("Hash:         ", payloadHash);
console.log("Token Path:   ", jsonPath);
console.log("Recovery Dir: ", recoveryDir);
console.log("");
console.log("Files created:");
console.log(`- ${jsonPath}`);
console.log(`- ${svgPath}`);
console.log(`- ${recoveryDir} (${chunkCount} chunks)`);
console.log("- output/manifest.json");
console.log("- output/gallery.html");
console.log("");
