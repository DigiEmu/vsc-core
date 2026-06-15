import fs from "fs";
import path from "path";
import { saveGalleryPage } from "./renderGallery.js";

const outputDir    = path.resolve("output");
const manifestPath = path.join(outputDir, "manifest.json");

console.log("");
console.log("VSC MANIFEST CLEANUP");
console.log("--------------------");

if (!fs.existsSync(manifestPath)) {
  console.log("No manifest.json found. Nothing to clean.");
  process.exit(0);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch {
  console.error("Failed to parse manifest.json.");
  process.exit(1);
}

if (!Array.isArray(manifest)) {
  console.error("manifest.json is not an array.");
  process.exit(1);
}

const before = manifest.length;

// ── Backup ────────────────────────────────────────────────────────────────────
const ts = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const backupPath = path.join(outputDir, `manifest.backup-${ts}.json`);
fs.writeFileSync(backupPath, JSON.stringify(manifest, null, 2), "utf8");
console.log(`Backup written: ${backupPath}`);

// ── Step 1: remove entries whose JSON file is missing ────────────────────────
let staleRemoved = 0;
manifest = manifest.filter(entry => {
  if (!entry.json) return true;
  const p = path.join(outputDir, entry.json);
  if (!fs.existsSync(p)) {
    console.log(`  REMOVE (missing JSON): ${entry.mode || entry.type} ${entry.id} → ${entry.json}`);
    staleRemoved++;
    return false;
  }
  return true;
});

// ── Step 2: for entries with svg field, clear svg if the file is missing ─────
let svgCleared = 0;
manifest = manifest.map(entry => {
  if (entry.svg) {
    const p = path.join(outputDir, entry.svg);
    if (!fs.existsSync(p)) {
      console.log(`  CLEAR svg (file missing): ${entry.mode || entry.type} ${entry.id} → ${entry.svg}`);
      svgCleared++;
      return { ...entry, svg: "" };
    }
  }
  return entry;
});

// ── Step 3: deduplicate by JSON filename — keep newest createdAt ──────────────
let dupRemoved = 0;
{
  const byJson = new Map();
  for (const entry of manifest) {
    const key = entry.json || `${entry.id}-${entry.mode}`;
    if (!byJson.has(key)) {
      byJson.set(key, entry);
    } else {
      const existing  = byJson.get(key);
      const tNew      = entry.createdAt    ? new Date(entry.createdAt).getTime()    : 0;
      const tExisting = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
      if (tNew > tExisting) {
        console.log(`  DEDUP (same JSON, older): ${existing.mode || existing.type} ${existing.id}`);
        byJson.set(key, entry);
      } else {
        console.log(`  DEDUP (same JSON, older): ${entry.mode || entry.type} ${entry.id}`);
      }
      dupRemoved++;
    }
  }
  manifest = [...byJson.values()];
}

// ── Step 4: deduplicate VSC_CHAIN entries with same base+latest ───────────────
// Keep the one with a valid SVG; if both have/lack SVG, keep newest createdAt
{
  const chainKey = entry =>
    (entry.mode === "DELTA_CHAIN" || entry.type === "VSC_CHAIN")
      ? `chain::${entry.baseline || entry.id}`
      : null;

  const chainMap = new Map();
  const nonChain = [];

  for (const entry of manifest) {
    const k = chainKey(entry);
    if (!k) { nonChain.push(entry); continue; }

    if (!chainMap.has(k)) {
      chainMap.set(k, entry);
    } else {
      const existing = chainMap.get(k);
      const hasSvgNew      = !!(entry.svg    && fs.existsSync(path.join(outputDir, entry.svg)));
      const hasSvgExisting = !!(existing.svg && fs.existsSync(path.join(outputDir, existing.svg)));

      const tNew      = entry.createdAt    ? new Date(entry.createdAt).getTime()    : 0;
      const tExisting = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;

      const prefer = hasSvgNew && !hasSvgExisting
        ? entry
        : hasSvgExisting && !hasSvgNew
        ? existing
        : tNew >= tExisting ? entry : existing;

      const drop = prefer === entry ? existing : entry;
      console.log(`  DEDUP (chain, no SVG or older): ${drop.mode || drop.type} ${drop.id}`);
      dupRemoved++;
      chainMap.set(k, prefer);
    }
  }

  manifest = [...chainMap.values(), ...nonChain];
}

// ── Step 5: sort — Chain first, then Delta, then Folder, then rest ────────────
function sortWeight(entry) {
  const mode = (entry.mode || entry.type || "").toUpperCase();
  if (mode === "DELTA_CHAIN")     return 0;
  if (mode === "FOLDER_DELTA")    return 1;
  if (mode === "FOLDER_RECOVERY") return 2;
  if (mode === "RECOVERY")        return 3;
  return 4;
}

manifest.sort((a, b) => {
  const wDiff = sortWeight(a) - sortWeight(b);
  if (wDiff !== 0) return wDiff;
  const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return tB - tA; // newest first within group
});

// ── Write cleaned manifest ────────────────────────────────────────────────────
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

// ── Regenerate gallery ────────────────────────────────────────────────────────
try {
  saveGalleryPage(manifest, path.join(outputDir, "gallery.html"));
  console.log("Gallery regenerated: output/gallery.html");
} catch (err) {
  console.error("Gallery regeneration failed:", err.message);
}

const after = manifest.length;

console.log("");
console.log("CLEANUP SUMMARY");
console.log("---------------");
console.log(`Entries before:          ${before}`);
console.log(`Entries after:           ${after}`);
console.log(`Removed stale entries:   ${staleRemoved}`);
console.log(`SVG refs cleared:        ${svgCleared}`);
console.log(`Removed duplicate entries: ${dupRemoved}`);
console.log("");
