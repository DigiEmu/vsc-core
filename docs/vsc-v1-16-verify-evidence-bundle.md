# VSC v1.16 — Evidence Bundle Verification

**Release Date:** v1.16  
**Status:** Research prototype / proof-of-concept

---

## Overview

VSC v1.16 adds **Evidence Bundle Verification** — a read-only verifier that checks whether an exported VSC evidence bundle is complete, internally consistent, and unchanged according to its manifest and checksums.

This feature completes the evidence lifecycle:
- **v1.14** — Export generic evidence bundles
- **v1.15** — Export JSON event evidence bundles
- **v1.16** — Verify exported bundles (this release)

---

## Command

```bash
npm run vsc -- verify-bundle <bundle-folder>
```

### Examples

```bash
# Verify a generic evidence bundle
npm run vsc -- verify-bundle output\bundles\vsc-bundle-21A8390BFA3F-to-954BEB0FF3AA

# Verify a JSON event evidence bundle
npm run vsc -- verify-bundle output\json-event-bundles\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13

# Verify with relative path
npm run vsc -- verify-bundle .\output\bundles\vsc-bundle-21A8390BFA3F-to-954BEB0FF3AA
```

---

## What It Verifies

### 1. Required Files (Generic Bundle)

All generic evidence bundles must contain:
- `README.md` — Bundle guide and documentation
- `manifest.json` — Complete artifact inventory
- `checksums.sha256` — File integrity checksums
- `chain-token.json` — The delta chain token
- `base-token.json` — Base state snapshot
- `verification-summary.json` — Verification status

### 2. Required Files (JSON Event Bundle)

JSON event bundles additionally require:
- `event-schema.json` — Event structure definition
- `event-summary.json` — Session statistics
- `json-benchmark-summary.json` — Benchmark metrics
- `json-benchmark-report.md` — Human-readable report
- `json-benchmark-chart-data.json` — Chart/plot data

### 3. Checksum Integrity

- Parses `checksums.sha256` (handles `<hash>  <path>` and `<hash> <path>` formats)
- Verifies every listed file exists in the bundle
- Computes SHA-256 for each file
- Compares computed hash to expected hash
- Reports specific failures (missing file or hash mismatch)

### 4. Manifest Consistency

- Loads `manifest.json` and validates it is valid JSON
- Verifies manifest chain references match `chain-token.json`:
  - `base_token_id` matches chain's base
  - `latest_token_id` matches chain's latest
- Reports warnings for optional fields (defensive validation)

### 5. Chain Token Validation

- Loads `chain-token.json` and validates it is valid JSON
- Verifies it is a valid chain token (`mode: DELTA_CHAIN` or `steps` array)
- Extracts `base_token_id` and `latest_token_id`
- Reports errors for missing required fields

### 6. Base Token Validation

- Confirms `base-token.json` exists
- Validates it is parseable JSON

### 7. Delta Token Validation

- Confirms `delta-tokens/` directory exists
- For each step in the chain:
  - Locates corresponding delta file (`delta-001.json`, `delta-002.json`, etc.)
  - Validates delta file is parseable JSON
- Reports count of found vs. expected deltas

### 8. JSON Event Metadata (JSON Event Bundles Only)

When JSON event files are present:
- Validates `event-schema.json` is valid JSON
- Validates `event-summary.json` is valid JSON
- Validates `json-benchmark-summary.json` is valid JSON
- Reports expected v1.15 session ID (`2F9047C9F1C1A3FF`) when found

---

## Expected Output

### Successful Verification

```
╔════════════════════════════════════════════════════════════╗
║   VSC v1.16 — Evidence Bundle Verification                 ║
╚════════════════════════════════════════════════════════════╝

Bundle path: C:\Users\...\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13
Bundle type: JSON Event Evidence Bundle

[01] Checking required files...
  ✓ Required files: PASS

[02] Verifying checksums...
  ✓ Checksums: PASS (106 files verified)

[03] Verifying chain token...
  ✓ Chain token: PASS (408C8C13C4D4 → ED9566562A13)

[04] Verifying base token...
  ✓ Base token: PASS

[05] Verifying delta tokens...
  ✓ Delta tokens: PASS (99/99 found)

[06] Verifying manifest...
  ✓ Manifest: PASS

[07] Verifying JSON event metadata...
  ✓ JSON event metadata: PASS
  ✓ Expected v1.15 session ID found (2F9047C9F1C1A3FF)

╔════════════════════════════════════════════════════════════╗
║   VERIFICATION SUMMARY                                     ║
╚════════════════════════════════════════════════════════════╝

  Manifest:        PASS
  Checksums:       PASS
  Chain token:     PASS
  Base token:      PASS
  Delta tokens:    PASS
  JSON event meta: PASS

  Result:          PASS

✓ Bundle verification complete — all checks passed.
```

