# VSC v2.4 — Go Core Prototype Preparation

**Status:** Draft  
**Version:** v2.4-draft  
**Date:** 2026-06-21  
**Depends on:** [VSC v2.0](vsc-v2-0-formal-specification-draft.md), [VSC v2.1](vsc-v2-1-canonical-event-model-draft.md), [VSC v2.2](vsc-v2-2-conformance-test-vectors-draft.md), [VSC v2.3](vsc-v2-3-interop-receipt-profile-draft.md)  
**Reference Implementation:** VSC v1.x (Node.js) — unchanged by this document

---

> This document defines the preparation boundary, responsibilities, conformance
> requirements, and migration path for a future Go-based VSC verification core.
> **No Go source files are created by this document. No Go modules are initialized.
> No existing source code, token formats, or evidence bundle formats are changed.**

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Relationship to VSC v2.0–v2.3](#2-relationship-to-vsc-v20v23)
3. [Why Go Core](#3-why-go-core)
4. [Reference Implementation Boundary](#4-reference-implementation-boundary)
5. [Candidate Go Core Responsibilities](#5-candidate-go-core-responsibilities)
6. [Responsibilities That Should Remain Outside Go Core](#6-responsibilities-that-should-remain-outside-go-core)
7. [Minimal Go Prototype Scope](#7-minimal-go-prototype-scope)
8. [Non-Goals for the First Go Prototype](#8-non-goals-for-the-first-go-prototype)
9. [CLI Candidate Design](#9-cli-candidate-design)
10. [Machine-Readable Result Format](#10-machine-readable-result-format)
11. [Conformance Requirement](#11-conformance-requirement)
12. [Canonical Event Support](#12-canonical-event-support)
13. [Interop Receipt Support](#13-interop-receipt-support)
14. [Security Requirements](#14-security-requirements)
15. [Performance Considerations](#15-performance-considerations)
16. [Suggested Future Repository Layout](#16-suggested-future-repository-layout)
17. [Migration Path](#17-migration-path)
18. [Risk Controls](#18-risk-controls)
19. [Non-Goals](#19-non-goals)
20. [Roadmap](#20-roadmap)

---

## 1. Purpose

This document defines the **preparation boundary** for a future Go Core prototype of the VSC verifier. It answers three questions:

1. **What should a future Go Core do?** — the candidate responsibilities and minimal prototype scope
2. **What should it not do?** — the explicit boundary to prevent scope creep and semantic drift
3. **How do we get there safely?** — the migration path and risk controls

**v2.4 does not implement Go code.** It does not initialize a Go module, create Go source files, or change any part of the existing v1.x Node.js reference implementation. It is a planning and boundary-definition document.

**Why prepare now?** The v2.0–v2.3 specification drafts have established a stable, language-independent evidence model with defined verification semantics, conformance test vectors, and interoperability boundaries. This creates the right moment to define what a future Go Core should look like — before implementation begins — so that it can be built correctly against the specification rather than reverse-engineered from the Node.js code.

**The Node.js v1.x implementation remains the current reference implementation.** It will not be deprecated, replaced, or modified by the Go Core work. The Go Core is a second implementation of the same specification, not a rewrite.

---

## 2. Relationship to VSC v2.0–v2.3

| Version | Defines | Go Core dependency |
|---------|---------|-------------------|
| **v2.0** | Formal evidence model: tokens, bundles, verifier behavior, result semantics | **Primary specification** — Go Core implements this |
| **v2.1** | Canonical Event model: event structure, identity, canonicalization | **Secondary** — first prototype may support bundle-level event metadata only |
| **v2.2** | Conformance test vectors: minimum compatibility set, expected results | **Conformance gate** — Go Core must pass before being published |
| **v2.3** | Interop Receipt Profile: external reference boundaries | **Interface boundary** — Go Core exposes machine-readable results; receipts are external |
| **v2.4** | **Go Core Prototype Preparation** | — (this document) |

The Go Core will be a conformance-tested, language-independent implementation of the v2.0 evidence model, validated against v2.2 test vectors, and designed to expose machine-readable results that v2.3-conformant receipt systems can reference.

---

## 3. Why Go Core

The Node.js v1.x reference implementation is well-suited for rapid development, scripting, and evidence flow orchestration. A Go Core addresses complementary needs:

| Motivation | Detail |
|-----------|--------|
| **Portable static binaries** | A Go verifier compiles to a single binary with no runtime dependency. Deploy on Windows, Linux, or macOS without Node.js installed. |
| **Fast Evidence Bundle verification** | Go's native file I/O and hashing libraries enable efficient streaming SHA-256 computation over large bundles without subprocess overhead. |
| **Efficient hashing and file traversal** | Go's `crypto/sha256` and `filepath.Walk` are well-suited to the checksum binding verification loop over hundreds of files. |
| **Enterprise CLI deployment** | Organizations deploying VSC verification in CI/CD pipelines or air-gapped environments prefer single-binary tools with no package manager dependency. |
| **Future server-side verifier services** | A Go binary can be embedded in a verification service, a Docker container, or a serverless function handler without bundling a Node.js runtime. |
| **Reduced runtime dependency footprint** | Verification of audit evidence in regulated environments benefits from minimal external dependencies — Go's standard library covers most of the required operations. |

These motivations are additive, not replacements. The Node.js reference implementation retains its role for orchestration, scripting, and development-time workflows.

---

## 4. Reference Implementation Boundary

| Aspect | Node.js v1.x | Go Core |
|--------|-------------|---------|
| **Status** | Current reference implementation | Planned second implementation |
| **Specification authority** | Authoritative behavioral reference | Must conform to the same v2.0 specification |
| **Conformance** | Implicit (defines the behavior) | Must pass v2.2 conformance vectors explicitly |
| **Scope** | Full CLI — verification, export, zip, showcase, benchmark, demo | Verification only (initial prototype) |
| **Deprecation** | Not deprecated by Go Core work | Not a replacement — an addition |

**Go Core must not redefine VSC semantics.** If the Go Core produces a different result class than the Node.js implementation for the same input bundle, that is a conformance failure in the Go Core, not a reason to change the specification.

**Semantic drift** — gradual divergence between implementations in how they interpret edge cases — is the primary risk of a second implementation. The v2.2 conformance vectors are the tool for detecting and preventing it.

---

## 5. Candidate Go Core Responsibilities

The following are the responsibilities a conformant Go Core should implement, based on the v2.0 formal specification:

| Responsibility | v2.0 Reference |
|---------------|---------------|
| **Evidence Bundle verification** | §8, §11 — read-only, fail-closed |
| **Required file presence checks** | §8 — all required files must be present |
| **Manifest integrity checks** | §9 — manifest chain references vs. chain-token.json |
| **Checksum binding verification** | §10 — re-compute SHA-256 over all listed files; verify before token checks |
| **Chain Token consistency checks** | §7 — parse chain-token.json; verify base ID, latest ID, delta sequence |
| **Base Token presence and consistency checks** | §5 — base-token.json present and parseable |
| **Delta Token sequence validation** | §6 — all referenced deltas present, parseable, in correct order, no gaps |
| **Canonical Event validation** | §v2.1 — event field presence, event_hash consistency (later milestone) |
| **Result class emission** | §12 — PASS / FAIL / ERROR / PROOF-ONLY with correct semantics |
| **Machine-readable output** | §10 (this document) — JSON result format |
| **Non-zero exit on FAIL or ERROR** | §11 v2.0 — fail-closed behavior |

---

## 6. Responsibilities That Should Remain Outside Go Core

The following should not be part of the Go Core, at least for the initial prototype:

| Responsibility | Reason |
|---------------|--------|
| **Showcase generation** | Display/HTML concern; no evidence verification value |
| **HTML gallery export** | UI concern; better served by the Node.js toolchain |
| **Marketing pages** | Out of scope for a verifier binary |
| **Visual demos** | Scripting and orchestration concern |
| **Experimental benchmark visualization** | Data analysis concern |
| **Partner-specific integrations** | TBN, CLARIXO receipt generation is a v2.3+ concern; not first prototype |
| **Evidence Bundle export** | `exportJsonEventBundle.js` logic is creation-side; Go Core is verification-side |
| **ZIP creation** | `zipEvidenceBundle.js` is packaging; Go Core verifies extracted bundles |
| **High-level orchestration** | `demoEvidenceFlow.js` orchestration remains in Node.js |

**Rationale:** A Go Core that tries to replicate all v1.x features becomes a full rewrite with high risk of semantic drift. A focused verifier core is easier to conformance-test, easier to audit, and more deployable in constrained environments.

---

## 7. Minimal Go Prototype Scope

The first Go prototype should implement exactly the minimum required to verify a VSC Evidence Bundle and return a machine-readable result. Nothing more.

**Step-by-step prototype behavior:**

```
Input: path to an Evidence Bundle directory

1. Validate that the path exists and is a directory
2. Check required files are present
   - manifest.json
   - checksums.sha256
   - chain-token.json
   - base-token.json
   - delta-tokens/ directory
3. Parse checksums.sha256
4. Re-compute SHA-256 for every listed file
5. Compare computed hashes to listed hashes
   → FAIL immediately on any mismatch (before token parsing)
6. Parse chain-token.json
   → ERROR if not valid JSON
7. Parse base-token.json
   → ERROR if not valid JSON
8. List delta token files in delta-tokens/
9. Validate all delta tokens referenced by chain-token.json are present and parseable
   → FAIL on gap, duplicate, or mismatch
10. Parse manifest.json
11. Compare manifest chain references to chain-token.json
    → FAIL on mismatch
12. Emit machine-readable verification result: PASS / FAIL / ERROR / PROOF-ONLY
13. Exit 0 on PASS; exit non-zero on FAIL, ERROR, or PROOF-ONLY
```

This is the complete minimal prototype scope. Canonical Event validation and receipt support are later milestones.

---

## 8. Non-Goals for the First Go Prototype

| Non-Goal | Rationale |
|----------|-----------|
| **Full rewrite of VSC** | Go Core is a focused verifier, not a complete replacement of the v1.x toolchain |
| **Replacement of Node.js reference implementation** | Node.js v1.x remains the reference; Go Core is a second conforming implementation |
| **Showcase rebuild** | Not a verification concern |
| **New token format** | Token formats are defined by v2.0 and must not change during Go Core work |
| **New evidence bundle format** | Same constraint — format stability is essential for conformance testing |
| **Partner-specific receipt implementation** | TBN and CLARIXO receipts are v2.3 concerns; not first prototype |
| **Legal or identity verification** | Outside VSC scope at all implementation levels |
| **Parallel verification** | Streaming single-threaded verification is sufficient for prototype; parallelism is a v3.0 concern |

---

## 9. CLI Candidate Design

The future Go Core CLI should follow the same naming and result conventions as the Node.js CLI to minimize relearning for users of both implementations.

**Candidate commands:**

```bash
# Verify a bundle, human-readable output
vsc-go verify-bundle output/json-event-bundles/vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13

# Verify a bundle, machine-readable JSON output
vsc-go verify-bundle --json output/json-event-bundles/vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13

# Print version and build info
vsc-go version
```

**Design requirements:**

| Requirement | Rule |
|-------------|------|
| **Result class preservation** | The Go CLI must return the same result class as the Node.js verifier for the same input |
| **Windows path support** | The Go CLI must handle Windows-style paths (`output\json-event-bundles\...`) correctly |
| **Non-zero exit on FAIL or ERROR** | Exit code 0 means PASS only; any other result exits non-zero |
| **Fail-closed** | Unresolvable errors must cause immediate non-zero exit, not silent continuation |
| **Human-readable by default** | The default output is human-readable terminal output, consistent in style with the Node.js verifier |
| **Machine-readable on request** | `--json` flag produces a JSON verification result (see §10) |

---

## 10. Machine-Readable Result Format

A future Go verification result in JSON format should follow this structure. This is a candidate draft — field names may be refined before v2.5.

```json
{
  "profile": "vsc-v2.4-draft",
  "verifier": {
    "name": "vsc-go",
    "version": "prototype",
    "implementation": "go"
  },
  "bundle": {
    "path": "output/json-event-bundles/vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13",
    "type": "JSON Event Evidence Bundle"
  },
  "result": "PASS",
  "checks": {
    "manifest_integrity": "PASS",
    "checksum_binding": "PASS",
    "chain_token_consistency": "PASS",
    "base_token_presence": "PASS",
    "delta_sequence_integrity": "PASS"
  },
  "diagnostics": {
    "file_count": 110,
    "chain_token_id": "ED9566562A13",
    "base_token_id": "408C8C13C4D4",
    "latest_token_id": "ED9566562A13",
    "delta_count": 99
  }
}
```

**Schema rules:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `profile` | string | Yes | Verifier profile version |
| `verifier.name` | string | Yes | Verifier binary name |
| `verifier.version` | string | Yes | Verifier version string |
| `verifier.implementation` | string | Yes | `"go"` for the Go Core |
| `bundle.path` | string | Yes | Path to the verified bundle |
| `bundle.type` | string | Yes | Detected bundle type |
| `result` | string | Yes | `"PASS"`, `"FAIL"`, `"ERROR"`, or `"PROOF-ONLY"` |
| `checks` | object | Yes | Per-check results — each must be a result class string |
| `diagnostics` | object | No | Additional metadata — may vary between versions |

**Invariant:** The top-level `result` field is the canonical result class. It must agree with per-check results — no check can be `"FAIL"` while `result` is `"PASS"`.

---

## 11. Conformance Requirement

The Go Core must pass the v2.2 conformance vectors before it is published as a conformant VSC implementation.

**Conformance rule:**

> For every v2.2 minimum conformance set vector (`MCS-01` to `MCS-10`), the Go Core must produce the same expected result class as defined in `expected-result.json`.

**Conformance verification procedure (planned):**

1. Generate v2.2 conformance fixture bundles (v2.2 implementation milestone)
2. Run Node.js `verify-bundle` against each fixture — record result class
3. Run Go Core `verify-bundle` against the same fixtures — record result class
4. Compare: both must produce the same result class for every fixture
5. Any divergence is a conformance failure in the Go Core

**Allowed divergence:** Diagnostic messages, file counts, and human-readable output may differ between implementations. Result class must not differ.

**Semantic drift detection:** Running both verifiers against every new Evidence Bundle generated by the Node.js reference implementation is a recommended ongoing practice once the Go Core prototype exists.

---

## 12. Canonical Event Support

The first Go prototype focuses on bundle-level verification (§7). Canonical Event validation (v2.1) is a later milestone.

**Planned progression:**

| Milestone | Canonical Event support |
|-----------|------------------------|
| **First prototype (v2.5)** | Validates presence of event metadata files (`event-schema.json`, `event-summary.json`) as part of required file checks for JSON Event Evidence Bundles |
| **v2.6** | Parses `event-summary.json` and validates session_id field presence |
| **Post v2.6** | Full v2.1 Canonical Event field validation, `event_hash` consistency, `sequence_index` ordering |

**Requirements for any Canonical Event support:**
- Canonical JSON handling must be deterministic — the same event fields must always produce the same hash
- Unknown fields must follow the declared `canonicalization_profile` — the Go Core must return ERROR for unknown profiles, not silently PASS
- No semantic drift from v2.1 definitions

---

## 13. Interop Receipt Support

**First prototype scope:** None. The Go Core's first milestone is verification only.

**Future integration path:**

1. Go Core produces machine-readable JSON verification results (§10)
2. External receipt systems (TBN, CLARIXO, workflow engines) consume these JSON results as `verification_result_ref` in their receipts (v2.3 §7)
3. Go Core does not generate receipts itself — that is the external system's responsibility
4. Go Core may later include a receipt validation mode that checks whether a receipt's `vsc_result_class` is consistent with the current bundle verification result

**No-redefinition rule from v2.3 applies to Go Core:**
- Go Core must not produce a result JSON that encourages downstream systems to override FAIL results
- If the bundle is FAIL, the JSON result must clearly state `"result": "FAIL"` with no ambiguous wording
- External systems that reference Go-produced verification results must still apply the result preservation rule from v2.3 §9

---

## 14. Security Requirements

The Go Core must satisfy the same security invariants as the Node.js reference implementation (v2.0 §17). These are not optional for a conformant implementation.

| Requirement | Implementation note |
|-------------|-------------------|
| **Read-only verification** | The Go Core must not write to any file inside the Evidence Bundle directory during verification |
| **No mutation of source bundles** | `os.Open` only — no `os.Create`, `os.WriteFile`, or equivalent inside bundle paths |
| **Fail-closed behavior** | `os.Exit(1)` or equivalent on any unresolvable error; no silent continuation |
| **No silent repair** | Missing delta files must produce FAIL, not be skipped |
| **No PASS without checksum integrity** | Checksum verification must complete before any token-level parsing |
| **No PASS without required files** | Required file check must be the first structural check |
| **No hidden trust claims** | The JSON result must not include language implying trust, correctness, or legal validity |
| **Deterministic** | The same bundle must produce the same result on every run — no random or time-dependent behavior in the verification logic |

---

## 15. Performance Considerations

Performance is a secondary concern for the first prototype — correctness and conformance come first. These are planned considerations for later optimization:

| Consideration | Approach |
|--------------|---------|
| **Streaming file hashing** | Use `io.Copy` with `sha256.New()` to hash files without loading them fully into memory — essential for large delta token files |
| **Deterministic file traversal** | Use sorted directory listing (`sort.Strings`) to ensure file traversal order is stable and independent of filesystem ordering |
| **Large bundle handling** | A bundle with 99+ delta tokens and 110+ files should verify in under a second on modern hardware; no special optimization needed for first prototype |
| **Parallel hashing** | Optional future optimization using `sync/errgroup` to hash multiple files concurrently — must not affect result class determinism |
| **Stable output** | Verification result and diagnostic counts must be identical regardless of whether hashing is serial or parallel |

**First prototype target:** Single-threaded, streaming hash computation, sorted traversal. Optimize only after conformance is confirmed.

---

## 16. Suggested Future Repository Layout

The following directory layout is suggested for the future Go Core repository (or subdirectory within the VSC monorepo). **These directories must not be created in v2.4** — they are planning material only.

```
vsc-go/                        ← future Go Core root (separate repo or subdirectory)
├── cmd/
│   └── vsc-go/
│       └── main.go            ← CLI entry point
├── internal/
│   ├── bundle/
│   │   └── bundle.go          ← Evidence Bundle directory reading and type detection
│   ├── checksum/
│   │   └── checksum.go        ← checksums.sha256 parsing and SHA-256 re-computation
│   ├── manifest/
│   │   └── manifest.go        ← manifest.json parsing and integrity checks
│   ├── tokens/
│   │   ├── chain.go           ← chain-token.json parsing and consistency checks
│   │   ├── base.go            ← base-token.json parsing
│   │   └── delta.go           ← delta token directory scanning and sequence validation
│   └── result/
│       └── result.go          ← result class types, JSON serialization, exit code mapping
├── testdata/
│   └── conformance/           ← v2.2 conformance fixtures (populated in v2.5)
│       ├── pass/
│       ├── fail/
│       ├── error/
│       └── proof-only/
├── go.mod
├── go.sum
└── README.md
```

**Package design principles:**
- `internal/` packages are unexported — the Go Core is a binary, not a library (initially)
- Each `internal/` package maps to one verification concern — `checksum`, `manifest`, `tokens` — matching the check names in `expected-result.json`
- `result/` package owns the result class type and its JSON serialization to prevent semantic drift in result strings

---

## 17. Migration Path

The following steps define the safe path from the current v1.x Node.js reference implementation to a published, conformance-tested Go Core prototype:

| Step | Action | Status |
|------|--------|--------|
| **1** | Keep Node.js reference implementation stable — no changes to token formats, bundle formats, or verification semantics | ✓ In place (v1.x) |
| **2** | Define machine-readable verification result schema (this document §10) | ✓ Drafted (v2.4) |
| **3** | Generate v2.2 conformance fixture bundles — actual bundle directories for each MCS vector | Planned (v2.5 prerequisite) |
| **4** | Implement minimal Go verifier against §7 scope | Planned (v2.5) |
| **5** | Compare Go output to Node.js reference output for every conformance fixture | Planned (v2.5 validation) |
| **6** | Publish Go prototype only after all MCS vectors produce matching result classes | Planned (v2.5 release gate) |

**The release gate at step 6 is non-negotiable.** Publishing a Go verifier that disagrees with the Node.js reference on any MCS vector would split the conformance surface and create ecosystem confusion.

---

## 18. Risk Controls

| Risk | Control |
|------|---------|
| **Semantic drift** | Run both verifiers against every new Evidence Bundle produced by the Node.js toolchain; use v2.2 conformance vectors as the primary gate |
| **Premature rewrite** | Scope is verification only; export, showcase, and orchestration remain in Node.js |
| **Format changes during Go preparation** | v2.4 explicitly forbids any changes to token formats or evidence bundle formats; the Go Core will be built against stable formats |
| **Over-scoping into showcase or partner integrations** | §6 explicitly lists what stays outside Go Core; any proposal to add showcase or receipt generation must be treated as scope expansion |
| **Conformance claim without testing** | Do not publish Go Core as "VSC conformant" until all MCS-01 to MCS-10 vectors produce correct result classes |
| **Windows path handling bugs** | Test explicitly on Windows paths — `\` separators, drive letters — before claiming Windows support |
| **Silent failure on permission errors** | Any file that cannot be read must produce ERROR or FAIL, not be silently skipped |

---

## 19. Non-Goals

| Non-Goal | Statement |
|----------|-----------|
| **v2.4 does not implement Go** | This document is preparation only. No `.go` files, no `go.mod`, no binary. |
| **v2.4 does not change VSC formats** | Token formats and Evidence Bundle formats are defined by v2.0 and must not change during Go Core preparation. |
| **v2.4 does not change verification semantics** | The v2.0 specification defines verification behavior. Go Core preparation does not redefine it. |
| **v2.4 does not replace v1.x** | The Node.js reference implementation is not deprecated by this document or by the future Go Core. |
| **v2.4 does not introduce enterprise deployment** | Enterprise deployment is a v3.0 concern. |
| **v2.4 does not certify legal responsibility** | No VSC implementation at any version certifies legal responsibility. |

---

## 20. Roadmap

| Version | Title | Scope |
|---------|-------|-------|
| **v2.5** | Minimal Go Verifier Prototype | Implement §7 minimal prototype scope in Go; pass all MCS-01 to MCS-10 vectors; publish after conformance gate |
| **v2.6** | Machine-Readable Verification Result Schema | JSON Schema draft for the verification result format (§10); schema validation tooling; bundle-level Canonical Event metadata validation |
| **v2.7** | Conformance Fixture Package | Generate and publish actual `conformance/v2.2/` fixture directories; automated comparison harness for Node.js vs Go results |
| **v3.0** | Enterprise Verification Engine | Production-grade verifier: parallel hashing, multi-bundle verification, policy rules, receipt processing, server-side deployment, integration APIs |

Each step depends on the previous step being conformance-tested before the next begins. v2.5 cannot be published until conformance fixtures exist. v2.6 cannot finalize schemas until v2.5 has demonstrated stable output. v2.7 formalizes what v2.5 and v2.6 proved in practice.

---

## Appendix A: Term Glossary

| Term | Definition |
|------|-----------|
| **Go Core** | The planned Go-based VSC verifier implementation; a second conforming implementation of the v2.0 specification |
| **Node.js reference implementation** | The current v1.x VSC toolchain; authoritative behavioral reference until Go Core reaches conformance |
| **Evidence Bundle verification** | Read-only check of an Evidence Bundle for completeness, integrity, and internal consistency |
| **Read-only verification** | Verification that produces a result without writing to or modifying the source bundle |
| **Fail-closed behavior** | Unresolvable errors cause immediate non-zero exit; no silent continuation |
| **Conformance vectors** | The v2.2-defined test cases that a conformant implementation must handle correctly |
| **Result class semantics** | The defined meanings of PASS, FAIL, ERROR, and PROOF-ONLY from v2.0 §12 |
| **Machine-readable verification result** | JSON output from the verifier suitable for consumption by automated systems and receipt issuers |
| **Checksum binding** | Verification that all files in `checksums.sha256` match their SHA-256 digests |
| **Manifest integrity** | Verification that `manifest.json` chain references agree with `chain-token.json` |
| **Delta sequence integrity** | Verification that all referenced delta tokens are present, parseable, and in correct order |
| **Semantic drift** | Gradual divergence between implementations in how they handle edge cases; caught by conformance testing |
| **Portable verifier binary** | A single compiled binary with no runtime dependency, deployable on Windows, Linux, and macOS |

---

## Appendix B: Mapping v1.x Scripts to Planned Go Core Modules

| v1.x Script | Go Core Module (planned) | Notes |
|-------------|------------------------|-------|
| `verifyEvidenceBundle.js` | `internal/bundle/`, `internal/checksum/`, `internal/manifest/`, `internal/tokens/` | Primary mapping — one script → multiple focused packages |
| `exportJsonEventBundle.js` | Not in Go Core scope | Export is creation-side; Go Core is verification-side |
| `zipEvidenceBundle.js` | Not in Go Core scope | ZIP creation stays in Node.js |
| `demoEvidenceFlow.js` | Not in Go Core scope | Orchestration stays in Node.js |
| `src/vscCli.js` routing | `cmd/vsc-go/main.go` | CLI entry point; routes `verify-bundle` to Go verification logic |

---

*VSC v2.4 Go Core Prototype Preparation — © DigiEmu / VSC Project*  
*This document is a preparation draft. No Go source files are created. No implementation code is changed.*
