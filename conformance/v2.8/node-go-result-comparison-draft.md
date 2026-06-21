# VSC v2.8 — Node/Go Result Comparison Draft

**Status:** DRAFT  
**Version:** v2.8-draft  
**Date:** 2026-06-21

---

## 1. Purpose

This document defines how verification results from the Node.js reference implementation and the Go verifier prototype should be compared against the v2.7 conformance fixture set.

v2.8 is a **draft specification**, not an implementation. It describes the comparison model, defines which fields are mandatory for equivalence, and specifies how a future comparison runner should behave. No comparison runner is implemented in this release.

**Primary comparison target:** result-class equivalence. Two verifiers are conformant on a given fixture if and only if they produce the same `result` class (`PASS`, `FAIL`, `ERROR`, or `PROOF-ONLY`).

**Basis:** comparison is grounded in the v2.7 conformance fixtures (`conformance/v2.7/fixture-index.json`) and the expected-result files (`expected-result.json`) in each fixture directory. Neither implementation is the arbiter — the expected-result file is.

---

## 2. Relationship to Previous Releases

| Release | Contribution |
|---------|-------------|
| **v2.0** | Formal evidence model |
| **v2.1** | Canonical Event Model |
| **v2.2** | Conformance Test Vectors (abstract) |
| **v2.3** | Interop Receipt Profile |
| **v2.4** | Go Core Prototype Preparation |
| **v2.5** | Minimal Go Verifier Prototype — `cmd/vsc-go verify-bundle` |
| **v2.6** | Machine-readable Verification Result Schema |
| **v2.6.1** | Go `--json` output aligned to v2.6 schema |
| **v2.7** | Conformance Fixture Package — PASS / FAIL / ERROR bundles |
| **v2.8** | **This document.** Node/Go result comparison model |

v2.8 consumes the output surface defined in v2.6 and exercises it against the fixtures defined in v2.7. v2.8.1 will implement the runner.

---

## 3. Comparison Principle

**Same fixture input must produce the same result class.**

A verifier is conformant on a fixture vector if its output `result` matches the fixture's `expected_result`. If two verifiers both produce the expected result, their comparison outcome for that fixture is `COMPARE_PASS`.

**What is compared (mandatory):**
- `result` — top-level result class
- Per-check `status` values for the core six checks
- Exit code class (0 = PASS, 1 = FAIL, 2 = ERROR)

**What is compared (secondary / informational):**
- Diagnostic counts when available
- Bundle metadata fields when parseable

**What is not compared:**
- Human-readable CLI text output
- Absolute paths
- Timing fields (`duration_ms`)
- Specific wording in `message` fields
- JSON key ordering
- Verifier version strings

Failing to produce identical wording is not a comparison failure. Failing to produce the same result class is.

---

## 4. Compared Implementations

| ID | Type | Language | Command |
|----|------|----------|---------|
| `node-reference` | Reference | JavaScript (Node.js) | `npm run vsc -- verify-bundle <path>` |
| `go-verifier` | Prototype | Go | `go run ./cmd/vsc-go verify-bundle --json <path>` |

**Implementation identity does not affect fixture truth.** The `expected_result` in each fixture's `expected-result.json` is the ground truth. Neither Node.js nor Go is privileged. If both disagree with the expected result, both are non-conformant.

Future third-party verifier implementations may participate in comparison by producing v2.6-schema-conformant JSON output for the same fixture bundle paths. The comparison model applies to any implementation that:

1. Accepts a bundle folder path.
2. Produces a JSON output with `profile: "vsc-verification-result-v2.6-draft"` or later.
3. Maps result classes to exit codes as defined in §6 of the v2.6 schema draft.

---

## 5. Fixture Set

The v2.8 comparison uses the three fixtures defined in `conformance/v2.7/`:

| Fixture ID | Bundle path | Expected result | Expected exit code |
|-----------|-------------|-----------------|-------------------|
| `pass-basic` | `conformance/v2.7/fixtures/pass-basic/bundle` | `PASS` | 0 |
| `fail-checksum-mismatch` | `conformance/v2.7/fixtures/fail-checksum-mismatch/bundle` | `FAIL` | 1 |
| `error-malformed-manifest` | `conformance/v2.7/fixtures/error-malformed-manifest/bundle` | `ERROR` | 2 |

The authoritative fixture list is `conformance/v2.7/fixture-index.json`. A future runner must read this file to discover fixture paths rather than hardcoding them.

**Fixture contents must not be modified during comparison.** The comparison runner is read-only with respect to fixture bundle directories.

---

## 6. Hard Comparison Fields

Hard fields are mandatory for conformance comparison. A mismatch in any hard field is a `COMPARE_FAIL` outcome for that fixture vector.

| Field | Description |
|-------|-------------|
| `result` | Top-level result class. Must match `expected_result` from fixture. |
| `expected_result` | Taken from `fixtures/<id>/expected-result.json`. The ground truth. |
| `exit_code_class` | Whether exit code is 0 (PASS), 1 (FAIL), or 2 (ERROR). Must match expected. |
| `checks.required_files.status` | Must match expected check status. |
| `checks.checksums.status` | Must match expected check status. |
| `checks.chain_token.status` | Must match expected check status. |
| `checks.base_token.status` | Must match expected check status. |
| `checks.delta_tokens.status` | Must match expected check status. |
| `checks.manifest.status` | Must match expected check status. |

