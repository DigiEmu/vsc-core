# VSC v2.0 — Formal Specification Draft

**Status:** Draft  
**Version:** v2.0-draft  
**Date:** 2026-06-21  
**Reference Implementation:** VSC v1.x (Node.js)

---

> This document is a formal specification draft. It defines the VSC evidence model,
> token roles, bundle structure, verifier behavior, and validation semantics in a
> language-independent form. The current v1.x Node.js codebase is the reference
> implementation against which this specification is written.

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Core Principle](#2-core-principle)
3. [Reference Implementation Boundary](#3-reference-implementation-boundary)
4. [Token Model](#4-token-model)
5. [Base Token](#5-base-token)
6. [Delta Token](#6-delta-token)
7. [Chain Token](#7-chain-token)
8. [Evidence Bundle](#8-evidence-bundle)
9. [Manifest Integrity](#9-manifest-integrity)
10. [Checksum Binding](#10-checksum-binding)
11. [Verifier Behavior](#11-verifier-behavior)
12. [Verification Result Semantics](#12-verification-result-semantics)
13. [ZIP Handoff Artifact](#13-zip-handoff-artifact)
14. [Evidence Flow](#14-evidence-flow)
15. [Evidence Boundaries](#15-evidence-boundaries)
16. [Interoperability Model](#16-interoperability-model)
17. [Security and Integrity Invariants](#17-security-and-integrity-invariants)
18. [Non-Goals](#18-non-goals)
19. [Compliance and Audit Use Cases](#19-compliance-and-audit-use-cases)
20. [Roadmap Beyond v2.0](#20-roadmap-beyond-v20)

---

## 1. Purpose and Scope

**VSC** — Versioned State Commit / Verifiable Structural Compression / Verifiable State Code — is a decision-state evidence layer. It preserves the state of a computation or decision process in a form that is reconstructible, portable, and independently verifiable.

**VSC is:**
- A decision-state evidence layer for structured state transitions
- A portable evidence artifact format for audit and handoff
- A model for deterministic reconstruction of state from ordered proofs

**VSC is not:**
- Generic compression — its structure encodes ordered, verifiable state transitions, not arbitrary data reduction
- An identity system — VSC verifies state evidence, not user identity
- A full governance platform — it does not decide responsibility, certify compliance, or replace audit frameworks
- A truth oracle — it records what state was observed and how it was derived, not whether that state reflects real-world truth

VSC is the decision-state verification layer. What it records, it can reconstruct. What it exports, it can verify. It makes no claims beyond that boundary.

---

## 2. Core Principle

> **Less data, more truth.**

VSC encodes the full history of a state system using a minimal, ordered proof structure:

1. **Store a full base state once** — the Base Token captures the complete initial state
2. **Store ordered, verifiable deltas afterwards** — each Delta Token records one state transition
3. **Reconstruct the latest state from base + deltas** — deterministic reconstruction is always possible given the full token sequence
4. **Verify the reconstructed state through root hash / chain integrity** — the Chain Token anchors the entire sequence

This model ensures that storage cost is proportional to change rather than to total state size, while preserving the ability to reconstruct and verify any point in the sequence.

---

## 3. Reference Implementation Boundary

**VSC v1.x** is the current Node.js reference implementation. It implements the evidence model defined in this specification and serves as the authoritative behavioral reference for:

- Token creation, format, and content
- Evidence Bundle structure and required files
- Checksum binding and manifest integrity checks
- Verifier behavior and PASS/FAIL semantics
- ZIP Handoff Artifact creation

**VSC v2.0** is a language-independent specification draft. It formalizes the model underlying v1.x so that:

- Future implementations in Go, Rust, Python, or other languages may be built against the same semantics
- External systems may reference VSC evidence objects without depending on the Node.js toolchain
- Conformance test vectors (planned: v2.3) may be used to verify any implementation

Implementations are compliant with VSC v2.0 if they satisfy all verifier behavior rules, produce and accept the required token and bundle structures, and preserve the security and integrity invariants defined in this document.

---

## 4. Token Model

VSC defines the following evidence objects:

| Object | Role |
|--------|------|
| **Base Token** | Initial complete state snapshot. Reconstruction anchor. |
| **Delta Token** | Ordered state transition from one state to the next. |
| **Chain Token** | Root evidence artifact. Binds the full ordered sequence from base to latest. |
| **Evidence Bundle** | Portable directory artifact containing all files required for review and verification. |
| **ZIP Handoff Artifact** | Transport-layer packaging of an Evidence Bundle as a single portable file. |
| **Verification Result** | Outcome of a read-only verification pass: PASS, FAIL, PROOF-ONLY, or ERROR. |
| **Proof-only artifact** | An artifact recorded as proof material but not fully reconstructed in the current context. |

These objects form a layered evidence structure. The Chain Token is the root. The Base Token and Delta Tokens are its leaves. The Evidence Bundle is the portable container. The ZIP Handoff Artifact is its distribution form.

---

## 5. Base Token

The Base Token represents the initial complete state of the system at the starting point of a chain.

**Properties:**
- Contains a full snapshot of the initial state
- Must be uniquely identified (Base Token ID)
- Must be referenced by the Chain Token
- Acts as the reconstruction anchor — the starting point from which all Delta Tokens are applied to reach any subsequent state
- Must be present in any Evidence Bundle that claims to support deterministic reconstruction

**Invariant:** If the Base Token is missing or unparseable, deterministic reconstruction of any state in the chain is impossible. A verifier must reject the bundle as FAIL.

---

## 6. Delta Token

A Delta Token represents an ordered transition from one known state to the next.

**Properties:**
- References a previous state (from-ID) and a next state (to-ID)
- Is uniquely identified (Delta Token ID)
- Belongs to an ordered position in the chain sequence
- Records the minimal evidence of the state change

**Ordering invariant:** Delta Tokens must be applied in sequence. Applying them out of order produces a different state and must be treated as a verification failure.

**Gap invariant:** A missing Delta Token creates a broken chain. A verifier must detect and report any gap in the expected sequence. A bundle with a broken chain cannot achieve PASS.

---

## 7. Chain Token

The Chain Token is the root evidence artifact of a VSC Evidence Bundle.

**Properties:**
- References the Base Token ID (chain start)
- References the Latest Token ID (chain end)
- Records the ordered Delta Token sequence
- Records a chain hash binding the full sequence
- Operates in `DELTA_CHAIN` mode

**Role:** The Chain Token is the authoritative record of the chain. All other bundle contents — the Base Token, Delta Tokens, and Manifest — are cross-checked against the Chain Token during verification. The Chain Token is the ground truth for what the chain claims.

**Invariant:** If the Chain Token is missing or malformed, no downstream verification step is meaningful. A verifier must reject the bundle immediately.

---

## 8. Evidence Bundle

An Evidence Bundle is a portable directory artifact containing all files necessary for an independent reviewer to verify the state chain without access to the source system.

### Required Files (all bundle types)

| File | Role |
|------|------|
| `manifest.json` | Human-readable index of bundle contents and chain claims |
| `checksums.sha256` | Checksum binding — SHA-256 digest of every included file at export time |
| `chain-token.json` | Root evidence artifact |
| `base-token.json` | Reconstruction anchor |
| `delta-tokens/` | Directory containing one file per ordered delta step |
| `verification-summary.json` | Export-time verification record |
| `README.md` | Human-readable bundle description |

### Additional Files (JSON Event Evidence Bundles)

| File | Role |
|------|------|
| `event-schema.json` | Schema definition for the structured event model |
| `event-summary.json` | Session-level event summary |
| `json-benchmark-summary.json` | Benchmark evidence for the event session |
| `json-benchmark-report.md` | Human-readable benchmark report |
| `json-benchmark-chart-data.json` | Chart data for visual evidence |

**Invariant:** An Evidence Bundle that is missing any required file cannot be fully verified and must be rejected as FAIL.

---

## 9. Manifest Integrity

The `manifest.json` file is a human-readable index that describes the expected contents and chain claims of the Evidence Bundle.

**Manifest integrity** means the manifest's chain references agree with the authoritative Chain Token:

- `manifest.chain.base_token_id` must match the Base Token ID in `chain-token.json`
- `manifest.chain.latest_token_id` must match the Latest Token ID in `chain-token.json`

**Divergence indicates a post-export edit.** If the manifest and the Chain Token disagree, either the manifest or the Chain Token was modified after the bundle was sealed. A verifier must report this as FAIL.

**Manifest checks are structural checks, not semantic trust claims.** Passing manifest integrity means the bundle's index is consistent with its root evidence artifact. It does not mean the recorded state was correct, meaningful, or trustworthy in any domain-specific sense.

---

## 10. Checksum Binding

`checksums.sha256` binds every included file to its SHA-256 digest at the moment the bundle was exported. This is the primary tamper-evidence mechanism of the Evidence Bundle.

**Rules:**

1. A verifier must re-compute SHA-256 digests of all listed files at verification time
2. A checksum mismatch must result in FAIL — it means the file was modified after the bundle was sealed
3. Checksum verification must occur **before** deeper semantic checks (token cross-checks, manifest integrity) — the token files themselves are covered by the checksum binding, so their integrity cannot be assumed until checksums pass
4. A verifier must report a FAIL if any listed file is missing or has a mismatched digest
5. An empty or unparseable `checksums.sha256` file must result in FAIL

**Invariant:** No semantic verification step (token parsing, manifest cross-check, delta sequence validation) may be considered trustworthy unless the checksum binding for that file has already passed.

---

## 11. Verifier Behavior

A conformant VSC verifier must satisfy the following behavioral rules:

| Rule | Requirement |
|------|-------------|
| **Read-only** | The verifier must not write to, modify, or delete any file in the source bundle |
| **Source bundle immutability** | No file inside the Evidence Bundle may be created, modified, or deleted during verification |
| **Fail-closed** | Any unresolvable inconsistency must result in an immediate FAIL with non-zero exit code |
| **No silent continuation** | A verifier must never proceed past a failing check without reporting it |
| **Non-zero exit on failure** | Exit code 0 means all required checks passed; any non-zero exit means verification did not pass |
| **PASS requires all checks** | A verifier must report PASS only if every required check passes — partial PASS is not defined |
| **Deterministic** | Given the same bundle, a verifier must produce the same result on every run |

**Verification order:** Required-file checks and checksum binding must complete before token-level semantic checks. This ensures the semantic inputs are trustworthy before they are evaluated.

---

## 12. Verification Result Semantics

A VSC verification produces one of four results:

| Result | Meaning |
|--------|---------|
| **PASS** | All required checks passed. The Evidence Bundle is complete, internally consistent, and every file matches its checksum binding. |
| **FAIL** | At least one required check failed. The Evidence Bundle may be incomplete, tampered, or internally inconsistent. |
| **PROOF-ONLY** | The artifact is recorded as proof material but was not fully reconstructed in this verification context. Applicable when partial evidence is available but full reconstruction was not requested or possible. |
| **ERROR** | The verification context is invalid. Causes include: malformed input, missing required arguments, unparseable token files, or an invalid verification environment. ERROR is distinct from FAIL — it means verification could not be meaningfully attempted, not that it was attempted and failed. |

**PASS does not mean:**
- The recorded state reflects real-world truth
- The decisions encoded in the state were correct or appropriate
- The bundle is legally certified
- The source system is trustworthy

**PASS means:** at verification time, the bundle was complete, internally consistent, and every file matched its checksum binding.

---

## 13. ZIP Handoff Artifact

A ZIP Handoff Artifact is a transport-layer packaging of an Evidence Bundle as a single portable file.

**Properties:**
- Created from an existing Evidence Bundle directory
- Must not change the contents of the source bundle
- Must preserve the full bundle directory structure, with the bundle folder name as the ZIP root
- The extracted ZIP must be directly usable as input to a verifier without any additional preparation

**ZIP is a transport artifact, not a new evidence format.** It does not change checksum bindings, token contents, or manifest claims. A bundle that passes verification before zipping must pass verification after unzipping.

**Source bundle immutability:** ZIP creation must only write to a separate output location. No file inside the source Evidence Bundle may be modified during ZIP creation.

---

## 14. Evidence Flow

The standard VSC evidence handoff flow consists of five steps:

```
┌─────────────────────────────────────────────────────────────┐
│               VSC Evidence Flow (Canonical)                  │
└─────────────────────────────────────────────────────────────┘

  Step 1: Create State Chain
          └─ Record base state and ordered state transitions
          └─ Produce Base Token, Delta Tokens, Chain Token

  Step 2: Export Evidence Bundle
          └─ Package all tokens, manifest, checksums, metadata
          └─ Compute checksum binding over all included files
          └─ Produce portable Evidence Bundle directory

  Step 3: Verify Evidence Bundle
          └─ Read-only verification pass
          └─ Check required files, checksum binding, token integrity,
             manifest integrity, delta sequence completeness
          └─ Produce Verification Result: PASS or FAIL

  Step 4: ZIP Evidence Bundle
          └─ Package Evidence Bundle directory into ZIP Handoff Artifact
          └─ Source bundle immutability preserved
          └─ Produce portable .zip file

  Step 5: Share Portable Artifact
          └─ Distribute ZIP to reviewers, partners, auditors
          └─ Recipients verify independently using Step 3
```

The VSC v1.18 `demo:evidence-flow` command implements this canonical flow as an orchestrated demonstration. It delegates all evidence logic to the existing dedicated scripts (`exportJsonEventBundle.js`, `verifyEvidenceBundle.js`, `zipEvidenceBundle.js`) and is the v1.x reference demonstration of this flow.

---

## 15. Evidence Boundaries

VSC occupies a specific, bounded role in a broader evidence and governance ecosystem.

| Layer | System | Role |
|-------|--------|------|
| **Decision-state verification** | VSC | Verifies that a state chain is complete, consistent, and unmodified |
| **Identity and trust** | TBN (or equivalent) | Associates verified identities with transactions or events |
| **Responsibility / attribution** | CLARIXO (or equivalent) | Assigns and contextualises responsibility for decisions |
| **Governance framework** | External | Policy, compliance, legal certification |

**VSC verifies state evidence, not human identity.** It cannot confirm who made a decision, only that a recorded state transition occurred and has not been modified since recording.

**These boundaries are explicit design constraints, not limitations.** Each layer addresses a distinct concern. VSC does not attempt to absorb adjacent layers.

---

## 16. Interoperability Model

VSC Evidence Bundles are designed to interoperate with external systems that need to reference or incorporate VSC evidence.

**Rules for external systems:**

1. **External systems may reference VSC Evidence Bundle IDs** — a bundle directory name or chain token ID may be used as a stable reference in external records (receipts, responsibility assignments, audit logs)
2. **External systems must not redefine VSC verification semantics** — a system that relabels a VSC FAIL as PASS, or introduces its own PASS criteria, is not VSC-conformant
3. **Receipts from TBN or other systems may point to VSC bundle identifiers** — the VSC bundle remains the authoritative evidence artifact; external receipts are pointers, not overrides
4. **Responsibility systems may store VSC verification results as upstream evidence** — a CLARIXO-style system may record that VSC returned PASS as an input to responsibility attribution, without claiming that VSC certified the decision quality

**Interoperability principle:** External systems compose with VSC by referencing its outputs, not by internalising its verification logic.

---

## 17. Security and Integrity Invariants

The following invariants must hold in every conformant VSC implementation:

| Invariant | Rule |
|-----------|------|
| **No silent continuation** | After any failing check, execution must stop or explicitly report the failure before proceeding |
| **No PASS without checksum integrity** | PASS requires that every file listed in `checksums.sha256` matches its recorded digest |
| **No PASS without required files** | PASS requires that all structurally required files are present |
| **No PASS if chain token and manifest disagree** | Any divergence between manifest chain references and Chain Token IDs must produce FAIL |
| **No mutation during verification** | The verifier must never write to the source bundle |
| **No hidden trust claims** | A PASS result must not imply trust, correctness, legal validity, or identity claims not present in the evidence |
| **Deterministic verification** | The same bundle must produce the same verification result on every run |
| **Fail-closed on unknown errors** | Unexpected exceptions or unparseable inputs must result in non-zero exit, not silent PASS |

---

## 18. Non-Goals

The following are explicit non-goals of VSC. An implementation that pursues these goals is no longer VSC-conformant in spirit.

| Non-Goal | Rationale |
|----------|-----------|
| **User identification** | VSC records state transitions, not actor identities. Identity is handled by adjacent systems. |
| **Legal responsibility determination** | VSC does not decide who is accountable. Responsibility assignment is a governance function. |
| **Model quality certification** | VSC records that a model produced a state transition. It does not evaluate whether the output was good, correct, or appropriate. |
| **Real-world truth claims** | VSC verifies that a recorded state is internally consistent. It does not verify that the state reflects external reality. |
| **Governance framework replacement** | VSC is evidence infrastructure, not a governance system. Policy, compliance, and audit processes are external. |
| **Single programming language requirement** | The v1.x Node.js implementation is the reference, not the constraint. Conformant implementations may exist in any language. |
| **Blockchain requirement** | VSC does not require distributed ledger infrastructure. Chain integrity is achieved through cryptographic hashing and ordered token structure. |

---

## 19. Compliance and Audit Use Cases

VSC Evidence Bundles are designed to support the following use cases:

**AI Decision-State Review**  
Export and verify the complete state chain of an AI session. Provide reviewers with a portable Evidence Bundle that can be independently verified without access to the source system.

**Post-Incident Reconstruction**  
After an incident, reconstruct the sequence of state transitions leading to the incident state using Base Token + Delta Tokens. The Chain Token provides the authoritative ordering.

**Audit Evidence Handoff**  
Transfer an Evidence Bundle to an external auditor. The auditor runs `verify-bundle` independently. The verifier's read-only, fail-closed behavior ensures the handoff process cannot inadvertently corrupt the bundle.

**Model Governance Documentation**  
Maintain a timestamped, cryptographically-bound record of model state transitions for governance documentation. The Evidence Bundle is the artifact; verification is the confirmation of its integrity.

**Independent Verification**  
Any party with access to the Evidence Bundle and a conformant VSC verifier can independently verify the bundle's integrity without communicating with the original system.

---

## 20. Roadmap Beyond v2.0

The following releases are planned as extensions to the v2.0 specification:

| Version | Title | Scope |
|---------|-------|-------|
| **v2.1** | Canonical Event Model | Formalise the JSON event evidence schema as a first-class VSC evidence type with defined required fields, session identity binding, and event ordering semantics |
| **v2.2** | Go Core Prototype | Reference implementation of the VSC v2.0 verifier in Go, conformant with this specification and tested against v1.x-produced bundles |
| **v2.3** | Conformance Test Vectors | A canonical set of Evidence Bundles (valid and intentionally invalid) for testing conformance of any VSC implementation against this specification |
| **v3.0** | Enterprise Verification Engine | Production-grade multi-bundle verification, policy-driven verification rules, integration APIs, and audit trail generation |

The v1.x Node.js reference implementation remains the authoritative implementation until v2.2 is available and conformance-tested.

---

## Appendix A: Term Glossary

| Term | Definition |
|------|-----------|
| **Evidence Bundle** | Portable directory containing all files required for read-only verification of a state chain |
| **Base Token** | Token representing the initial complete state; reconstruction anchor |
| **Delta Token** | Token representing one ordered state transition |
| **Chain Token** | Root evidence artifact binding the full ordered delta sequence |
| **ZIP Handoff Artifact** | Transport-layer ZIP packaging of an Evidence Bundle |
| **Read-only verification** | Verification that produces a result without modifying the source bundle |
| **Fail-closed behavior** | Any unresolvable inconsistency results in non-zero exit; no silent continuation |
| **Source bundle immutability** | No file in the Evidence Bundle is created, modified, or deleted during verification or ZIP creation |
| **Manifest integrity** | The manifest's chain references agree with the authoritative Chain Token |
| **Checksum binding** | The checksums.sha256 file binds every included file to its SHA-256 digest at export time |
| **Deterministic reconstruction** | The property that Base Token + ordered Delta Tokens always produce the same state at any step |
| **Portable evidence artifact** | An Evidence Bundle or ZIP Handoff Artifact that can be verified independently of the source system |
| **Decision-state verification** | The act of confirming that a recorded state chain is complete, consistent, and unmodified |

---

## Appendix B: Relation to v1.x Reference Implementation

The following table maps specification concepts to their v1.x implementation locations:

| Specification Concept | v1.x Implementation |
|----------------------|-------------------|
| Evidence Bundle export | `scripts/exportEvidenceBundle.js`, `scripts/exportJsonEventBundle.js` |
| Checksum binding | `checksums.sha256` generation in export scripts |
| Manifest integrity | `manifest.json` generation and cross-check in `verifyEvidenceBundle.js` |
| Verifier behavior | `scripts/verifyEvidenceBundle.js` |
| ZIP Handoff Artifact | `scripts/zipEvidenceBundle.js` |
| Evidence Flow orchestration | `scripts/demoEvidenceFlow.js` (v1.18) |
| CLI command routing | `src/vscCli.js` |

---

*VSC v2.0 Formal Specification Draft — © DigiEmu / VSC Project*  
*This document describes specification intent. The v1.x Node.js codebase is the reference implementation.*
