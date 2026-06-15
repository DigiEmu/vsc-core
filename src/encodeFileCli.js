import fs from "fs";
import path from "path";
import { saveSvg } from "./renderSvg.js";
import { saveGalleryPage } from "./renderGallery.js";
import { encodeFileToVscToken } from "./encodeFile.js";

const filePath = process.argv[2];
const inputType = process.argv[3] || "PDF";

if (!filePath) {
  console.error("Missing file path.");
  console.error("Usage:");
  console.error('npm run encode-file "C:\\path\\to\\file.pdf" PDF');
  process.exit(1);
}

const outputDir = "output";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

const token = encodeFileToVscToken(filePath, inputType);

const safeType = token.type.toLowerCase();
const baseName = `vsc-${token.id}-${safeType}`;

const jsonFile = `${baseName}.json`;
const svgFile = `${baseName}.svg`;

const jsonPath = path.join(outputDir, jsonFile);
const svgPath = path.join(outputDir, svgFile);

fs.writeFileSync(jsonPath, JSON.stringify(token, null, 2), "utf8");
saveSvg(token, svgPath);

// Latest aliases
fs.writeFileSync(path.join(outputDir, "vsc-token.json"), JSON.stringify(token, null, 2), "utf8");
saveSvg(token, path.join(outputDir, "vsc-token.svg"));

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
  createdAt: new Date().toISOString()
};

const existingIndex = manifest.findIndex(
  (item) => item.id === token.id && item.type === token.type
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
console.log("VSC FILE TOKEN ENCODE");
console.log("---------------------");
console.log("File:        ", token.file.name);
console.log("Type:        ", token.type);
console.log("Size bytes:  ", token.file.sizeBytes);
console.log("Chunks:      ", token.file.chunkCount);
console.log("Delta count: ", token.delta.length);
console.log("Token ID:    ", token.id);
console.log("Hash:        ", token.proof.payloadHash);
console.log("");
console.log("Files created:");
console.log(`- ${jsonPath}`);
console.log(`- ${svgPath}`);
console.log("- output/vsc-token.json");
console.log("- output/vsc-token.svg");
console.log("- output/manifest.json");
console.log("- output/gallery.html");
console.log("");