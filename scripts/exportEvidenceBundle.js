#!/usr/bin/env node
/**
 * exportEvidenceBundle.js — VSC v1.14 Evidence Bundle Export
 *
 * Usage:  npm run vsc -- bundle <chain-token.json>
 *    or:  npm run bundle -- <chain-token.json>
 *    or:  node scripts/exportEvidenceBundle.js <chain-token.json>
 *
 * Exports a complete, portable evidence package for a VSC delta chain.
 * Bundle includes: chain token, base token, delta tokens, reports, seals,
 * verification summary, manifest, and checksums.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "output");
const BUNDLES_DIR = path.join(OUTPUT_DIR, "bundles");

const BUNDLE_VERSION = "1.0";
const VSC_VERSION = "v1.14";

// ── Helpers ────────────────────────────────────────────────────────────────────

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

function sha256String(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function copyFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function findFileByPattern(dir, pattern) {
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (pattern(entry)) {
        return path.join(dir, entry);
      }
    }
  } catch {}
  return null;
}

function findTokenById(tokenId) {
  // Look for token JSON files in output/
  const pattern = (name) => name.includes(tokenId) && name.endsWith(".json");
  return findFileByPattern(OUTPUT_DIR, pattern);
}

function findReportByChain(baseId, latestId) {
  const reportName = `report-chain-${baseId}-to-${latestId}.md`;
  const reportPath = path.join(OUTPUT_DIR, reportName);
  if (fs.existsSync(reportPath)) {
    return reportPath;
  }
  return null;
}

function findSvgByTokenId(tokenId, hint = "") {
  // Try exact matches first
  const patterns = [
    (n) => n.includes(tokenId) && n.endsWith(".svg") && !n.includes("pdf"),
    (n) => n.includes(tokenId.slice(0, 8)) && n.endsWith(".svg") && !n.includes("pdf")
  ];
  
  for (const pattern of patterns) {
    const result = findFileByPattern(OUTPUT_DIR, pattern);
    if (result) return result;
  }
  return null;
}

// ── Main Export Function ───────────────────────────────────────────────────────

function exportEvidenceBundle(chainTokenPath) {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   VSC v1.14 — Evidence Bundle Export                       ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  // Validate input
  if (!chainTokenPath) {
    console.error("\n✗ Error: No chain token path provided.");
    console.error("Usage: npm run vsc -- bundle <chain-token.json>");
    process.exit(1);
  }
  
  const resolvedChainPath = path.resolve(chainTokenPath);
  if (!fs.existsSync(resolvedChainPath)) {
    console.error(`\n✗ Error: Chain token not found: ${chainTokenPath}`);
    process.exit(1);
  }
  
  console.log(`\nInput chain token: ${chainTokenPath}`);
  
  // Read chain token
  const chainToken = readJson(resolvedChainPath);
  if (!chainToken) {
    console.error(`\n✗ Error: Failed to parse chain token: ${chainTokenPath}`);
    process.exit(1);
  }
  
  // Validate it's a chain token
  if (chainToken.mode !== "DELTA_CHAIN" && !chainToken.steps) {
    console.error("\n✗ Error: Input file is not a valid chain token.");
    console.error("Expected mode: DELTA_CHAIN or steps array.");
    process.exit(1);
  }
  
  // Extract chain info
  const baseTokenId = chainToken.baseTokenId || chainToken.base?.id;
  const latestTokenId = chainToken.latestTokenId || chainToken.latest?.id;
  const chainHash = chainToken.proof?.chainHash || chainToken.chainHash || "";
  const chainHashPrefix = chainHash.slice(0, 24);
  
  if (!baseTokenId || !latestTokenId) {
    console.error("\n✗ Error: Could not extract base/latest token IDs from chain token.");
    process.exit(1);
  }
  
  console.log(`Base token ID:     ${baseTokenId}`);
  console.log(`Latest token ID:   ${latestTokenId}`);
  console.log(`Chain hash prefix: ${chainHashPrefix}`);
  
  // Create bundle directory
  const bundleName = `vsc-bundle-${baseTokenId}-to-${latestTokenId}`;
  const bundleDir = path.join(BUNDLES_DIR, bundleName);
  
  if (fs.existsSync(bundleDir)) {
    console.log(`\nRemoving existing bundle: ${bundleDir}`);
    fs.rmSync(bundleDir, { recursive: true, force: true });
  }
  
  fs.mkdirSync(bundleDir, { recursive: true });
  console.log(`\nBundle directory:  ${bundleDir}`);
  
  // Track included files and warnings
  const includedFiles = [];
  const warnings = [];
  
  // ── Copy Chain Token ───────────────────────────────────────────────────────
  console.log("\n[01] Copying chain token...");
  const chainDest = path.join(bundleDir, "chain-token.json");
  copyFile(resolvedChainPath, chainDest);
  includedFiles.push({ src: resolvedChainPath, dest: "chain-token.json", type: "chain" });
  console.log(`     ✓ chain-token.json`);
  
  // ── Find and Copy Base Token ─────────────────────────────────────────────────
  console.log("\n[02] Locating base token...");
  const baseTokenPath = findTokenById(baseTokenId);
  if (!baseTokenPath) {
    warnings.push(`Base token not found: ${baseTokenId}`);
    console.log(`     ⚠ Base token not found in output/`);
  } else {
    const baseDest = path.join(bundleDir, "base-token.json");
    copyFile(baseTokenPath, baseDest);
    includedFiles.push({ src: baseTokenPath, dest: "base-token.json", type: "base", id: baseTokenId });
    console.log(`     ✓ base-token.json (${baseTokenId})`);
  }
  
  // ── Find and Copy Delta Tokens ───────────────────────────────────────────────
  console.log("\n[03] Locating delta tokens...");
  const deltaTokens = [];
  const steps = chainToken.steps || [];
  
  if (steps.length === 0) {
    warnings.push("No delta steps found in chain token");
    console.log("     ⚠ No delta steps in chain");
  } else {
    fs.mkdirSync(path.join(bundleDir, "delta-tokens"), { recursive: true });
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const deltaId = step.deltaTokenId || step.id;
      
      if (!deltaId) {
        warnings.push(`Step ${i + 1} missing delta token ID`);
        console.log(`     ⚠ Step ${i + 1}: missing delta token ID`);
        continue;
      }
      
      const deltaPath = findTokenById(deltaId);
      if (!deltaPath) {
        warnings.push(`Delta token not found: ${deltaId}`);
        console.log(`     ⚠ Delta ${i + 1}: ${deltaId} not found`);
        continue;
      }
      
      const deltaDest = path.join(bundleDir, "delta-tokens", `delta-${i + 1}.json`);
      copyFile(deltaPath, deltaDest);
      deltaTokens.push({
        index: i + 1,
        id: deltaId,
        src: deltaPath,
        dest: `delta-tokens/delta-${i + 1}.json`
      });
      console.log(`     ✓ Delta ${i + 1}: ${deltaId}`);
    }
  }
  
  console.log(`     Total deltas: ${deltaTokens.length}`);
  
  // ── Find and Copy Report ─────────────────────────────────────────────────────
  console.log("\n[04] Locating chain report...");
  const reportPath = findReportByChain(baseTokenId, latestTokenId);
  if (!reportPath) {
    warnings.push("Chain report not found");
    console.log("     ⚠ Chain report not found");
  } else {
    fs.mkdirSync(path.join(bundleDir, "reports"), { recursive: true });
    const reportDest = path.join(bundleDir, "reports", "chain-report.md");
    copyFile(reportPath, reportDest);
    includedFiles.push({ src: reportPath, dest: "reports/chain-report.md", type: "report" });
    console.log(`     ✓ reports/chain-report.md`);
  }
  
  // ── Find and Copy Seals ──────────────────────────────────────────────────────
  console.log("\n[05] Locating SVG seals...");
  fs.mkdirSync(path.join(bundleDir, "seals"), { recursive: true });
  
  const sealMappings = [
    { id: baseTokenId, name: "base.svg", type: "base" },
    { id: latestTokenId, name: "chain.svg", type: "chain" }
  ];
  
  // Add delta seals for first two deltas (common case)
  if (deltaTokens.length > 0) {
    sealMappings.push({ id: deltaTokens[0].id, name: "delta-1.svg", type: "delta" });
  }
  if (deltaTokens.length > 1) {
    sealMappings.push({ id: deltaTokens[1].id, name: "delta-2.svg", type: "delta" });
  }
  
  const sealsFound = [];
  for (const mapping of sealMappings) {
    const svgPath = findSvgByTokenId(mapping.id);
    if (svgPath) {
      const sealDest = path.join(bundleDir, "seals", mapping.name);
      copyFile(svgPath, sealDest);
      sealsFound.push({ name: mapping.name, id: mapping.id });
      console.log(`     ✓ seals/${mapping.name} (${mapping.id})`);
    } else {
      warnings.push(`Seal not found: ${mapping.name} (${mapping.id})`);
      console.log(`     ⚠ seals/${mapping.name}: not found`);
    }
  }
  
  // ── Create Verification Summary ──────────────────────────────────────────────
  console.log("\n[06] Creating verification summary...");
  
  const verificationSummary = {
    bundle_version: BUNDLE_VERSION,
    created_at: new Date().toISOString(),
    vsc_version: VSC_VERSION,
    chain_token_id: chainToken.id || path.basename(resolvedChainPath, ".json"),
    base_token_id: baseTokenId,
    latest_token_id: latestTokenId,
    delta_count: deltaTokens.length,
    chain_hash_prefix: chainHashPrefix,
    expected_root_hash: chainToken.proof?.chainHash || chainToken.latest?.contentHash || "",
    verification_status: "exported",
    restore_supported: true,
    verify_command: `npm run vsc -- verify ${path.basename(resolvedChainPath)} <restored-folder>`,
    source_chain_token_path: chainTokenPath,
    notes: [
      "This bundle contains exported VSC proof artifacts.",
      "Verification requires restoring the chain and comparing root hashes.",
      "See README.md for manual verification instructions.",
      "Research prototype — not enterprise production software."
    ]
  };
  
  fs.writeFileSync(
    path.join(bundleDir, "verification-summary.json"),
    JSON.stringify(verificationSummary, null, 2),
    "utf8"
  );
  includedFiles.push({ dest: "verification-summary.json", type: "meta" });
  console.log("     ✓ verification-summary.json");
  
  // ── Create Manifest ──────────────────────────────────────────────────────────
  console.log("\n[07] Creating manifest...");
  
  const manifest = {
    bundle_name: bundleName,
    bundle_version: BUNDLE_VERSION,
    created_at: new Date().toISOString(),
    vsc_version: VSC_VERSION,
    chain: {
      token_id: chainToken.id || path.basename(resolvedChainPath, ".json"),
      base_token_id: baseTokenId,
      latest_token_id: latestTokenId,
      delta_count: deltaTokens.length,
      chain_hash_prefix: chainHashPrefix,
      source_file: path.basename(resolvedChainPath)
    },
    base: {
      token_id: baseTokenId,
      source_file: baseTokenPath ? path.basename(baseTokenPath) : null,
      bundle_file: "base-token.json"
    },
    deltas: deltaTokens.map(d => ({
      index: d.index,
      token_id: d.id,
      source_file: path.basename(d.src),
      bundle_file: d.dest
    })),
    reports: reportPath ? [{
      type: "chain-report",
      source_file: path.basename(reportPath),
      bundle_file: "reports/chain-report.md"
    }] : [],
    seals: sealsFound.map(s => ({
      type: s.type,
      token_id: s.id,
      bundle_file: `seals/${s.name}`
    })),
    checksums_file: "checksums.sha256",
    warnings: warnings,
    limitations: [
      "Recovery chunk folders not included (can be regenerated from tokens).",
      "Restored state folders not included (can be regenerated via restore).",
      "Benchmark fixtures not included.",
      "PDF source files not included.",
      "This is a research prototype, not enterprise production software."
    ]
  };
  
  fs.writeFileSync(
    path.join(bundleDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );
  includedFiles.push({ dest: "manifest.json", type: "meta" });
  console.log("     ✓ manifest.json");
  
  // ── Create Checksums ───────────────────────────────────────────────────────────
  console.log("\n[08] Computing checksums...");
  
  const checksumLines = [];
  
  function addChecksum(filePath, relativePath) {
    const fullPath = path.join(bundleDir, filePath);
    if (fs.existsSync(fullPath)) {
      const hash = sha256File(fullPath);
      checksumLines.push(`${hash}  ${relativePath || filePath}`);
    }
  }
  
  // Add checksums for all files in bundle
  addChecksum("chain-token.json", "chain-token.json");
  addChecksum("base-token.json", "base-token.json");
  addChecksum("verification-summary.json", "verification-summary.json");
  addChecksum("manifest.json", "manifest.json");
  
  if (reportPath) {
    addChecksum("reports/chain-report.md", "reports/chain-report.md");
  }
  
  for (const delta of deltaTokens) {
    addChecksum(delta.dest, delta.dest);
  }
  
  for (const seal of sealsFound) {
    addChecksum(`seals/${seal.name}`, `seals/${seal.name}`);
  }
  
  fs.writeFileSync(
    path.join(bundleDir, "checksums.sha256"),
    checksumLines.join("\n") + "\n",
    "utf8"
  );
  console.log(`     ✓ checksums.sha256 (${checksumLines.length} files)`);
  
  // ── Create README ────────────────────────────────────────────────────────────
  console.log("\n[09] Creating README...");
  
  const readme = `# VSC Evidence Bundle

**Bundle:** ${bundleName}  
**Created:** ${new Date().toISOString()}  
**VSC Version:** ${VSC_VERSION}  
**Bundle Version:** ${BUNDLE_VERSION}

## Purpose

This is a portable evidence package containing a verified VSC delta chain and all related proof artifacts. It can be shared with partners, auditors, researchers, or used as a DigiEmu proof artifact.

## Chain Summary

| Property | Value |
|----------|-------|
| Base Token ID | \`${baseTokenId}\` |
| Latest Token ID | \`${latestTokenId}\` |
| Delta Count | ${deltaTokens.length} |
| Chain Hash Prefix | \`${chainHashPrefix}\` |

## Included Artifacts

### Tokens
- \`chain-token.json\` — The complete delta chain token
- \`base-token.json\` — Base state recovery token
- \`delta-tokens/delta-*.json\` — ${deltaTokens.length} delta step tokens

### Reports
${reportPath ? "- `reports/chain-report.md` — Human-readable chain report" : "- *(No chain report available)*"}

### Seals (SVG)
${sealsFound.map(s => `- \`seals/${s.name}\` — ${s.type} seal (${s.id})`).join("\n") || "- *(No seals found)*"}

### Metadata
- \`manifest.json\` — Complete bundle manifest with file mappings
- \`verification-summary.json\` — Verification status and instructions
- \`checksums.sha256\` — SHA-256 checksums for all included files

## How to Inspect

View any JSON token directly:

\`\`\`bash
# Pretty-print chain token
cat chain-token.json | python -m json.tool

# Or use jq if available
cat chain-token.json | jq '.steps[0]'
\`\`\`

## How to Verify Manually

### 1. Restore the Chain

\`\`\`bash
# Restore latest state from chain
npm run vsc -- restore chain-token.json

# Or use the chain restore script
node src/restoreDeltaChain.js chain-token.json
\`\`\`

### 2. Verify Root Hash

\`\`\`bash
# After restore, verify against expected root hash
npm run vsc -- verify chain-token.json <restored-folder>
\`\`\`

### 3. Check Checksums

\`\`\`bash
# Verify file integrity
sha256sum -c checksums.sha256
\`\`\`

## Verification Status

**Current Status:** ${verificationSummary.verification_status}

${verificationSummary.verification_status === "exported" ? "This bundle has been exported but not re-verified during export. Run manual verification steps above to confirm integrity." : ""}

## Limitations

- Recovery chunk folders are not included (can be regenerated from tokens).
- Restored state folders are not included (can be regenerated via restore).
- This is a **research prototype**, not enterprise production software.
- For large chains, manual verification may take significant time.

## Reproduction

To reproduce this bundle from source:

\`\`\`bash
# Run the original chain creation
npm run vsc -- chain base-token.json delta-1.json delta-2.json ...

# Export the bundle
npm run vsc -- bundle output/vsc-chain-${baseTokenId}-to-${latestTokenId}.json
\`\`\`

---

*VSC Evidence Bundle — Portable proof for verifiable state commitments*
`;
  
  fs.writeFileSync(
    path.join(bundleDir, "README.md"),
    readme,
    "utf8"
  );
  includedFiles.push({ dest: "README.md", type: "meta" });
  console.log("     ✓ README.md");
  
  // ── Final Summary ────────────────────────────────────────────────────────────
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║   EVIDENCE BUNDLE EXPORT COMPLETE                          ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  console.log(`\nBundle: ${bundleDir}`);
  console.log(`Files included: ${includedFiles.length}`);
  console.log(`  - Chain token: 1`);
  console.log(`  - Base token: ${baseTokenPath ? 1 : 0}`);
  console.log(`  - Delta tokens: ${deltaTokens.length}`);
  console.log(`  - Reports: ${reportPath ? 1 : 0}`);
  console.log(`  - Seals: ${sealsFound.length}`);
  console.log(`  - Metadata: 4 (README, manifest, verification-summary, checksums)`);
  
  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const warning of warnings) {
      console.log(`  ⚠ ${warning}`);
    }
  }
  
  console.log("\n✓ Export PASS");
  console.log("\nNext steps:");
  console.log(`  1. Inspect:    cd ${bundleDir}`);
  console.log("  2. Verify:     npm run vsc -- verify chain-token.json <restored-folder>");
  console.log("  3. Share:      Distribute the bundle directory or zip it");
  console.log("");
}

// ── Main ───────────────────────────────────────────────────────────────────────

const chainTokenPath = process.argv[2];
exportEvidenceBundle(chainTokenPath);
