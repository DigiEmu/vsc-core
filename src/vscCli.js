#!/usr/bin/env node
/**
 * vscCli.js — VSC CLI router
 *
 * Usage:  npm run vsc -- <command> [args]
 *
 * Dispatches commands to their dedicated scripts via spawnSync.
 * No proof, hashing, or evidence logic lives here — this file is
 * routing only. Each command inherits the full exit code of its target.
 */

import { spawnSync } from "child_process";
import fs            from "fs";
import path          from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Spawns a script in a child process and exits with its status code.
 *
 * stdio: "inherit" ensures the child's output is streamed directly to the
 * terminal, preserving PASS/FAIL lines and formatting from each script.
 * cwd: ROOT ensures relative bundle paths resolve consistently regardless
 * of where the user runs the command from.
 */
function run(scriptRelPath, extraArgs = []) {
  const scriptPath = path.join(ROOT, scriptRelPath);
  const result = spawnSync(
    process.execPath,
    [scriptPath, ...extraArgs],
    { stdio: "inherit", cwd: ROOT }
  );
  // Propagate the child's exit code exactly — callers and CI pipelines
  // rely on non-zero meaning failure.
  process.exit(result.status ?? 1);
}

/**
 * Reads the mode and type fields from a token JSON file.
 * Used by `restore` and `verify` to auto-detect which script to dispatch to
 * without requiring the caller to know the token's internal structure.
 */
function readTokenMode(tokenPath) {
  try {
    const t = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
    return { mode: t.mode || "", type: t.type || "" };
  } catch {
    return { mode: "", type: "" };
  }
}

function die(msg) {
  console.error(`\nvsc error: ${msg}\n`);
  process.exit(1);
}

// ── Help ─────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
VSC — Versioned State Commit CLI  (v1.18)
──────────────────────────────────────────
Usage:  npm run vsc -- <command> [args]

Commands:
  backup <folder>
      Create a full folder base snapshot.

  delta <previous-token.json> <folder>
      Create a folder delta from a previous base or delta token.

  chain <base-token.json> <delta-token.json> [<delta-token.json>...]
      Build a delta chain from a base and one or more deltas.

  restore <token.json>
      Restore latest state. Auto-detects token mode.
      (For FOLDER_DELTA, use restore-delta instead.)

  restore-delta <base-token.json> <delta-token.json>
      Restore a folder from a base + delta token pair.

  verify <token.json> <restored-folder>
      Verify a restored folder. Auto-detects token mode.

  report <chain-token.json>
      Print and save a chain storage report.

  verify-all
      Verify all registered tokens in the manifest.

  benchmark [profile]
      Run storage-load reduction benchmark (small|medium|large).
      Measures VSC storage efficiency and restore/verify performance.
      Default profile: medium (100 states).

  benchmark:json [profile]
      Run JSON Event Benchmark for AI-style structured event logs.
      Measures VSC storage efficiency for accumulating JSON event states.
      Default profile: medium (100 states).

  demo
      Create or refresh the reproducible WordPress-style test fixture.

  demo:run
      Run the complete WordPress-style VSC proof flow end-to-end.

  showcase
      Export a lightweight static showcase site to showcase/.

  gallery
      Open output/gallery.html in the default browser.

  bundle <chain-token.json>
      Export a complete evidence bundle for a VSC delta chain.
      Creates a portable package with tokens, reports, seals, and checksums.

  bundle:json [chain-token.json]
      Export a JSON event evidence bundle for AI-style event chains.
      Packages JSON benchmark data with VSC proof artifacts.
      Uses latest JSON benchmark results if no chain token is provided.

  verify-bundle <bundle-folder>
      Verify an exported evidence bundle is complete and unchanged.
      Checks manifest, checksums, chain/base/delta tokens, and JSON metadata.

  zip-bundle <bundle-folder>
      Create a portable .zip file from an evidence bundle folder.
      Outputs to output/zips/ with the bundle name as the filename.

  demo:evidence-flow
      Run the complete VSC evidence handoff flow end-to-end:
      Export evidence bundle → verify → ZIP → print summary.

  compare:fixtures
      Run the v2.8.1 conformance comparison runner.
      Compares Go verifier --json output against v2.7 fixture expected results.

  help
      Print this help text.

