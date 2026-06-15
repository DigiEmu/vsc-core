import crypto from "crypto";

export function encodeTextToVscToken(message, type = "TEXT") {
  const normalized = message.toUpperCase();
  const delta = [];

  for (let charIndex = 0; charIndex < normalized.length; charIndex++) {
    const char = normalized[charIndex];
    const ascii = char.charCodeAt(0);
    const binary = ascii.toString(2).padStart(8, "0");

    for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
      if (binary[bitIndex] === "1") {
        delta.push({
          charIndex,
          bitIndex
        });
      }
    }
  }

  const payloadHash = crypto
    .createHash("sha256")
    .update(normalized, "utf8")
    .digest("hex");

  const tokenId = payloadHash.slice(0, 12).toUpperCase();

  return {
    protocol: "VSC",
    version: "0.3",
    id: tokenId,
    type: type.toUpperCase(),
    baseline: "0",
    encoding: "ASCII",
    messageLength: normalized.length,
    readRule: {
      layout: "radial_sparse_bits",
      startAngleDegrees: 0,
      direction: "clockwise",
      angleRule: "golden_angle",
      stored: "delta_only"
    },
    delta,
    proof: {
      hashAlgorithm: "SHA-256",
      payloadHash
    }
  };
}