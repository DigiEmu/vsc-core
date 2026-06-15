export function decodeVscToken(token) {
  const bitMatrix = Array.from({ length: token.messageLength }, () =>
    Array(8).fill("0")
  );

  for (const item of token.delta) {
    bitMatrix[item.charIndex][item.bitIndex] = "1";
  }

  const chars = bitMatrix.map((bits) => {
    const binary = bits.join("");
    const ascii = parseInt(binary, 2);
    return String.fromCharCode(ascii);
  });

  return chars.join("");
}