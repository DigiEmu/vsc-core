# VSC v1.8 CLI Simplification

## Purpose

VSC v1.8 introduces a single CLI entry point (`npm run vsc`) that wraps the low-level scripts from v1.7. The underlying logic — hashing, delta encoding, chain building, restore, and verification — is unchanged. The goal is to reduce the commands a user needs to remember.

---

## Command Overview

```
npm run vsc -- <command> [args]
```

| Command | Description |
|---------|-------------|
| `backup <folder>` | Create a full folder base snapshot |
| `delta <previous-token.json> <folder>` | Create a folder delta |
| `chain <base-token.json> <delta-token.json...>` | Build a delta chain |
| `restore <token.json>` | Restore latest state (auto-detects mode) |
| `restore-delta <base-token.json> <delta-token.json>` | Restore from a base + delta pair |
| `verify <token.json> <restored-folder>` | Verify a restored folder (auto-detects mode) |
| `report <chain-token.json>` | Print and save a chain storage report |
| `verify-all` | Verify all manifest tokens |
| `demo` | Create or refresh the WordPress-style test fixture |
| `gallery` | Open `output/gallery.html` in the default browser |
| `help` | Print command overview |

---

## Old vs New Commands

| Old (v1.7) | New (v1.8) |
|-----------|-----------|
| `npm run encode-folder .\test-wp FOLDER` | `npm run vsc -- backup test-wp` |
| `npm run encode-folder-delta output\vsc-21A8390BFA3F-folder-recovery.json .\test-wp FOLDER_DELTA` | `npm run vsc -- delta output\vsc-21A8390BFA3F-folder-recovery.json test-wp` |
| `npm run create-chain <base> <delta1> <delta2>` | `npm run vsc -- chain <base> <delta1> <delta2>` |
| `npm run restore-chain <chain>` | `npm run vsc -- restore <chain>` |
| `npm run verify-chain <chain> <folder>` | `npm run vsc -- verify <chain> <folder>` |
| `npm run report-chain <chain>` | `npm run vsc -- report <chain>` |
| `npm run verify-all` | `npm run vsc -- verify-all` |
| `npm run demo:fixture` | `npm run vsc -- demo` |

The v1.7 scripts remain available and unchanged.

---

## WordPress Demo with Simplified CLI

Full reproduction from a clean clone:

```bash
# 1. Create demo fixture
npm run vsc -- demo

# 2. Base snapshot
npm run vsc -- backup test-wp

# 3. (Edit test-wp/database.sql — add a row)

# 4. Delta 1  (replace token ID with the one printed in step 2)
npm run vsc -- delta output\vsc-<BASE>-folder-recovery.json test-wp

# 5. (Edit test-wp/wp-content/plugins/vsc-demo-plugin/vsc-demo-plugin.php)

# 6. Delta 2  (replace token ID with the one printed in step 4)
npm run vsc -- delta output\vsc-<D1>-folder-delta.json test-wp

# 7. Build chain
npm run vsc -- chain output\vsc-<BASE>-folder-recovery.json \
                      output\vsc-<BASE>-to-<D1>-folder-delta.json \
                      output\vsc-<D1>-to-<D2>-folder-delta.json

# 8. Storage report
npm run vsc -- report output\vsc-chain-<BASE>-to-<D2>.json

# 9. Restore latest state
npm run vsc -- restore output\vsc-chain-<BASE>-to-<D2>.json

# 10. Verify
npm run vsc -- verify output\vsc-chain-<BASE>-to-<D2>.json \
                       output\chain-<BASE>-to-<D2>\restored-test-wp

# 11. Batch verify
npm run vsc -- verify-all

# 12. Open gallery
npm run vsc -- gallery
```

---

## Restore and Verify Model

`restore` and `verify` auto-detect the token mode from the JSON file:

| Token mode | `restore` delegates to | `verify` delegates to |
|-----------|------------------------|----------------------|
| `DELTA_CHAIN` / `VSC_CHAIN` | `restoreDeltaChain.js` | `verifyDeltaChain.js` |
| `FOLDER_RECOVERY` | `restoreFolder.js` | `verifyFolder.js` |
| `FOLDER_DELTA` | *(error — use restore-delta)* | `verifyFolderDelta.js` |

For `FOLDER_DELTA` restore, a base token is required:
```bash
npm run vsc -- restore-delta output\vsc-BASE-folder-recovery.json output\vsc-BASE-to-D1-folder-delta.json
```

---

## Current Limits

- `gallery` uses `cmd /c start` on Windows. On other platforms it prints the path only.
- The CLI is a thin router — no new cryptographic behaviour.
- All verification, hashing, and restore logic remains in the individual `src/` scripts.
- Old `npm run encode-folder`, `npm run create-chain`, etc. remain fully functional.
