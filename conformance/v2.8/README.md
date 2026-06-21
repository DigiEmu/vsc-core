# VSC v2.8 — Node/Go Result Comparison Draft

**Status:** DRAFT  
**Version:** v2.8-draft  
**Date:** 2026-06-21

---

## Purpose

This package defines how verification results from the Node.js reference implementation and the Go verifier prototype should be compared for equivalence against the v2.7 conformance fixture set.

---

## What v2.8 Defines

- A **comparison model** specifying which result fields are mandatory for equivalence (hard fields) and which are informational (soft fields).
- **Comparison result classes**: `COMPARE_PASS`, `COMPARE_FAIL`, `COMPARE_ERROR`, `COMPARE_INCOMPLETE`.
- A **machine-readable comparison profile** (`comparison-profile.json`) listing implementations, field classifications, and fixture dependency.
- The **expected future runner behavior** for a v2.8.1 comparison script.
- An **example comparison matrix** showing the expected 3/3 COMPARE_PASS outcome for the v2.7 fixture set.

---

## What v2.8 Does Not Implement

- No comparison runner script (deferred to v2.8.1).
- No Node.js JSON output adapter (deferred to v2.8.2).
- No CI integration (deferred to v2.9).
- No changes to Go verifier, Node.js verifier, or fixture contents.

---

## Fixture Dependency

v2.8 depends on the v2.7 fixture package:

```
conformance/v2.7/fixture-index.json          — fixture list
conformance/v2.7/fixtures/pass-basic/        — PASS vector
conformance/v2.7/fixtures/fail-checksum-mismatch/   — FAIL vector
conformance/v2.7/fixtures/error-malformed-manifest/ — ERROR vector
```

Each fixture directory contains an `expected-result.json` that defines the ground truth for that vector.

---

## Hard vs Soft Comparison

**Hard fields** — a mismatch is `COMPARE_FAIL`:
- `result` (top-level result class)
- Exit code class (0/1/2)
- All six core check statuses: `required_files`, `checksums`, `chain_token`, `base_token`, `delta_tokens`, `manifest`

**Soft fields** — a mismatch is recorded but does not fail comparison:
- `diagnostics.checksums_verified`, `delta_tokens_found`, etc.
- `bundle.chain_token_id`, `base_token_id`, `latest_token_id`

**Ignored fields** — not compared:
- `input.resolved_path`, timing fields, verifier name/version, message wording, JSON formatting

See `node-go-result-comparison-draft.md` §6–§8 for the full field tables.

---

## Runner (v2.8.2 — current)

Human-readable table (v2.8.2 — improved formatting):

```sh
node scripts/compareConformanceResults.js
npm run vsc -- compare:fixtures
```

Machine-readable JSON output (v2.8.2 — new):

```sh
node scripts/compareConformanceResults.js --json
npm run vsc -- compare:fixtures --json
```

The `--json` mode emits only valid JSON to stdout (no mixed output). Intended for automation and future CI usage. Profile: `vsc-node-go-comparison-result-v2.8.2`.

Expected human-readable output:
```
fixture_id                       expected   actual     exp_exit   act_exit   comparison
pass-basic                       PASS       PASS       0          0          COMPARE_PASS
fail-checksum-mismatch           FAIL       FAIL       1          1          COMPARE_PASS
error-malformed-manifest         ERROR      ERROR      2          2          COMPARE_PASS

Final result: COMPARE_PASS
```

Exit codes: 0 = COMPARE_PASS, 1 = COMPARE_FAIL, 2 = COMPARE_ERROR, 3 = COMPARE_INCOMPLETE.

Comparison semantics are unchanged from v2.8/v2.8.1.

## Future Node Adapter

The v2.8.2 runner currently compares Go verifier output only. The v2.8.3/v2.9 runner will:

1. Read `conformance/v2.7/fixture-index.json`.
2. Run `go run ./cmd/vsc-go verify-bundle --json <path>` for each fixture.
3. Run the Node.js verifier in JSON-output mode for each fixture.
4. Compare hard fields against `expected-result.json`.
5. Produce a summary table.
6. Exit non-zero on any `COMPARE_FAIL`.

---

## Boundary

Comparison reports are not evidence. `COMPARE_PASS` does not prove real-world truth, identity, legal responsibility, or attribution. The comparison package is a tool for verifier behavioral alignment only.
