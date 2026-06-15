import fs from "fs";
import path from "path";
import { encodeTextToVscToken } from "./encodeText.js";
import { decodeVscToken } from "./decodeText.js";
import { verifyDecodedMessage } from "./verify.js";
import { saveSvg } from "./renderSvg.js";
import { saveGalleryPage } from "./renderGallery.js";

const inputMessage = process.argv[2] || "LESS DATA MORE TRUTH";
const inputType = process.argv[3] || "TEXT";

const outputDir = "output";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// 1. Encode
const token = encodeTextToVscToken(inputMessage, inputType);

// 2. Decode from token
const decoded = decodeVscToken(token);

// 3. Verify
const isValid = verifyDecodedMessage(decoded, token);

// 4. File naming
const safeType = token.type.toLowerCase();
const baseName = `vsc-${token.id}-${safeType}`;

const jsonFile = `${baseName}.json`;
const svgFile = `${baseName}.svg`;

const jsonPath = path.join(outputDir, jsonFile);
const svgPath = path.join(outputDir, svgFile);

// 5. Save token JSON
fs.writeFileSync(jsonPath, JSON.stringify(token, null, 2), "utf8");

// 6. Save SVG using polished renderer
saveSvg(token, svgPath);

// 7. Latest aliases for quick preview
fs.writeFileSync(
  path.join(outputDir, "vsc-token.json"),
  JSON.stringify(token, null, 2),
  "utf8"
);

saveSvg(token, path.join(outputDir, "vsc-token.svg"));

// 8. Manifest update
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
  messageLength: token.messageLength,
  deltaCount: token.delta.length,
  hashAlgorithm: token.proof.hashAlgorithm,
  payloadHash: token.proof.payloadHash,
  json: jsonFile,
  svg: svgFile,
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

// Newest first
manifest.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

// 9. Save gallery
saveGalleryPage(manifest, path.join(outputDir, "gallery.html"));

// 10. Console output
console.log("");
console.log("VSC TOKEN ENCODE");
console.log("----------------");
console.log("Input:       ", inputMessage.toUpperCase());
console.log("Type:        ", token.type);
console.log("Decoded:     ", decoded);
console.log("Verify:      ", isValid ? "PASS" : "FAIL");
console.log("Token ID:    ", token.id);
console.log("Delta count: ", token.delta.length);
console.log("");
console.log("Files created:");
console.log(`- ${jsonPath}`);
console.log(`- ${svgPath}`);
console.log("- output/vsc-token.json");
console.log("- output/vsc-token.svg");
console.log("- output/manifest.json");
console.log("- output/gallery.html");
console.log("");

if (!isValid) {
  process.exit(1);
}