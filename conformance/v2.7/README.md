# VSC v2.7 Conformance Fixture Package

**Status:** DRAFT  
**Version:** v2.7-draft  
**Date:** 2026-06-21

---

## Purpose

This package provides minimal, deterministic VSC Evidence Bundle fixtures with expected verification results. Its goal is to enable reproducible PASS / FAIL / ERROR behavior comparison across:

- The Node.js reference verifier (`npm run vsc -- verify-bundle <path>`)
- The Go verifier prototype (`go run ./cmd/vsc-go verify-bundle <path>`)
- Future third-party verifier implementations

Fixtures are small and hand-authored. They do not contain real user data, real file snapshots, or real benchmark output.

---

## Fixture Philosophy

- **Minimal** — each fixture contains only the files required to exercise the targeted check.
- **Deterministic** — checksums are computed from static file content; fixtures never change unexpectedly.
- **Isolated** — each fixture exercises exactly one result class (PASS, FAIL, or ERROR).
- **Non-overlapping** — the injected fault in FAIL and ERROR fixtures is precisely described so a failing verifier can trace exactly which check failed and why.
- **Stable identifiers** — fixture IDs, token IDs, and expected result fields are versioned and stable within v2.7.

---

## Directory Layout

```
conformance/v2.7/
├── README.md                        (this file)
├── fixture-index.json               (machine-readable fixture list)
└── fixtures/
    ├── pass-basic/
    │   ├── README.md
    │   ├── expected-result.json
    │   └── bundle/
    │       ├── manifest.json
    │       ├── chain-token.json
    │       ├── base-token.json
    │       ├── checksums.sha256
    │       ├── verification-summary.json
    │       ├── event-summary.json
    │       ├── event-schema.json
    │       └── delta-tokens/
    │           └── delta-001.json
    ├── fail-checksum-mismatch/
    │   ├── README.md
    │   ├── expected-result.json
    │   └── bundle/
    │       └── ... (same structure, wrong checksum for manifest.json)
    └── error-malformed-manifest/
        ├── README.md
        ├── expected-result.json
        └── bundle/
            └── ... (same structure, manifest.json is invalid JSON)
```

---

## Result Classes

| Class | Meaning | Exit code |
|-------|---------|-----------|
| `PASS` | All checks passed. Bundle is structurally sound and internally consistent. | 0 |
| `FAIL` | Bundle is readable but one or more integrity checks failed. | 1 |
| `ERROR` | Bundle could not be fully processed (missing or malformed file). | 2 |

See `docs/vsc-v2-6-machine-readable-verification-result-schema-draft.md` for the full result class definitions.

---

## PASS Fixture — `pass-basic`

**Path:** `fixtures/pass-basic/bundle`  
**Expected result:** PASS (exit 0)

A minimal valid Evidence Bundle with one chain step and one delta token. Every required file is present. Every checksum in `checksums.sha256` matches its file. The chain token carries valid `baseTokenId` and `latestTokenId`. The manifest is parseable JSON.

**Token IDs:**
- Chain token: `AABB001122CC`
- Base token: `BASE000001AA`
- Delta token (step 1): `DELTA00001BB`

**Checksum count:** 7  
**Delta count:** 1

---

## FAIL Fixture — `fail-checksum-mismatch`

**Path:** `fixtures/fail-checksum-mismatch/bundle`  
**Expected result:** FAIL (exit 1)

Structurally identical to `pass-basic` except the `checksums.sha256` entry for `manifest.json` is deliberately set to an all-zero hash:

```
0000000000000000000000000000000000000000000000000000000000000000  manifest.json
```

The actual `manifest.json` content is valid JSON and its real SHA-256 does not match the recorded hash.

**Expected failed check:** `checksums`  
**Must not return:** PASS or ERROR

---

## ERROR Fixture — `error-malformed-manifest`

**Path:** `fixtures/error-malformed-manifest/bundle`  
**Expected result:** ERROR (exit 2)

Structurally identical to `pass-basic` except `manifest.json` contains intentionally truncated JSON:

```
{ "fixture_id": "error-malformed-manifest", "status": "intentionally truncated
```

The checksum for this malformed file is correctly recorded in `checksums.sha256` (the checksum check passes). The manifest parse step fails with a JSON error.

**Expected failed check:** `manifest`  
**Must not return:** PASS or FAIL

---

## How to Run with Go Verifier

Run from the repository root (`C:\Users\oondr\vsc-code` or equivalent):

```sh
# PASS fixture
go run ./cmd/vsc-go verify-bundle conformance/v2.7/fixtures/pass-basic/bundle

# PASS fixture — JSON output
go run ./cmd/vsc-go verify-bundle --json conformance/v2.7/fixtures/pass-basic/bundle

# FAIL fixture (exit code 1 expected)
go run ./cmd/vsc-go verify-bundle conformance/v2.7/fixtures/fail-checksum-mismatch/bundle

# FAIL fixture — JSON output
go run ./cmd/vsc-go verify-bundle --json conformance/v2.7/fixtures/fail-checksum-mismatch/bundle

# ERROR fixture (exit code 2 expected)
go run ./cmd/vsc-go verify-bundle conformance/v2.7/fixtures/error-malformed-manifest/bundle

# ERROR fixture — JSON output
go run ./cmd/vsc-go verify-bundle --json conformance/v2.7/fixtures/error-malformed-manifest/bundle
```

**Note:** On Windows PowerShell, non-zero exit codes may suppress the next prompt. This is expected. Append `; echo $LASTEXITCODE` to see the exit code explicitly.

---

## How to Compare Expected Results

Each fixture directory contains an `expected-result.json` file with the following fields:

| Field | Description |
|-------|-------------|
| `expected_result` | Top-level result class: `PASS`, `FAIL`, or `ERROR` |
| `expected_exit_code` | Expected CLI exit code: 0, 1, or 2 |
| `expected_checks` | Per-check expected status values |
| `expected_errors` | (Optional) Expected error codes for ERROR fixtures |

**Comparison procedure:**

1. Run the verifier with `--json` against the fixture bundle path.
2. Parse the JSON output.
3. Compare `result` against `expected_result`.
4. Compare each entry in `checks` against `expected_checks`.
5. If any comparison fails, the verifier does not conform to this fixture vector.

**Conformance is per result class, then per check.** Diagnostic differences (timing, byte counts) are not conformance failures.

---

## What This Package Does Not Prove

The conformance package does not prove real-world truth, legal responsibility, identity, or attribution. It only provides stable test fixtures for VSC verifier behavior and result-class comparison.

Specifically:
- A verifier that passes all three fixtures is not certified for production use.
- A PASS result on `pass-basic` does not mean the verifier is complete — only that it handles the minimal required case.
- These fixtures do not test ZIP input, API input, interop receipts, or canonical event validation.
- These fixtures are for structural and behavioral comparison only.

---

## Future Roadmap

| Version | Scope |
|---------|-------|
| v2.7.1 | Node.js `--json` output aligned to v2.6 schema; Node/Go comparison against these fixtures. |
| v2.8 | Node.js / Go result comparison harness; automated fixture runner script. |
| v2.9 | Extended fixture set: missing files, missing delta tokens, PROOF-ONLY class. |
| v3.0 | Signed fixture manifests; HTTP verifier conformance suite. |
