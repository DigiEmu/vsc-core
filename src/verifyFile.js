import fs from "fs";
import crypto from "crypto";

const tokenPath = process.argv[2];
const filePath = process.argv[3];

if (!tokenPath || !filePath) {
  console.error("Usage:");
  console.error('npm run verify-file output\\vsc-XXXXX-pdf.json "C:\\path\\to\\file.pdf"');
  process.exit(1);
}

if (!fs.existsSync(tokenPath)) {
  console.error(`Token not found: ${tokenPath}`);
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
const buffer = fs.readFileSync(filePath);

const hash = crypto.createHash("sha256").update(buffer).digest("hex");
const isValid = hash === token.proof.payloadHash;

console.log("");
console.log("VSC FILE VERIFY");
console.log("---------------");
console.log("Token: ", tokenPath);
console.log("File:  ", filePath);
console.log("Type:  ", token.type);
console.log("ID:    ", token.id);
console.log("Hash:  ", hash);
console.log("Verify:", isValid ? "PASS" : "FAIL");
console.log("");

if (!isValid) {
  process.exit(1);
}