Examples:
  npm run vsc -- demo:run
  npm run vsc -- showcase
  npm run vsc -- demo
  npm run vsc -- backup test-wp
  npm run vsc -- delta output\\vsc-21A8390BFA3F-folder-recovery.json test-wp
  npm run vsc -- chain output\\vsc-21A8390BFA3F-folder-recovery.json output\\vsc-21A8390BFA3F-to-F3876A4BCFE1-folder-delta.json output\\vsc-F3876A4BCFE1-to-954BEB0FF3AA-folder-delta.json
  npm run vsc -- restore output\\vsc-chain-21A8390BFA3F-to-954BEB0FF3AA.json
  npm run vsc -- verify output\\vsc-chain-21A8390BFA3F-to-954BEB0FF3AA.json output\\chain-21A8390BFA3F-to-954BEB0FF3AA\\restored-test-wp
  npm run vsc -- report output\\vsc-chain-21A8390BFA3F-to-954BEB0FF3AA.json
  npm run vsc -- verify-all
`);
}

// ── Router ───────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const command = args[0];

if (!command || command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

switch (command) {

  // ── backup <folder> ────────────────────────────────────────────────────────
  case "backup": {
    const folder = args[1];
    if (!folder) die("backup requires a folder path.\n  Usage: npm run vsc -- backup <folder>");
    run("src/encodeFolderCli.js", [folder, "FOLDER"]);
    break;
  }

  // ── delta <previous-token.json> <folder> ───────────────────────────────────
  case "delta": {
    const prevToken = args[1];
    const folder    = args[2];
    if (!prevToken || !folder)
      die("delta requires a previous token JSON and a folder.\n  Usage: npm run vsc -- delta <previous-token.json> <folder>");
    run("src/encodeFolderDeltaCli.js", [prevToken, folder, "FOLDER_DELTA"]);
    break;
  }

  // ── chain <base> <delta...> ────────────────────────────────────────────────
  case "chain": {
    const chainArgs = args.slice(1);
    if (chainArgs.length < 2)
      die("chain requires a base token JSON and at least one delta token JSON.\n  Usage: npm run vsc -- chain <base-token.json> <delta-token.json> [...]");
    run("src/createDeltaChainCli.js", chainArgs);
    break;
  }

  // ── restore <token.json> ───────────────────────────────────────────────────
  case "restore": {
    const tokenPath = args[1];
    if (!tokenPath) die("restore requires a token JSON path.\n  Usage: npm run vsc -- restore <token.json>");
    const { mode, type } = readTokenMode(tokenPath);
    if (mode === "DELTA_CHAIN" || type === "VSC_CHAIN") {
      run("src/restoreDeltaChain.js", [tokenPath]);
    } else if (mode === "FOLDER_RECOVERY") {
      run("src/restoreFolder.js", [tokenPath]);
    } else if (mode === "FOLDER_DELTA") {
      console.error(`
