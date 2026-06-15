import fs from "fs";
import path from "path";
import { decodeVscToken } from "./decodeText.js";
import { verifyDecodedMessage } from "./verify.js";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Missing token file path.");
  console.error("Usage:");
  console.error("npm run decode output\\vsc-token.json");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`Token file not found: ${filePath}`);
  process.exit(1);
}

let token;

try {
  const raw = fs.readFileSync(filePath, "utf8");
  token = JSON.parse(raw);
} catch (error) {
  console.error("Could not read or parse token JSON.");
  console.error(error.message);
  process.exit(1);
}

function validateTokenShape(token) {
  const requiredFields = [
    "protocol",
    "version",
    "id",
    "type",
    "baseline",
    "encoding",
    "messageLength",
    "delta",
    "proof"
  ];

  for (const field of requiredFields) {
    if (!(field in token)) {
      throw new Error(`Invalid VSC token: missing field "${field}"`);
    }
  }

  if (!Array.isArray(token.delta)) {
    throw new Error("Invalid VSC token: delta must be an array");
  }

  if (!token.proof.payloadHash) {
    throw new Error("Invalid VSC token: missing proof.payloadHash");
  }
}

try {
  validateTokenShape(token);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

console.log("");
console.log("VSC TOKEN DECODE");
console.log("---------------");
console.log("File:      ", path.normalize(filePath));
console.log("Protocol:  ", token.protocol);
console.log("Version:   ", token.version);
console.log("Token ID:  ", token.id);
console.log("Type:      ", token.type);
console.log("Encoding:  ", token.encoding);
console.log("Baseline:  ", token.baseline);
console.log("Length:    ", token.messageLength);
console.log("Delta:     ", token.delta.length);

if (token.type === "PDF" || token.encoding === "BINARY" || token.file) {
  console.log("");
  console.log("Mode:       PROOF ONLY");
  console.log("Decoded:    [not applicable for binary file tokens]");
  console.log("Verify:     use verify-file with the original file");
  console.log("");

  if (token.file) {
    console.log("File proof:");
    console.log("Name:       ", token.file.name);
    console.log("Size bytes: ", token.file.sizeBytes);
    console.log("Chunk size: ", token.file.chunkSize);
    console.log("Chunks:     ", token.file.chunkCount);
    console.log("Hash:       ", token.proof.payloadHash);
    console.log("");
  }

  process.exit(0);
}

const decoded = decodeVscToken(token);
const isValid = verifyDecodedMessage(decoded, token);

console.log("Decoded:   ", decoded);
console.log("Verify:    ", isValid ? "PASS" : "FAIL");
console.log("");

if (!isValid) {
  process.exit(1);
}