**Mismatch rule:** if `result` from the verifier does not equal `expected_result` from the fixture, the comparison outcome is `COMPARE_FAIL` regardless of any other field values. A verifier that returns `PASS` for a fixture with `expected_result: "FAIL"` is non-conformant on that vector.

---

## 7. Soft Comparison Fields

Soft fields are compared when available. A mismatch in a soft field does not cause `COMPARE_FAIL` on its own, but it is recorded in the comparison report as a divergence.

| Field | Description |
|-------|-------------|
| `diagnostics.checksums_verified` | Should match across implementations for the same fixture. |
| `diagnostics.checksums_expected` | Should match across implementations for the same fixture. |
| `diagnostics.delta_tokens_found` | Should match. |
| `diagnostics.delta_tokens_expected` | Should match. |
| `bundle.chain_token_id` | Should match the chain token `id` from the fixture. |
| `bundle.base_token_id` | Should match `baseTokenId` from chain-token.json. |
| `bundle.latest_token_id` | Should match `latestTokenId` from chain-token.json. |
| `warnings` count | Implementations may differ; recorded informally. |
| `errors[*].code` | For ERROR fixtures, the error code should be consistent. |

Soft-field divergences between implementations on the same fixture may indicate implementation-specific behavior worth investigating, but do not fail the comparison.

---

## 8. Ignored Fields

These fields are explicitly excluded from comparison. Differences in ignored fields are neither conformance failures nor soft divergences.

| Field | Reason for exclusion |
|-------|---------------------|
| `input.resolved_path` | Absolute paths are machine-specific. |
| `input.path` | May be formatted differently (slashes, relative vs absolute). |
| `diagnostics.duration_ms` | Runtime-dependent; not deterministic. |
| `diagnostics.bytes_read` | Implementation-dependent. |
| `verifier.name` | Implementation identity, not evidence quality. |
| `verifier.version` | May differ between builds. |
| `verifier.implementation` | Free-form label. |
| `checks[*].message` | Human-readable wording may differ. |
| `timestamps.started_at` | Wall-clock time. |
| `timestamps.completed_at` | Wall-clock time. |
| `metadata` | Free-form implementation-specific. |
| JSON key ordering | JSON objects are unordered. |
| Whitespace / indentation | Formatting only. |

---

## 9. Allowed Differences

Conformant implementations may differ in the following ways without failing comparison:

- **Verifier name and version** — `"vsc-go"` vs `"vsc-node"` or any other string.
- **Implementation language** — `"go"` vs `"javascript"`.
- **Message wording** — `"checksum mismatch: manifest.json"` vs `"manifest.json: hash mismatch"`.
- **Absolute path representation** — Windows backslash vs forward slash.
- **Additional diagnostic fields** — an implementation may report more diagnostic counters.
- **Additional metadata fields** — implementation-specific keys under `metadata`.
- **JSON formatting** — indentation level, key ordering.
- **Partial diagnostics** — `null` for uncomputed diagnostics is acceptable.
- **NOT_IMPLEMENTED check entries** — checks not yet implemented may be marked `NOT_IMPLEMENTED`; this is allowed as long as the overall `result` is still correct.

---

## 10. Disallowed Differences

The following differences always constitute a conformance failure:

- **PASS vs FAIL mismatch** — one implementation returns `PASS`, the other returns `FAIL` for the same fixture.
- **FAIL vs ERROR mismatch** — `FAIL` and `ERROR` are distinct result classes; conflating them is non-conformant.
- **PASS when expected FAIL or ERROR** — a verifier that returns `PASS` for a fixture with an injected fault is non-conformant regardless of other field values.
- **Missing `result` field** — a result document without a `result` field cannot be compared.
- **Mutating fixture contents** — a verifier that writes to the bundle directory during verification violates the read-only boundary and is non-conformant.
- **Relabelling result class** — a wrapper or adapter that changes `"FAIL"` to `"PASS"` in the JSON output before comparison is non-conformant.
- **Omitting required check entries** — omitting a check from the `checks` object when it was executed is non-conformant if the check is in the hard comparison set.

---

## 11. Comparison Result Classes

| Class | Meaning |
|-------|---------|
| `COMPARE_PASS` | Both implementations produced the expected result class. All hard fields match. |
| `COMPARE_FAIL` | At least one implementation produced a result class that does not match the expected result, or a hard field mismatches. |
| `COMPARE_ERROR` | The comparison itself could not be completed — e.g. one implementation produced unreadable JSON, or a fixture could not be read. |
| `COMPARE_INCOMPLETE` | One or more hard checks are `NOT_IMPLEMENTED` in at least one implementation. The comparison cannot be completed for those checks. Overall comparison is inconclusive. |

