# VSC v2.2 — Conformance Test Vectors Draft

**Status:** Draft  
**Version:** v2.2-draft  
**Date:** 2026-06-21  
**Depends on:** [VSC v2.0 Formal Specification Draft](vsc-v2-0-formal-specification-draft.md), [VSC v2.1 Canonical Event Model Draft](vsc-v2-1-canonical-event-model-draft.md)  
**Reference Implementation:** VSC v1.x (Node.js)

---

> This document defines the compatibility test surface for VSC implementations.
> It specifies test vector categories, expected result classes, input conditions,
> and the compatibility rules an implementation must satisfy to be considered
> conformant. No actual generated test fixtures are created by this document.
> No source code, token formats, or evidence bundle formats are changed.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Relationship to VSC v2.0 and v2.1](#2-relationship-to-vsc-v20-and-v21)
3. [Conformance Principle](#3-conformance-principle)
4. [Result Classes](#4-result-classes)
5. [Minimum Conformance Set](#5-minimum-conformance-set)
6. [Evidence Bundle Test Vectors](#6-evidence-bundle-test-vectors)
7. [Canonical Event Test Vectors](#7-canonical-event-test-vectors)
8. [Checksum Binding Test Vectors](#8-checksum-binding-test-vectors)
9. [Manifest Integrity Test Vectors](#9-manifest-integrity-test-vectors)
10. [Delta Chain Test Vectors](#10-delta-chain-test-vectors)
11. [ZIP Handoff Test Vectors](#11-zip-handoff-test-vectors)
12. [Demo Flow Conformance](#12-demo-flow-conformance)
13. [Interoperability Vectors](#13-interoperability-vectors)
14. [Negative Test Philosophy](#14-negative-test-philosophy)
15. [Conformance Package Layout](#15-conformance-package-layout)
16. [Expected Result File](#16-expected-result-file)
17. [Compatibility Rule](#17-compatibility-rule)
18. [Non-Goals](#18-non-goals)
19. [Security Invariants Tested](#19-security-invariants-tested)
20. [Roadmap](#20-roadmap)

---

## 1. Purpose

This document defines how independent VSC implementations can prove compatibility with the VSC evidence model.

**Conformance** means: given the same evidence input, an implementation must produce the same **result class** — PASS, FAIL, ERROR, or PROOF-ONLY — as every other conformant implementation.

This document defines:
- The result classes and their semantics
- The minimum required test vector set
- The vector categories (valid, invalid, malformed, proof-only)
- The `expected-result.json` format for machine-readable compatibility checking
- The compatibility rule an implementation must satisfy

**This document does not:**
- Create generated test fixture files (that is the scope of the v2.2 implementation milestone)
- Change any VSC source code, token formats, or evidence bundle formats
- Replace the v2.0 or v2.1 specifications — it tests whether they are correctly implemented

This is a draft specification. The actual `conformance/` directory with fixture files will be produced in the v2.2 implementation milestone.

---

## 2. Relationship to VSC v2.0 and v2.1

| Version | Defines | Tested by v2.2 |
|---------|---------|----------------|
| **v2.0** | Evidence model: tokens, bundles, verifier behavior, result semantics | Yes — bundle structure, verifier behavior, result classes |
| **v2.1** | Canonical Event Model: event structure, identity, canonicalization | Yes — event field validation, hash binding, ordering |
| **v2.2** | Conformance test surface: vector categories, expected results, compatibility rules | — (this document) |

Conformance vectors test whether implementations preserve the semantics defined in v2.0 and v2.1. An implementation that passes all required conformance vectors has demonstrated behavioral compatibility with the VSC evidence model — it can produce and verify bundles and events that other conformant implementations will also accept or reject consistently.

---

## 3. Conformance Principle

> **Same input evidence must produce the same result class.**

The core conformance requirement is determinism across implementations:

| Rule | Requirement |
|------|-------------|
| **PASS determinism** | A valid Evidence Bundle must produce PASS on every conformant implementation |
| **FAIL determinism** | An Evidence Bundle with broken integrity must produce FAIL on every conformant implementation |
| **ERROR determinism** | Malformed or unusable input must produce ERROR on every conformant implementation |
| **PROOF-ONLY isolation** | A proof-only artifact must produce PROOF-ONLY, not PASS, on every conformant implementation |
| **No silent repair** | An implementation must not silently correct or repair broken evidence to achieve PASS |
| **No partial PASS** | An implementation must not return PASS if any required check has not passed |
| **Fail-closed** | Any unresolvable inconsistency must result in non-zero exit |

**Implementation freedom:** Within a result class, implementations may produce additional diagnostic messages, counters, warnings, or human-readable output. These do not affect conformance as long as the result class is correct.

---

## 4. Result Classes

VSC v2.2 conformance testing operates with four result classes, defined in v2.0 §12 and reproduced here for reference:

| Result Class | Meaning | Exit Code |
|-------------|---------|-----------|
| **PASS** | All required checks passed. The Evidence Bundle or Canonical Event is complete, internally consistent, and every checksum binding and structural check succeeded. | `0` |
| **FAIL** | At least one required check failed. Evidence integrity is broken — a file was modified, a token is missing, hashes disagree, or the chain is incomplete. | non-zero |
| **ERROR** | The verification context is invalid. The input is malformed, a required argument is missing, JSON cannot be parsed, or an unknown profile is encountered. Distinguished from FAIL — it means verification could not be meaningfully attempted. | non-zero |
| **PROOF-ONLY** | The artifact is recorded as proof material but was not fully reconstructed or verified in this context. Must not be promoted to PASS. | non-zero or implementation-defined |

**Key distinction — FAIL vs ERROR:**
- `FAIL` means verification was attempted and evidence integrity did not hold
- `ERROR` means verification could not be meaningfully attempted due to malformed or missing inputs
- Both must result in non-zero exit
- An implementation must not substitute one for the other in its result class reporting

---

## 5. Minimum Conformance Set

An implementation must produce the correct result class for every vector in the minimum conformance set. Vectors not in this set are optional (recommended) but not required for basic conformance.

| Vector ID | Input Condition | Expected Result |
|-----------|----------------|----------------|
| `MCS-01` | Valid Evidence Bundle, all required files present, all checksums match, chain/manifest consistent | **PASS** |
| `MCS-02` | Bundle missing `manifest.json` | **FAIL** (structural) or **ERROR** (context) |
| `MCS-03` | Bundle missing `checksums.sha256` | **FAIL** or **ERROR** |
| `MCS-04` | `checksums.sha256` present but at least one file has a mismatched digest | **FAIL** |
| `MCS-05` | Bundle missing `base-token.json` | **FAIL** |
| `MCS-06` | Bundle missing `chain-token.json` | **FAIL** |
| `MCS-07` | Bundle missing one or more required delta tokens referenced by chain token | **FAIL** |
| `MCS-08` | `manifest.json` chain references disagree with `chain-token.json` | **FAIL** |
| `MCS-09` | `chain-token.json` is not valid JSON | **ERROR** |
| `MCS-10` | Proof-only artifact passed as full verification input | **PROOF-ONLY**, not PASS |

**Notes:**
- `MCS-02` and `MCS-03` allow either FAIL or ERROR because the appropriate result depends on verifier context (e.g. whether missing required files are treated as structural failure or context error). The implementation must declare its behavior for this ambiguity.
- `MCS-09` must be ERROR, not FAIL — JSON parsing failure means the verifier cannot evaluate the content.

---

## 6. Evidence Bundle Test Vectors

### 6.1 Valid Bundle Vector

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-pass-valid-bundle` |
| Description | Complete Evidence Bundle with all required files, all checksums matching, chain and manifest consistent, all delta tokens present |
| Expected result | **PASS** |
| Required checks | manifest_integrity, checksum_binding, chain_token_consistency, base_token_presence, delta_sequence_integrity |

### 6.2 Missing Required File Vector

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-fail-missing-required-file` |
| Description | Bundle with one required file removed (e.g. `verification-summary.json`) |
| Expected result | **FAIL** |
| Required checks | required_file_presence |
| Notes | The specific missing file may vary; the result must be FAIL regardless of which required file is absent |

### 6.3 Extra Non-Critical File Vector

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-pass-extra-file` |
| Description | Bundle with an additional file not listed in required files (e.g. an unrecognised `.txt` note) |
| Expected result | **PASS** (if all required files pass and the extra file is covered by checksums) or implementation-defined warning |
| Notes | Extra files not in `checksums.sha256` must not silently cause FAIL unless the profile requires all present files to be listed |

### 6.4 Checksum Mismatch Vector

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-fail-checksum-mismatch` |
| Description | Bundle where one file has been modified after export — its SHA-256 digest no longer matches the entry in `checksums.sha256` |
| Expected result | **FAIL** |
| Must not return | PASS |

### 6.5 Manifest Mismatch Vector

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-fail-manifest-mismatch` |
| Description | `manifest.json` references a `base_token_id` that does not match `chain-token.json` |
| Expected result | **FAIL** |
| Must not return | PASS |

### 6.6 Chain Token Mismatch Vector

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-fail-chain-token-mismatch` |
| Description | `chain-token.json` references a `latestTokenId` that does not correspond to the highest-index delta token in the bundle |
| Expected result | **FAIL** |

### 6.7 Delta Gap Vector

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-fail-delta-gap` |
| Description | Bundle where the chain token references N delta steps but only N-1 delta files are present (one middle delta is missing) |
| Expected result | **FAIL** |
| Must not return | PASS |
| Notes | A verifier must detect the gap and report which delta is missing |

---

## 7. Canonical Event Test Vectors

### 7.1 Valid Canonical Event

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-pass-valid-event` |
| Description | Canonical Event with all required fields present and `event_hash` matching canonical content |
| Expected result | **PASS** (structural) |

### 7.2 Missing Required Field

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-fail-event-missing-field` |
| Description | Canonical Event missing one required field (e.g. `sequence_index` absent) |
| Expected result | **FAIL** or **ERROR** depending on whether the event is parseable |

### 7.3 Invalid Event Hash

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-fail-event-invalid-hash` |
| Description | Canonical Event where `event_hash` was computed over different content than the current canonical fields (simulating post-hoc modification) |
| Expected result | **FAIL** |
| Must not return | PASS |

### 7.4 Changed Non-Canonical Metadata

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-pass-event-metadata-changed` |
| Description | Two Canonical Events identical except that one has a different `metadata.display_label` value |
| Expected result | Both events have the **same `event_id` and `event_hash`** — metadata change must not alter event identity |

### 7.5 Changed Canonical Field

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-event-identity-changed` |
| Description | Two Canonical Events identical except that one has a different `output_state_hash` |
| Expected result | The modified event has a **different `event_id` and `event_hash`** — canonical field change must alter event identity |

### 7.6 Duplicate Sequence Index

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-fail-event-duplicate-index` |
| Description | Event sequence containing two events with the same `sequence_index` in the same scope |
| Expected result | **FAIL** |

### 7.7 Sequence Index Gap

| Attribute | Value |
|-----------|-------|
| Vector ID | `vsc-v2.2-fail-event-index-gap` |
| Description | Event sequence with a missing `sequence_index` (e.g. 1, 2, 4 — gap at 3) |
| Expected result | **FAIL** or incomplete-chain result, never silently PASS |

---

## 8. Checksum Binding Test Vectors

Checksum binding verification must occur **before** any token-level semantic check (see v2.0 §10). These vectors test that ordering constraint.

| Vector ID | Input Condition | Expected Result |
|-----------|----------------|----------------|
| `vsc-v2.2-pass-checksum-all-match` | All files in `checksums.sha256` have matching digests | **PASS** (checksum step) |
| `vsc-v2.2-fail-checksum-one-mismatch` | One file has a modified digest | **FAIL** — must be caught before token checks |
| `vsc-v2.2-fail-checksum-file-missing` | A file listed in `checksums.sha256` is absent from the bundle | **FAIL** |
| `vsc-v2.2-warn-file-not-in-checksums` | A file exists in the bundle but is not listed in `checksums.sha256` | **Warning** or profile-defined behavior — must not cause silent PASS |
| `vsc-v2.2-fail-checksum-before-token` | Bundle with a valid chain token but a checksum mismatch on `chain-token.json` itself | **FAIL** at checksum step — token content must not be trusted |

**Ordering invariant test:** Vector `vsc-v2.2-fail-checksum-before-token` specifically tests that a verifier does not evaluate `chain-token.json` content before confirming its checksum is valid. An implementation that parses and trusts a token file before verifying its checksum is not conformant.

---

## 9. Manifest Integrity Test Vectors

| Vector ID | Input Condition | Expected Result |
|-----------|----------------|----------------|
| `vsc-v2.2-pass-manifest-consistent` | `manifest.json` chain references match `chain-token.json` exactly | **PASS** |
| `vsc-v2.2-fail-manifest-wrong-base` | `manifest.chain.base_token_id` does not match `chain-token.json` base ID | **FAIL** |
| `vsc-v2.2-fail-manifest-wrong-latest` | `manifest.chain.latest_token_id` does not match `chain-token.json` latest ID | **FAIL** |
| `vsc-v2.2-fail-manifest-missing-delta` | Manifest lists N-1 deltas but chain token references N | **FAIL** |
| `vsc-v2.2-error-manifest-unknown-schema` | `manifest.json` declares an unsupported schema version field | **ERROR** or profile-defined result — must not be PASS |

---

## 10. Delta Chain Test Vectors

| Vector ID | Input Condition | Expected Result |
|-----------|----------------|----------------|
| `vsc-v2.2-pass-delta-complete` | All delta files present in correct order, all parseable | **PASS** |
| `vsc-v2.2-fail-delta-missing-middle` | Delta sequence 1–99 with delta 47 absent | **FAIL** — gap must be detected and reported |
| `vsc-v2.2-fail-delta-duplicate-index` | Two delta files with the same index | **FAIL** |
| `vsc-v2.2-fail-delta-from-to-mismatch` | A delta file's `fromTokenId` does not equal the previous delta's `toTokenId` | **FAIL** |
| `vsc-v2.2-fail-delta-out-of-order` | Delta files present but index order disagrees with file names | **FAIL** or sort-then-verify according to declared profile |
| `vsc-v2.2-error-delta-malformed-json` | A delta file contains invalid JSON | **ERROR** |

**Silent repair prohibition:** A verifier must not silently repair a broken chain (e.g. by skipping a missing delta and continuing). Any gap must produce FAIL.

---

## 11. ZIP Handoff Test Vectors

A ZIP Handoff Artifact is a transport artifact. Its conformance requirements derive from its source Evidence Bundle.

| Vector ID | Input Condition | Expected Result |
|-----------|----------------|----------------|
| `vsc-v2.2-pass-zip-extracted-verifiable` | ZIP extracted and verified with `verify-bundle` | **PASS** — same result as verifying the source bundle |
| `vsc-v2.2-pass-zip-preserves-structure` | ZIP root is the bundle folder name; extracted layout is identical to source | **PASS** |
| `vsc-v2.2-fail-zip-modified-contents` | A file inside the ZIP was modified before extraction | **FAIL** — checksum binding will catch the modification |
| `vsc-v2.2-error-zip-corrupted` | ZIP file is corrupted and cannot be extracted | **ERROR** |

**Invariants:**
- ZIP must not change bundle file contents — any modification is caught by checksum binding on extraction
- ZIP root layout must match the bundle folder name so `verify-bundle` receives the correct directory structure
- ZIP is a transport artifact, not a new evidence format — it carries no additional integrity guarantees beyond its source bundle

---

## 12. Demo Flow Conformance

The `demo:evidence-flow` command (v1.18) is not itself a conformance requirement — it is an orchestration demonstration. However, each individual step it delegates to is conformance-relevant.

| Step | Conformance-relevant behavior |
|------|------------------------------|
| Export (`bundle:json`) | Must produce a complete, valid Evidence Bundle |
| Verify (`verify-bundle`) | Must apply all minimum conformance checks and return correct result class |
| ZIP (`zip-bundle`) | Must not modify source bundle; extracted ZIP must remain verifiable |
| Summary | Must report the result class accurately — must not show PASS if a step failed |
| Failure propagation | If any step returns non-zero, the demo command must stop and return non-zero |

A conformant implementation of `demo:evidence-flow` semantics must not continue past a failing step. Implementations that suppress step failures to reach the summary screen are not conformant.

---

## 13. Interoperability Vectors

These vectors test the boundary between VSC and external systems.

| Vector ID | Input Condition | Expected Result |
|-----------|----------------|----------------|
| `vsc-v2.2-interop-valid-bundle-ref` | External receipt references a VSC bundle ID that exists and passes verification | Receipt is valid reference; VSC result is PASS |
| `vsc-v2.2-interop-missing-bundle-ref` | External receipt references a VSC bundle ID that does not exist | VSC cannot verify the referenced bundle — ERROR or FAIL depending on verifier context |
| `vsc-v2.2-interop-valid-event-hash-ref` | External receipt references a valid `event_hash` from a verified bundle | Receipt is a valid pointer; event hash PASS is independent of receipt authenticity |
| `vsc-v2.2-interop-result-override-attempt` | External system claims VSC result is PASS despite verifier returning FAIL | The external claim is invalid — VSC result class must not be overridden |
| `vsc-v2.2-interop-boundary-separation` | TBN or CLARIXO receipt added to bundle without modifying canonical bundle files | Receipt as `external_receipt_ref` only; canonical content unchanged; VSC verification result unchanged |

**Interop invariant:** External systems may reference VSC evidence outputs. They must not redefine VSC verification result classes. A conformant implementation must not accept an external override of its FAIL result.

---

## 14. Negative Test Philosophy

Negative test vectors are as important as PASS examples. A verifier that only passes correct bundles is necessary but not sufficient. A verifier is only trustworthy if it also consistently rejects broken evidence.

**Core principles:**

| Principle | Implication |
|-----------|-------------|
| **Rejection matters** | An implementation that returns PASS for a broken bundle is more dangerous than one that returns FAIL for a valid bundle |
| **No silent continuation** | After any failing check, execution must stop or explicitly report before proceeding |
| **No hidden correction** | A verifier must not silently repair invalid evidence (e.g. reconstructing a missing delta, ignoring a checksum mismatch) to achieve PASS |
| **No partial PASS** | PASS means all required checks passed. An implementation may not return PASS after skipping required checks |
| **Every FAIL must be reported** | The verifier must identify which check failed and why — not just exit non-zero without explanation |

**Negative conformance test count:** The minimum conformance set (§5) contains 9 non-PASS vectors. An implementation that passes only `MCS-01` (the valid bundle) has demonstrated 1/10 of minimum conformance.

---

## 15. Conformance Package Layout

When the v2.2 test fixture implementation milestone is reached, conformance vectors will be organized in the following directory structure:

```
conformance/
└── v2.2/
    ├── pass/
    │   ├── valid-json-event-bundle/
    │   │   ├── bundle/                    ← the Evidence Bundle under test
    │   │   └── expected-result.json       ← machine-readable expected outcome
    │   ├── valid-generic-bundle/
    │   │   ├── bundle/
    │   │   └── expected-result.json
    │   └── extra-file-bundle/
    │       ├── bundle/
    │       └── expected-result.json
    ├── fail/
    │   ├── checksum-mismatch/
    │   │   ├── bundle/
    │   │   └── expected-result.json
    │   ├── manifest-mismatch/
    │   │   ├── bundle/
    │   │   └── expected-result.json
    │   ├── delta-gap/
    │   │   ├── bundle/
    │   │   └── expected-result.json
    │   └── missing-base-token/
    │       ├── bundle/
    │       └── expected-result.json
    ├── error/
    │   ├── malformed-json/
    │   │   ├── bundle/
    │   │   └── expected-result.json
    │   └── unknown-profile/
    │       ├── bundle/
    │       └── expected-result.json
    └── proof-only/
        └── proof-artifact/
            ├── artifact/
            └── expected-result.json
```

**Layout rules:**
- Each vector is a self-contained directory containing the input and its `expected-result.json`
- The `bundle/` subdirectory contains the Evidence Bundle (or partial/malformed bundle) under test
- The result class directory (`pass/`, `fail/`, `error/`, `proof-only/`) corresponds to `expected_result` in `expected-result.json`
- Human-readable notes may accompany each vector as a `README.md` inside the vector directory

---

## 16. Expected Result File

Each conformance vector directory contains an `expected-result.json` file that defines the machine-readable expected outcome.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vector_id` | string | Yes | Unique identifier for this conformance vector |
| `profile` | string | Yes | The VSC conformance profile this vector targets (e.g. `"vsc-v2.2-draft"`) |
| `expected_result` | string | Yes | One of: `"PASS"`, `"FAIL"`, `"ERROR"`, `"PROOF-ONLY"` |
| `required_checks` | string[] | Yes | List of check names that must be applied to produce this result |
| `failure_reason` | string | If FAIL | The specific check that must fail (e.g. `"checksum_mismatch"`) |
| `must_not_return` | string[] | No | Result classes that must not be returned for this input |
| `optional_diagnostics` | string[] | No | Additional diagnostic fields an implementation may include |
| `notes` | string | No | Human-readable explanation (not machine-evaluated) |

### Example: PASS Vector

```json
{
  "vector_id": "vsc-v2.2-pass-valid-json-event-bundle",
  "profile": "vsc-v2.2-draft",
  "expected_result": "PASS",
  "required_checks": [
    "manifest_integrity",
    "checksum_binding",
    "chain_token_consistency",
    "base_token_presence",
    "delta_sequence_integrity"
  ],
  "optional_diagnostics": [
    "file_count",
    "bundle_type",
    "chain_hash_prefix"
  ],
  "notes": "Complete valid JSON Event Evidence Bundle. All required files present, all checksums match, chain and manifest consistent."
}
```

### Example: FAIL Vector

```json
{
  "vector_id": "vsc-v2.2-fail-checksum-mismatch",
  "profile": "vsc-v2.2-draft",
  "expected_result": "FAIL",
  "required_checks": [
    "checksum_binding"
  ],
  "failure_reason": "checksum_mismatch",
  "must_not_return": [
    "PASS"
  ],
  "notes": "One file in the bundle has been modified after export. Checksum binding must detect the mismatch and return FAIL before any token-level checks."
}
```

### Example: ERROR Vector

```json
{
  "vector_id": "vsc-v2.2-error-malformed-chain-token",
  "profile": "vsc-v2.2-draft",
  "expected_result": "ERROR",
  "required_checks": [
    "chain_token_parseable"
  ],
  "failure_reason": "malformed_json",
  "must_not_return": [
    "PASS",
    "FAIL"
  ],
  "notes": "chain-token.json contains invalid JSON. Verification cannot be meaningfully attempted. Must return ERROR, not FAIL."
}
```

---

## 17. Compatibility Rule

An implementation is **conformant** with VSC v2.2 if:

1. **Minimum conformance set:** It produces the correct result class for every vector in §5 (`MCS-01` through `MCS-10`)
2. **Result class preservation:** It does not substitute one result class for another (e.g. returning PASS instead of FAIL, or FAIL instead of ERROR)
3. **No silent repair:** It does not silently correct broken evidence to achieve PASS
4. **Diagnostics are additive:** It may produce additional diagnostic output, counters, or messages — these do not affect conformance as long as the result class is correct
5. **Profile declaration:** If it supports a `canonicalization_profile` or conformance profile, it must declare which profiles it supports and must return ERROR for unknown profiles
6. **Complete coverage:** Skipping required vectors means incomplete conformance — partial conformance must be declared as such

**Conformance claim format (proposed):**

An implementation may claim:
- `VSC v2.2 conformant (full)` — all required vectors pass
- `VSC v2.2 conformant (partial: MCS-01 to MCS-07)` — subset of vectors pass, with explicit enumeration of which
- `VSC v2.2 conformant (bundle-only)` — all Evidence Bundle vectors pass; Canonical Event vectors not yet implemented

Partial conformance claims are valid but must be explicit about their coverage.

---

## 18. Non-Goals

| Non-Goal | Rationale |
|----------|-----------|
| **Legal responsibility certification** | Conformance vectors test evidence model behavior, not legal compliance or regulatory certification |
| **Real-world truth proof** | PASS means structural integrity — it does not mean the recorded state reflects real-world truth |
| **Human identification** | Conformance vectors do not include identity verification — actor references are structural fields, not identity proofs |
| **Blockchain requirement** | Conformance is defined over cryptographic hashing and structured token formats, not over distributed ledger participation |
| **Single programming language** | Conformance vectors are language-independent. Any implementation in any language may be tested against them |
| **Security audit replacement** | Passing conformance vectors demonstrates behavioral compatibility with the VSC evidence model. It does not replace security audits, penetration testing, or formal verification of the implementation |
| **Generic unit test framework** | Conformance vectors are evidence-model-specific. They test VSC semantics, not general software correctness |

---

## 19. Security Invariants Tested

The following security invariants (defined in v2.0 §17) must be demonstrated to hold through conformance vectors:

| Invariant | Test Coverage |
|-----------|--------------|
| **No PASS without required files** | `MCS-02` through `MCS-07`, §6.2 |
| **No PASS without checksum integrity** | `MCS-04`, §8, `vsc-v2.2-fail-checksum-mismatch` |
| **No PASS with broken delta chain** | `MCS-07`, §10, `vsc-v2.2-fail-delta-missing-middle` |
| **No PASS with manifest/chain disagreement** | `MCS-08`, §9, `vsc-v2.2-fail-manifest-mismatch` |
| **No PASS for malformed JSON** | `MCS-09`, §10, `vsc-v2.2-error-malformed-chain-token` |
| **No PASS for proof-only artifacts** | `MCS-10`, §11, `vsc-v2.2-proof-only-*` |
| **Checksum before token semantics** | `vsc-v2.2-fail-checksum-before-token` (§8) |
| **No silent repair** | §14, enforced across all FAIL and ERROR vectors |

An implementation that passes all listed vectors has demonstrated that it does not silently promote broken evidence to PASS. This is the minimum trust baseline for a VSC-compatible verifier.

---

## 20. Roadmap

| Version | Title | Scope |
|---------|-------|-------|
| **v2.3** | Interop Receipt Profile Draft | Formal definition of how external systems (TBN, CLARIXO) reference VSC evidence in receipts and attribution records; includes interop vector formalisation |
| **v2.4** | Go Core Prototype Preparation | Interface design for Go implementation of VSC verifier and event canonicalization, based on v2.0–v2.2 specifications |
| **v2.5** | Minimal Go Verifier Prototype | First Go implementation of the VSC verifier, tested against v2.2 conformance vectors |
| **v3.0** | Enterprise Verification Engine | Production-grade multi-bundle, multi-event, policy-driven verification; integration APIs; audit trail generation; full v2.2 conformance |

The v2.2 implementation milestone (distinct from this draft) will produce the actual `conformance/v2.2/` fixture directory. The draft roadmap above reflects the planned sequence; specific version boundaries may shift as work progresses.

---

## Appendix A: Term Glossary

| Term | Definition |
|------|-----------|
| **Conformance vector** | A defined input with a declared expected result class, used to test whether an implementation behaves consistently with the VSC evidence model |
| **Expected result** | The result class (`PASS`, `FAIL`, `ERROR`, `PROOF-ONLY`) that a conformant implementation must produce for a given vector |
| **Result class** | One of the four defined verification outcomes: PASS, FAIL, ERROR, PROOF-ONLY |
| **Minimum conformance set** | The required set of vectors (`MCS-01` to `MCS-10`) that must all pass for basic conformance |
| **Manifest integrity** | The check that `manifest.json` chain references agree with `chain-token.json` |
| **Checksum binding** | The check that every file in `checksums.sha256` matches its SHA-256 digest |
| **Delta sequence integrity** | The check that all delta tokens referenced by the chain token are present, parseable, and in correct order |
| **Canonical event** | The smallest verifiable VSC evidence unit (see v2.1) |
| **Evidence Bundle** | Portable directory artifact containing all files required for verification (see v2.0 §8) |
| **ZIP Handoff Artifact** | Transport-layer ZIP packaging of an Evidence Bundle (see v2.0 §13) |
| **Read-only verification** | Verification that produces a result without modifying the source bundle |
| **Fail-closed behavior** | Any unresolvable inconsistency results in non-zero exit; no silent continuation |
| **Partial conformance** | An implementation that passes a declared subset of conformance vectors; must be explicitly declared as partial |

---

## Appendix B: Required Check Names

The following check names are used in `expected-result.json` `required_checks` fields:

| Check Name | Description |
|------------|-------------|
| `required_file_presence` | All structurally required files are present in the bundle |
| `checksum_binding` | All files in `checksums.sha256` have matching SHA-256 digests |
| `manifest_integrity` | `manifest.json` chain references agree with `chain-token.json` |
| `chain_token_parseable` | `chain-token.json` is valid JSON and has required fields |
| `chain_token_consistency` | Chain token mode, base ID, latest ID, and steps are internally consistent |
| `base_token_presence` | `base-token.json` is present and parseable |
| `delta_sequence_integrity` | All referenced delta tokens are present, parseable, and in correct order |
| `event_field_presence` | All required Canonical Event fields are present |
| `event_hash_consistency` | `event_hash` matches canonicalized event content per declared profile |
| `event_sequence_order` | `sequence_index` values are unique and contiguous within scope |
| `zip_extraction_verifiable` | Extracted ZIP bundle passes `verify-bundle` |

---

*VSC v2.2 Conformance Test Vectors Draft — © DigiEmu / VSC Project*  
*This document is a draft specification. No source code, token formats, or evidence bundle formats are changed.*
