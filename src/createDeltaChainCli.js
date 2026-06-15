import fs from "fs";
import path from "path";
import crypto from "crypto";
import { saveSvg } from "./renderSvg.js";
import { saveGalleryPage } from "./renderGallery.js";

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error("Usage:");
  console.error("  npm run create-chain <baseFolderTokenPath> <deltaTokenPath> [<deltaTokenPath2> ...]");
  process.exit(1);
}

const baseFolderTokenPath = args[0];
const deltaTokenPaths = args.slice(1);

function sha256(input) {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// ── Read & validate base token ───────────────────────────────────────────────

if (!fs.existsSync(baseFolderTokenPath)) {
  console.error(`Base folder token not found: ${baseFolderTokenPath}`);
  process.exit(1);
}

const baseToken = JSON.parse(fs.readFileSync(baseFolderTokenPath, "utf8"));

if (baseToken.mode !== "FOLDER_RECOVERY") {
  console.error(`Base token mode is "${baseToken.mode}", expected "FOLDER_RECOVERY".`);
  process.exit(1);
}

const baseFolderRootHash = String(
  baseToken.proof?.folderRootHash || baseToken.folderRootHash || baseToken.proof?.payloadHash || ""
);

// ── Read & validate delta tokens ────────────────────────────────────────────

const deltaTokens = [];
for (const p of deltaTokenPaths) {
  if (!fs.existsSync(p)) {
    console.error(`Delta token not found: ${p}`);
    process.exit(1);
  }
  const t = JSON.parse(fs.readFileSync(p, "utf8"));
  if (t.mode !== "FOLDER_DELTA") {
    console.error(`Token at ${p} has mode "${t.mode}", expected "FOLDER_DELTA".`);
    process.exit(1);
  }
  deltaTokens.push({ token: t, filePath: p });
}

// Validate chain linkage
// First delta must link from the base token
const firstFrom = deltaTokens[0].token.fromTokenId || deltaTokens[0].token.baseline || deltaTokens[0].token.baseTokenId;
if (firstFrom !== baseToken.id) {
  console.error(
    `First delta links from "${firstFrom}" but base token id is "${baseToken.id}".`
  );
  process.exit(1);
}

for (let i = 1; i < deltaTokens.length; i++) {
  const prev    = deltaTokens[i - 1].token;
  const cur     = deltaTokens[i].token;
  const curFrom = cur.fromTokenId || cur.baseline || cur.baseTokenId;
  if (curFrom !== prev.id) {
    console.error(
      `Step ${i + 1} delta links from "${curFrom}" but previous delta id is "${prev.id}".`
    );
    process.exit(1);
  }
}

// ── Build steps ──────────────────────────────────────────────────────────────

const steps = deltaTokens.map(({ token, filePath }, i) => {
  const fromId = token.fromTokenId || token.baseline || (i === 0 ? baseToken.id : deltaTokens[i - 1].token.id);
  const s      = token.summary || {};
  return {
    index:               i + 1,
    fromTokenId:         fromId,
    toTokenId:           token.id,
    deltaTokenPath:      path.relative("output", filePath).replaceAll("\\", "/"),
    operationCount:      (token.operations || []).length,
    addedCount:          s.addedCount    ?? 0,
    modifiedCount:       s.modifiedCount ?? 0,
    deletedCount:        s.deletedCount  ?? 0,
    deltaSizeBytes:      s.deltaSizeBytes  ?? 0,
    deltaChunkCount:     s.deltaChunkCount ?? 0,
    targetFolderRootHash: token.proof?.targetFolderRootHash || token.targetFolderRootHash || "",
  };
});

// ── Summary ──────────────────────────────────────────────────────────────────

const latestToken = deltaTokens[deltaTokens.length - 1].token;
const latestTokenId = latestToken.id;
const latestFolderRootHash = steps[steps.length - 1].targetFolderRootHash;

const totalDeltaSizeBytes = steps.reduce((s, st) => s + st.deltaSizeBytes, 0);
const totalDeltaChunks    = steps.reduce((s, st) => s + st.deltaChunkCount, 0);
const totalAdded          = steps.reduce((s, st) => s + st.addedCount, 0);
const totalModified       = steps.reduce((s, st) => s + st.modifiedCount, 0);
const totalDeleted        = steps.reduce((s, st) => s + st.deletedCount, 0);

const estimatedFullCopyBytes = Number(baseToken.totalSizeBytes || baseToken.messageLength || 0);
const estimatedSavedBytes    = Math.max(0, estimatedFullCopyBytes - totalDeltaSizeBytes);
const estimatedReductionPct  = estimatedFullCopyBytes > 0
  ? ((estimatedSavedBytes / estimatedFullCopyBytes) * 100).toFixed(2)
  : "0.00";

// ── Chain hash (deterministic) ───────────────────────────────────────────────
// baseTokenId + baseFolderRootHash + for each step: fromTokenId + toTokenId +
// targetFolderRootHash + deltaSizeBytes + deltaChunkCount

const chainHashInput = [
  baseToken.id,
  baseFolderRootHash,
  ...steps.flatMap(st => [
    st.fromTokenId,
    st.toTokenId,
    st.targetFolderRootHash,
    String(st.deltaSizeBytes),
    String(st.deltaChunkCount),
  ]),
].join("|");
const chainHash = sha256(chainHashInput);

// ── Build chain token ─────────────────────────────────────────────────────────

const now = new Date().toISOString();

const chainToken = {
  protocol:            "VSC",
  version:             "1.5",
  mode:                "DELTA_CHAIN",
  type:                "VSC_CHAIN",
  encoding:            "FOLDER_DELTA_CHAIN",
  id:                  chainHash.slice(0, 12).toUpperCase(),
  baseTokenId:         baseToken.id,
  baseTokenPath:       path.relative("output", baseFolderTokenPath).replaceAll("\\", "/"),
  baseFolderRootHash,
  latestTokenId,
  latestFolderRootHash,
  sourceFolderName:    baseToken.sourceFolderName || "",
  createdAt:           now,
  updatedAt:           now,
  steps,
  summary: {
    stepCount:                 steps.length,
    totalDeltaSizeBytes,
    totalDeltaChunks,
    totalAdded,
    totalModified,
    totalDeleted,
    estimatedFullCopyBytes,
    estimatedSavedBytes,
    estimatedReductionPercent: Number(estimatedReductionPct),
  },
  proof: {
    hashAlgorithm:       "SHA-256",
    chainHash,
    baseFolderRootHash,
    latestFolderRootHash,
  },
};

// ── Write chain token ─────────────────────────────────────────────────────────

const outputDir   = path.resolve("output");
const chainFileName = `vsc-chain-${baseToken.id}-to-${latestTokenId}.json`;
const chainFilePath = path.join(outputDir, chainFileName);

fs.writeFileSync(chainFilePath, JSON.stringify(chainToken, null, 2), "utf8");

const chainSvgFileName = `vsc-chain-${baseToken.id}-to-${latestTokenId}.svg`;
const chainSvgPath = path.join(outputDir, chainSvgFileName);
try {
  saveSvg(chainToken, chainSvgPath);
} catch {
  // SVG is best-effort
}

// ── Update manifest ───────────────────────────────────────────────────────────

const manifestPath = path.join(outputDir, "manifest.json");
let manifest = [];
if (fs.existsSync(manifestPath)) {
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { manifest = []; }
}

const existingIdx = manifest.findIndex(
  e => e.mode === "DELTA_CHAIN" && e.id === chainToken.id
);
const manifestEntry = {
  id:              chainToken.id,
  protocol:        "VSC",
  version:         "1.5",
  mode:            "DELTA_CHAIN",
  type:            "VSC_CHAIN",
  encoding:        "FOLDER_DELTA_CHAIN",
  baseline:        baseToken.id,
  messageLength:   totalDeltaSizeBytes,
  deltaCount:      steps.length,
  hashAlgorithm:   "SHA-256",
  payloadHash:     chainHash,
  json:            chainFileName,
  svg:             chainSvgFileName,
  fileName:        baseToken.sourceFolderName || "",
  fileSizeBytes:   totalDeltaSizeBytes,
  chunkCount:      totalDeltaChunks,
  createdAt:       now,
};

if (existingIdx >= 0) {
  manifest[existingIdx] = manifestEntry;
} else {
  manifest.unshift(manifestEntry);
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

try {
  saveGalleryPage(manifest, path.join(outputDir, "gallery.html"));
} catch {
  // Gallery is best-effort
}

// ── Print summary ─────────────────────────────────────────────────────────────

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

console.log("");
console.log("VSC DELTA CHAIN CREATED");
console.log("-----------------------");
console.log("Base token ID:          ", baseToken.id);
console.log("Latest token ID:        ", latestTokenId);
console.log("Steps:                  ", steps.length);
console.log("Total delta size:       ", fmtBytes(totalDeltaSizeBytes));
console.log("Estimated full copy:    ", fmtBytes(estimatedFullCopyBytes));
console.log("Estimated reduction:    ", `${estimatedReductionPct}%`);
console.log("Chain hash:             ", chainHash.slice(0, 24));
console.log("Token path:             ", chainFilePath);
console.log("");

steps.forEach(st => {
  console.log(`  Step ${st.index}: ${st.fromTokenId} → ${st.toTokenId}  (+${st.addedCount} ~${st.modifiedCount} -${st.deletedCount})  ${fmtBytes(st.deltaSizeBytes)}`);
});

console.log("");