**`COMPARE_PASS` does not mean PASS on all fixtures** — it means the comparison passed for a specific fixture vector. A suite summary is the aggregate of all per-fixture comparison results.

**`COMPARE_INCOMPLETE` must not be reported as `COMPARE_PASS`.** An implementation with unimplemented checks may still participate in comparison for the checks it does implement, but the overall suite summary must reflect the incompleteness.

---

## 12. Expected Future Runner Behavior

The v2.8.1 comparison runner (not yet implemented) should behave as follows:

1. **Read** `conformance/v2.7/fixture-index.json` to discover fixture list.
2. **For each fixture:**
   a. Run `go run ./cmd/vsc-go verify-bundle --json <bundle-path>` and capture stdout.
   b. Run the Node.js verifier in JSON-output mode and capture stdout. (Requires v2.7 Node adapter or v2.8.2 adapter.)
   c. Parse both JSON outputs.
   d. Read `<fixture-dir>/expected-result.json` for ground truth.
   e. Compare `result` from each output against `expected_result`.
   f. Compare each core check status in the hard fields list.
   g. Compare soft fields where both outputs contain them.
   h. Produce a per-fixture `comparison_result` class.
3. **Produce a summary table** (see §13).
4. **Exit non-zero** if any fixture produces `COMPARE_FAIL` or `COMPARE_ERROR`.
5. **Exit with a specific code** for `COMPARE_INCOMPLETE` to distinguish from clean pass.

The runner must be read-only: it must never write to fixture bundle directories.

---

## 13. Minimal Future Summary Table

A conformance runner should produce a summary table with at minimum:

| Column | Description |
|--------|-------------|
| `fixture_id` | The fixture identifier from `fixture-index.json`. |
| `expected_result` | The expected result class from `expected-result.json`. |
| `go_result` | The result class produced by the Go verifier. |
| `node_result` | The result class produced by the Node.js verifier. |
| `comparison_result` | `COMPARE_PASS`, `COMPARE_FAIL`, `COMPARE_ERROR`, or `COMPARE_INCOMPLETE`. |
| `notes` | Any soft-field divergences or warnings. |

The runner may emit this table as Markdown, plain text, or a structured JSON report. Structured JSON output should use a profile identifier such as `vsc-comparison-report-v2.8-draft`.

---

## 14. Example Comparison Matrix

This table illustrates the expected output of a conformant runner against the v2.7 fixture set:

| Fixture ID | Expected | Go result | Node result | Comparison |
|-----------|---------|-----------|-------------|------------|
| `pass-basic` | PASS | PASS | PASS | **COMPARE_PASS** |
| `fail-checksum-mismatch` | FAIL | FAIL | FAIL | **COMPARE_PASS** |
| `error-malformed-manifest` | ERROR | ERROR | ERROR | **COMPARE_PASS** |

All three fixtures produce `COMPARE_PASS` when both implementations are conformant. Suite summary: **3/3 COMPARE_PASS**.

**Non-conformance example:**

| Fixture ID | Expected | Go result | Node result | Comparison |
|-----------|---------|-----------|-------------|------------|
| `fail-checksum-mismatch` | FAIL | FAIL | PASS | **COMPARE_FAIL** |

If the Node.js verifier returned `PASS` for the checksum-mismatch fixture, the suite would produce `COMPARE_FAIL` for that vector. The Node.js implementation would be non-conformant on that fixture.

---

## 15. Security and Boundary Rules

1. **Comparison reports are not evidence themselves.** A `COMPARE_PASS` report does not carry the authority of the underlying bundle verification. It is a report about verifier behavior, not about the evidence bundle.

2. **Comparison does not prove real-world truth.** Demonstrating that two verifiers agree on a conformance fixture says nothing about real-world events, decisions, legal responsibility, or identity.

3. **Comparison does not prove identity or attribution.** A comparison report does not identify who produced the evidence bundle or who ran the verifiers.

4. **Comparison must not mutate source fixtures.** The runner is read-only. Fixture bundle contents must be identical before and after any comparison run.

5. **Comparison must not weaken verifier semantics.** A comparison runner that normalizes `FAIL` to `PASS` in order to produce `COMPARE_PASS` is non-conformant. Comparison is an observation, not a transformation.

6. **External systems may reference a comparison report but must not redefine it.** A system operating under the v2.3 Interop Receipt Profile may note that a comparison was run and produced `COMPARE_PASS`. It must not relabel the result or claim it implies verification semantics it does not carry.

---

## 16. Roadmap

| Release | Scope |
|---------|-------|
| **v2.8.1** | Implement comparison runner script (Go or Node.js). Reads fixture-index.json. Runs Go `--json`. Produces comparison table. Exits non-zero on COMPARE_FAIL. |
| **v2.8.2** | Node.js JSON output adapter: produce v2.6-schema JSON from `verifyEvidenceBundle.js` output for comparison. |
| **v2.9** | CI conformance check: GitHub Actions or equivalent. Runs comparison runner on every commit. Blocks merge on COMPARE_FAIL. |
| **v3.0** | Enterprise Verification Profile: signed comparison reports, multi-bundle batch comparison, HTTP comparison API. |
