import fs from "fs";
import path from "path";
import { decodeVscToken } from "./decodeText.js";
import { verifyDecodedMessage } from "./verify.js";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Missing token file path.");
  console.error("Usage:");
  console.error("npm run tamper output\\vsc-451F0BC7217E-text.json");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`Token file not found: ${filePath}`);
  process.exit(1);
}

const token = JSON.parse(fs.readFileSync(filePath, "utf8"));

const originalDecoded = decodeVscToken(token);
const originalValid = verifyDecodedMessage(originalDecoded, token);

// Deep copy
const tampered = JSON.parse(JSON.stringify(token));

// Tamper strategy:
// Move one stored delta bit to another bit position.
// This changes the reconstructed payload but keeps the old hash.
// Therefore verification must fail.
if (!Array.isArray(tampered.delta) || tampered.delta.length === 0) {
  console.error("Token has no delta entries to tamper with.");
  process.exit(1);
}

tampered.delta[0].bitIndex = (tampered.delta[0].bitIndex + 1) % 8;
tampered.id = `${tampered.id}-TAMPERED`;
tampered.tampered = true;
tampered.tamperNote =
  "One delta bit position was intentionally modified for verification testing.";

const parsed = path.parse(filePath);
const tamperedFile = path.join(
  parsed.dir,
  `${parsed.name}-tampered${parsed.ext}`
);

fs.writeFileSync(tamperedFile, JSON.stringify(tampered, null, 2), "utf8");

const tamperedDecoded = decodeVscToken(tampered);
const tamperedValid = verifyDecodedMessage(tamperedDecoded, tampered);

console.log("");
console.log("VSC TAMPER TEST");
console.log("---------------");
console.log("Original file:   ", path.normalize(filePath));
console.log("Tampered file:   ", path.normalize(tamperedFile));
console.log("");
console.log("Original decoded:", originalDecoded);
console.log("Original verify: ", originalValid ? "PASS" : "FAIL");
console.log("");
console.log("Tampered decoded:", tamperedDecoded);
console.log("Tampered verify: ", tamperedValid ? "PASS" : "FAIL");
console.log("");

if (originalValid && !tamperedValid) {
  console.log("RESULT: SUCCESS — manipulation detected.");
  process.exit(0);
}

console.log("RESULT: WARNING — tamper test did not behave as expected.");
process.exit(1);