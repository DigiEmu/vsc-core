import fs from "fs";
import path from "path";
import crypto from "crypto";

const outputDir = path.resolve("output");
const manifestPath = path.join(outputDir, "manifest.json");

function decodeTextToken(token) {
  const matrix = Array.from({ length: token.messageLength }, () =>
    Array(8).fill("0")
  );

  for (const bit of token.delta) {
    if (
      typeof bit.charIndex !== "number" ||
      typeof bit.bitIndex !== "number"
    ) {
      throw new Error("not a text delta");
    }

    matrix[bit.charIndex][bit.bitIndex] = "1";
  }

  return matrix
    .map((bits) => String.fromCharCode(parseInt(bits.join(""), 2)))
    .join("");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

console.log("");
console.log("VSC VERIFY ALL");
console.log("--------------");

if (!fs.existsSync(manifestPath)) {
  console.error("No manifest found.");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

let passCount = 0;
let failCount = 0;
let proofOnlyCount = 0;

for (const entry of manifest) {
  const jsonPath = path.join(outputDir, entry.json);

  if (!fs.existsSync(jsonPath)) {
    console.log(`${entry.type.padEnd(8)} ${entry.id}  FAIL  missing token file`);
    failCount++;
    continue;
  }

  try {
    const token = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    const isBinary =
      token.encoding === "BINARY" ||
      token.encoding === "BINARY_FOLDER" ||
      token.encoding === "FOLDER_DELTA_CHAIN" ||
      token.type === "PDF" ||
      token.type === "FOLDER" ||
      token.type === "VSC_CHAIN" ||
      token.file ||
      token.mode === "RECOVERY" ||
      token.mode === "FOLDER_RECOVERY" ||
      token.mode === "FOLDER_DELTA" ||
      token.mode === "DELTA_CHAIN";

    if (isBinary) {
      const chunkCount = token.file?.chunkCount ?? token.totalChunkCount ?? token.chunks?.length ?? 0;
      const sizeBytes = token.file?.sizeBytes ?? token.totalSizeBytes ?? 0;
      const mode = token.mode || "PROOF";

      console.log(
        `${String(token.type).padEnd(8)} ${token.id}  PROOF-ONLY  mode=${mode}  chunks=${chunkCount}  bytes=${sizeBytes}`
      );

      proofOnlyCount++;
      continue;
    }

    const decoded = decodeTextToken(token);
    const actualHash = sha256(decoded);
    const expectedHash = token.proof?.payloadHash;

    if (actualHash === expectedHash) {
      console.log(
        `${String(token.type).padEnd(8)} ${token.id}  PASS  Δ=${String(
          token.delta.length
        ).padEnd(5)} "${decoded}"`
      );
      passCount++;
    } else {
      console.log(
        `${String(token.type).padEnd(8)} ${token.id}  FAIL  hash mismatch`
      );
      failCount++;
    }
  } catch (error) {
    console.log(
      `${String(entry.type).padEnd(8)} ${entry.id}  FAIL  ${error.message}`
    );
    failCount++;
  }
}

console.log("--------------");
console.log(`PASS: ${passCount}`);
console.log(`PROOF-ONLY: ${proofOnlyCount}`);
console.log(`FAIL: ${failCount}`);
console.log("");