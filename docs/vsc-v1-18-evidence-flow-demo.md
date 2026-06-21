# VSC v1.18 — Evidence Flow Demo

**Release Date:** v1.18  
**Status:** Research prototype / proof-of-concept

---

## Purpose

VSC v1.18 adds a single demo command that orchestrates the complete VSC evidence handoff flow in one step. It is designed for partners, reviewers, and documentation walkthroughs where showing the full flow — export, verify, package — matters more than running each step manually.

The command is a **thin orchestrator**. Every evidence boundary decision, checksum binding, manifest integrity check, and ZIP creation is still performed by the dedicated scripts it delegates to. Nothing about the evidence model changes in v1.18.

---

## Command

```bash
npm run vsc -- demo:evidence-flow
```

No arguments required.

---

## Flow

```
┌─────────────────────────────────────────────────────────┐
│              VSC v1.18 — Evidence Flow Demo              │
└─────────────────────────────────────────────────────────┘

  [01] Export JSON Event Evidence Bundle
       └─ exportJsonEventBundle.js
       └─ Creates/refreshes bundle in output/json-event-bundles/

  [02] Locate Evidence Bundle
       └─ Detects the most recently modified bundle directory
       └─ No hardcoded bundle name

  [03] Verify Evidence Bundle
       └─ verifyEvidenceBundle.js  (read-only verification)
       └─ Checks required files, checksums, chain/base/delta tokens,
          JSON event metadata

  [04] Create ZIP Handoff Artifact
       └─ zipEvidenceBundle.js
       └─ Writes to output/zips/<bundle-name>.zip
       └─ Source bundle is not modified

  [05] Print Final Summary
       └─ Bundle path, ZIP path, PASS/FAIL for each step
```

---

## Expected Output

```
╔════════════════════════════════════════════════════════════╗
║   VSC v1.18 — Evidence Flow Demo                           ║
╚════════════════════════════════════════════════════════════╝

  Flow:  Export  →  Verify  →  ZIP  →  Summary

[01] Exporting JSON Event Evidence Bundle
────────────────────────────────────────────────────────────
...
✓ Export PASS

[02] Locating Evidence Bundle
────────────────────────────────────────────────────────────
  ✓ Bundle: C:\...\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13

[03] Verifying Evidence Bundle
────────────────────────────────────────────────────────────
...
  Result:          PASS

[04] Creating ZIP Handoff Artifact
────────────────────────────────────────────────────────────
...
  Result:          PASS

╔════════════════════════════════════════════════════════════╗
║   EVIDENCE FLOW DEMO COMPLETE                              ║
╚════════════════════════════════════════════════════════════╝

  Bundle path:          output\json-event-bundles\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13
  ZIP path:             output\zips\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13.zip
  Verification result:  PASS
  ZIP export result:    PASS

  Final result:         PASS

✓ Evidence handoff flow complete.
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All steps passed |
| `1` | Any step failed — flow stopped immediately |

---

## Evidence Boundaries

This command does not own any evidence logic. The boundaries are:

| Step | Responsible script | What it protects |
|------|-------------------|-----------------|
| Export | `exportJsonEventBundle.js` | Bundle creation, checksum binding, manifest |
| Verify | `verifyEvidenceBundle.js` | Read-only verification, fail-closed |
| ZIP | `zipEvidenceBundle.js` | Source bundle immutability, portable handoff artifact |
| Locate | `demoEvidenceFlow.js` only | Finds latest bundle by mtime — no evidence logic |

---

## Fail-Closed Behavior

If any step returns a non-zero exit code, the flow stops immediately and exits non-zero. The remaining steps are never executed. This prevents a failed export from being verified, or a corrupted bundle from being zipped and distributed.

```bash
# Forced failure: if export fails, verify and zip are skipped
npm run vsc -- demo:evidence-flow
# → ✗ Evidence bundle export failed — stopping flow.
# → exit code 1
```

---

## What This Command Does Not Do

- **Does not change verification semantics** — `verify-bundle` behavior is unchanged
- **Does not change ZIP semantics** — `zip-bundle` behavior is unchanged  
- **Does not change the bundle format** — no new files, fields, or checksums
- **Does not hardcode bundle names** — detects the latest bundle by modification time
- **Does not mutate verified bundle contents** — `zipEvidenceBundle.js` guarantees source bundle immutability
- **Does not commit output files** — `output/` is gitignored

---

## Running Steps Independently

The individual commands remain fully functional and can be run at any time:

```bash
# Run only export
npm run vsc -- bundle:json

# Run only verification
npm run vsc -- verify-bundle output\json-event-bundles\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13

# Run only ZIP
npm run vsc -- zip-bundle output\json-event-bundles\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13

# Run full flow
npm run vsc -- demo:evidence-flow
```

---

## Validation Commands

```bash
# Run the full demo flow
npm run vsc -- demo:evidence-flow

# Verify the bundle independently (should still pass)
npm run vsc -- verify-bundle output\json-event-bundles\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13

# ZIP the bundle independently (should still pass)
npm run vsc -- zip-bundle output\json-event-bundles\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13

# Check all tokens are intact
npm run vsc -- verify-all

# Confirm no output files are tracked
git status --short
```

---

## See Also

- [VSC v1.17 — ZIP Bundle Export](vsc-v1-17-zip-bundle-export.md)
- [VSC v1.16 — Evidence Bundle Verification](vsc-v1-16-verify-evidence-bundle.md)
- [VSC v1.15 — JSON Event Evidence Bundle](vsc-v1-15-json-event-evidence-bundle.md)

---

*VSC v1.18 — Evidence Flow Demo*
