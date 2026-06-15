import crypto from "crypto";

export function verifyDecodedMessage(message, token) {
  const hash = crypto
    .createHash("sha256")
    .update(message, "utf8")
    .digest("hex");

  return hash === token.proof.payloadHash;
}