### Failed Verification

```
[02] Verifying checksums...
  ✗ Checksums: FAIL (102/106 files verified)
     ✗ Checksum mismatch: delta-tokens/delta-042.json
     ✗ Missing file: delta-tokens/delta-099.json

...

  Result:          FAIL

✗ Bundle verification failed — see errors above.
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Verification passed — all checks successful |
| `1` | Verification failed — one or more checks failed |

---

## Use Cases

### Pre-Sharing Validation

Before sending a bundle to partners or auditors:

```bash
npm run vsc -- verify-bundle output/bundles/vsc-bundle-ABC-to-XYZ
# Only proceed if Result: PASS
```

### Receipt Verification

When receiving a bundle, confirm it is unchanged:

```bash
npm run vsc -- verify-bundle received-bundle/
# Non-zero exit code indicates tampering or corruption
```

### Audit Compliance

For compliance reviews, verify bundle completeness:

```bash
# CI/CD pipeline step
npm run vsc -- verify-bundle $BUNDLE_PATH || exit 1
```

### Automated Testing

Integrate into test suites:

```bash
# After bundle export
npm run vsc -- bundle output/vsc-chain-*.json
npm run vsc -- verify-bundle output/bundles/vsc-bundle-* || exit 1
```

---

## Read-Only Guarantee

The `verify-bundle` command is **strictly read-only**. It:

- ✅ Reads files from the bundle
- ✅ Computes checksums
- ✅ Parses JSON
- ✅ Prints results to stdout/stderr

It does **not**:
- ❌ Modify `manifest.json`
- ❌ Update `checksums.sha256`
- ❌ Rewrite any token files
- ❌ Create or delete files in the bundle
- ❌ Write to the bundle directory

This guarantee is essential for:
- **Audit scenarios** — Auditors can verify without altering evidence
- **Compliance** — Chain of custody remains intact
- **Trust** — Verification doesn't "fix" what it finds

---

## Verification Checklist

When reviewing this feature:

- [ ] Run `npm run vsc -- bundle:json` to create a bundle
- [ ] Run `npm run vsc -- verify-bundle <path>` on the exported bundle
- [ ] Confirm output shows `Result: PASS`
- [ ] Confirm exit code is `0`
- [ ] Modify a file in the bundle (e.g., edit README.md)
- [ ] Re-run verification
- [ ] Confirm output shows `Result: FAIL` and exit code is `1`
- [ ] Run `npm run vsc -- verify-all` and confirm `FAIL: 0`
- [ ] Verify no files in the bundle were modified by the verification

---

## Limitations

- **No restore during verify** — This command only checks file integrity and metadata; it does not restore the chain or verify root hashes (use `npm run vsc -- verify` for that)
- **Bundle format dependent** — Validates against known VSC bundle formats; custom modifications may cause false negatives
- **Windows/Unix paths** — Handles both path formats but was primarily tested on Windows
- **Research prototype** — Not enterprise-hardened validation software

---

## Relationship to Other Commands

| Command | Purpose | Writes? |
|---------|---------|---------|
| `bundle` | Export generic evidence bundle | ✅ Yes |
| `bundle:json` | Export JSON event evidence bundle | ✅ Yes |
| `verify-bundle` | Verify exported bundle | ❌ No (read-only) |
| `verify` | Verify restored folder against token | ❌ No (read-only) |
| `verify-all` | Verify all registered tokens | ❌ No (read-only) |

---

## See Also

- [VSC v1.14 — Evidence Bundle Export](vsc-v1-14-evidence-bundle-export.md)
- [VSC v1.15 — JSON Event Evidence Bundle](vsc-v1-15-json-event-evidence-bundle.md)
- [VSC v1.13 — JSON Event Benchmark](vsc-v1-13-json-event-benchmark.md)

---

*VSC v1.16 — Evidence Bundle Verification*
