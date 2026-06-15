# VSC v1.9 — One-command Demo

## Purpose

VSC v1.9 makes the WordPress-style proof flow reproducible with a single command. No manual token ID replacement, no multi-step terminal session, no placeholder values. The runner discovers all generated token paths from the manifest and wires each step together automatically.

---

## Command

```
npm run vsc -- demo:run
```

---

## What the Demo Does

1. Creates the WordPress-style fixture (`test-wp/`)
2. Creates a base folder snapshot (FOLDER_RECOVERY token)
3. Applies a deterministic database change to `test-wp/database.sql`
4. Creates delta 1 (FOLDER_DELTA token — changed file: `database.sql`)
5. Applies a deterministic plugin file change
6. Creates delta 2 (FOLDER_DELTA token — changed file: `vsc-demo-plugin.php`)
7. Builds a delta chain (DELTA_CHAIN token — 2 steps)
8. Generates a chain storage report
9. Restores the base folder (prerequisite for chain restore)
10. Restores the latest state from the chain
11. Verifies the restored latest state by root hash
12. Runs `verify-all` across all manifest tokens
13. Opens `output/gallery.html` in the default browser (Windows) or prints the path

---

## Expected Result

```
╔══════════════════════════════════════════╗
║   DEMO RESULT: PASS                      ║
╚══════════════════════════════════════════╝

Token summary:
  Base      <BASE_ID>   output/vsc-<BASE_ID>-folder-recovery.json
  Delta 1   <D1_ID>     output/vsc-<BASE_ID>-to-<D1_ID>-folder-delta.json
  Delta 2   <D2_ID>     output/vsc-<D1_ID>-to-<D2_ID>-folder-delta.json
  Chain     <CHAIN_ID>  output/vsc-chain-<BASE_ID>-to-<D2_ID>.json
  Restored  output/chain-<BASE_ID>-to-<D2_ID>/restored-test-wp

Chain metrics:
  Steps:                 2
  Total delta size:      ~641 B
  Total chain reduction: ~66%
  Delta-only reduction:  ~99.96%
  verify-all:            FAIL: 0
```

Token IDs are derived from your file content hashes and will differ from the original demo run. The metrics will be identical if the fixture files are identical.

---

## Idempotency

The two file mutations (`database.sql` and `vsc-demo-plugin.php`) are guarded by marker comments:
- `-- VSC_DEMO_CHANGE_1` in `database.sql`
- `// VSC_DEMO_CHANGE_2` in `vsc-demo-plugin.php`

Running `demo:run` a second time without resetting the fixture will skip the already-applied changes and create a new set of tokens from the current state. To get a fully fresh run, reset the fixture first:

```
# Reset fixture files
npm run vsc -- demo

# Then re-run the demo
npm run vsc -- demo:run
```

Note: `demo` (fixture creator) is non-destructive — it only writes missing files. To force a full reset of `test-wp/`, delete the folder first:

```
rmdir /s /q test-wp
npm run vsc -- demo:run
```

---

## Inspecting the Output

After a successful run:

- Token JSON files: `output/vsc-*.json`
- Chain storage report: `output/report-chain-<BASE>-to-<LATEST>.md`
- Restored folder: `output/chain-<BASE>-to-<LATEST>/restored-test-wp/`
- Gallery: `output/gallery.html`

---

## Status

Research prototype / MVP proof-of-concept. Not production-ready.

The demo runner calls existing scripts via `spawnSync`. No cryptographic logic lives in the runner itself.
