#!/usr/bin/env node
/**
 * vscCli.js — VSC v1.8 simplified CLI router
 *
 * Usage:  npm run vsc -- <command> [args]
 *
 * Delegates to existing src/ scripts. No core logic lives here.
 */

import { spawnSync } from "child_process";
import fs            from "fs";
import path          from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

// ── Helpers ──────────────────────────────────────────────────────────────────

function run(scriptRelPath, extraArgs = []) {
  const scriptPath = path.join(ROOT, scriptRelPath);
  const result = spawnSync(
    process.execPath,
    [scriptPath, ...extraArgs],
    { stdio: "inherit", cwd: ROOT }
  );
  process.exit(result.status ?? 1);
}

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
VSC — Versioned State Commit CLI  (v1.8)
─────────────────────────────────────────
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

  demo
      Create or refresh the reproducible WordPress-style test fixture.

  demo:run
      Run the complete WordPress-style VSC proof flow end-to-end.

  showcase
      Export a lightweight static showcase site to showcase/.

  gallery
      Open output/gallery.html in the default browser.

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

  // ── unknown ────────────────────────────────────────────────────────────────
  default: {
    console.error(`\nvsc: unknown command "${command}"\n`);
    printHelp();
    process.exit(1);
  }
}
