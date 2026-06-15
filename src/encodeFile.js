import fs from "fs";
import path from "path";
import crypto from "crypto";

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function encodeFileToVscToken(filePath, type = "PDF") {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const fileSize = buffer.length;
  const payloadHash = sha256(buffer);
  const tokenId = payloadHash.slice(0, 12).toUpperCase();

  const chunkSize = 4096;
  const chunkCount = Math.ceil(fileSize / chunkSize);
  const chunks = [];
  const delta = [];

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, fileSize);
    const chunk = buffer.subarray(start, end);
    const chunkHash = sha256(chunk);

    chunks.push({
      chunkIndex,
      offset: start,
      size: chunk.length,
      hash: chunkHash
    });

    // Sparse visual proof: only selected non-zero hash nibbles.
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

  return {
    protocol: "VSC",
    version: "1.1",
    id: tokenId,
    type: type.toUpperCase(),
    baseline: "0",
    encoding: "BINARY",
    file: {
      name: fileName,
      path: filePath,
      sizeBytes: fileSize,
      chunkSize,
      chunkCount
    },
    messageLength: fileSize,
    readRule: {
      layout: "radial_sparse_file_proof",
      startAngleDegrees: 0,
      direction: "clockwise",
      angleRule: "golden_angle",
      stored: "delta_only",
      mode: "proof_only"
    },
    delta,
    chunks,
    proof: {
      hashAlgorithm: "SHA-256",
      payloadHash
    }
  };
}