vsc: FOLDER_DELTA tokens require a base token to restore.
Use: npm run vsc -- restore-delta <base-token.json> <delta-token.json>
`);
      process.exit(1);
    } else {
      console.error(`vsc: unrecognised token mode "${mode}" / type "${type}". Cannot auto-detect restore command.`);
      process.exit(1);
    }
    break;
  }

  // ── restore-delta <base-token.json> <delta-token.json> ────────────────────
  case "restore-delta": {
    const baseToken  = args[1];
    const deltaToken = args[2];
    if (!baseToken || !deltaToken)
      die("restore-delta requires a base token JSON and a delta token JSON.\n  Usage: npm run vsc -- restore-delta <base-token.json> <delta-token.json>");
    run("src/restoreFolderDelta.js", [baseToken, deltaToken]);
    break;
  }

  // ── verify <token.json> <restored-folder> ──────────────────────────────────
  case "verify": {
    const tokenPath  = args[1];
    const restFolder = args[2];
    if (!tokenPath || !restFolder)
      die("verify requires a token JSON path and a restored folder.\n  Usage: npm run vsc -- verify <token.json> <restored-folder>");
    const { mode, type } = readTokenMode(tokenPath);
    if (mode === "DELTA_CHAIN" || type === "VSC_CHAIN") {
      run("src/verifyDeltaChain.js", [tokenPath, restFolder]);
    } else if (mode === "FOLDER_RECOVERY") {
      run("src/verifyFolder.js", [tokenPath, restFolder]);
    } else if (mode === "FOLDER_DELTA") {
      run("src/verifyFolderDelta.js", [tokenPath, restFolder]);
    } else {
      console.error(`vsc: unrecognised token mode "${mode}" / type "${type}". Cannot auto-detect verify command.`);
      process.exit(1);
    }
    break;
  }

  // ── report <chain-token.json> ──────────────────────────────────────────────
  case "report": {
    const chainToken = args[1];
    if (!chainToken) die("report requires a chain token JSON path.\n  Usage: npm run vsc -- report <chain-token.json>");
    run("src/reportChainCli.js", [chainToken]);
    break;
  }

  // ── verify-all ─────────────────────────────────────────────────────────────
  case "verify-all": {
    run("src/verifyAll.js");
    break;
  }

  // ── benchmark [profile] ────────────────────────────────────────────────────
  case "benchmark": {
    const profile = args[1] || "medium";
    run("scripts/runBenchmark.js", [profile]);
    break;
  }

  // ── benchmark:json [profile] ───────────────────────────────────────────────
  case "benchmark:json": {
    const jsonProfile = args[1] || "medium";
    run("scripts/runJsonEventBenchmark.js", [jsonProfile]);
    break;
  }

  // ── demo ───────────────────────────────────────────────────────────────────
  case "demo": {
    run("scripts/createWordPressDemoFixture.js");
    break;
  }

  // ── demo:run ───────────────────────────────────────────────────────────────
  case "demo:run": {
    run("scripts/runWordPressDemo.js");
    break;
  }

  // ── showcase ──────────────────────────────────────────────────────────────
  case "showcase": {
    run("scripts/exportShowcase.js");
    break;
  }

  // ── gallery ────────────────────────────────────────────────────────────────
  case "gallery": {
    const galleryPath = path.join(ROOT, "output", "gallery.html");
    if (!fs.existsSync(galleryPath)) {
      die(`gallery.html not found at ${galleryPath}\nRun npm run vsc -- backup first to generate tokens.`);
    }
    if (process.platform === "win32") {
      spawnSync("cmd", ["/c", "start", "", galleryPath], { stdio: "inherit", shell: false });
    } else {
      console.log(`Gallery: ${galleryPath}`);
      console.log("Open the file above in your browser.");
    }
    process.exit(0);
    break;
  }

  // ── bundle <chain-token.json> ──────────────────────────────────────────────
  case "bundle": {
    const chainTokenPath = args[1];
    if (!chainTokenPath) {
      die("Usage: npm run vsc -- bundle <chain-token.json>");
    }
    run("scripts/exportEvidenceBundle.js", [chainTokenPath]);
    break;
  }

  // ── bundle:json [chain-token.json] ───────────────────────────────────────────
  case "bundle:json": {
    const jsonChainTokenPath = args[1];
    // Without an explicit token path the exporter discovers the latest
    // JSON benchmark results automatically — pass an empty args list so
    // the script falls through to its auto-detect logic.
    if (jsonChainTokenPath) {
      run("scripts/exportJsonEventBundle.js", [jsonChainTokenPath]);
    } else {
      run("scripts/exportJsonEventBundle.js", []);
    }
    break;
  }

  // ── verify-bundle <bundle-folder> ─────────────────────────────────────────────
  case "verify-bundle": {
    const bundlePath = args[1];
    if (!bundlePath) {
      die("verify-bundle requires a bundle folder path.\n  Usage: npm run vsc -- verify-bundle <bundle-folder>");
    }
    // Read-only verification: verifyEvidenceBundle.js never writes to the bundle.
    // Exit code is propagated directly — callers can use this in CI pipelines.
    run("scripts/verifyEvidenceBundle.js", [bundlePath]);
    break;
  }

  // ── zip-bundle <bundle-folder> ────────────────────────────────────────────────
  case "zip-bundle": {
    const zipBundlePath = args[1];
    if (!zipBundlePath) {
      die("zip-bundle requires a bundle folder path.\n  Usage: npm run vsc -- zip-bundle <bundle-folder>");
    }
    // Packages the bundle into a portable handoff artifact in output/zips/.
    // Source bundle immutability is guaranteed by zipEvidenceBundle.js —
    // this routing passes the path through unchanged.
    run("scripts/zipEvidenceBundle.js", [zipBundlePath]);
    break;
  }

  // ── demo:evidence-flow ────────────────────────────────────────────────────
  case "demo:evidence-flow": {
    // Thin orchestration layer: delegates all evidence logic to existing scripts.
    // Fail-closed: demoEvidenceFlow.js stops on any failing step.
    run("scripts/demoEvidenceFlow.js");
    break;
  }

  // ── compare:fixtures ──────────────────────────────────────────────────────
  case "compare:fixtures": {
    // v2.8.1 conformance comparison runner.
    // Reads v2.7 fixture index and compares Go verifier --json output against expected results.
    run("scripts/compareConformanceResults.js");
    break;
  }

  // ── unknown ────────────────────────────────────────────────────────────────
  default: {
    console.error(`\nvsc: unknown command "${command}"\n`);
    printHelp();
    process.exit(1);
  }
}
