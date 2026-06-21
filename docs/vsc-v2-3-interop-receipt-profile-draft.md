# VSC v2.3 — Interop Receipt Profile Draft

**Status:** Draft  
**Version:** v2.3-draft  
**Date:** 2026-06-21  
**Depends on:** [VSC v2.0 Formal Specification Draft](vsc-v2-0-formal-specification-draft.md), [VSC v2.1 Canonical Event Model Draft](vsc-v2-1-canonical-event-model-draft.md), [VSC v2.2 Conformance Test Vectors Draft](vsc-v2-2-conformance-test-vectors-draft.md)  
**Reference Implementation:** VSC v1.x (Node.js)

---

> This document defines how external systems may reference VSC evidence outputs
> — Evidence Bundles, Canonical Events, verification results, and ZIP Handoff
> Artifacts — without redefining VSC verification semantics. No source code,
> token formats, or evidence bundle formats are changed by this document.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Relationship to VSC v2.0, v2.1, and v2.2](#2-relationship-to-vsc-v20-v21-and-v22)
3. [Interop Principle](#3-interop-principle)
4. [External Receipt Definition](#4-external-receipt-definition)
5. [Required Receipt Fields](#5-required-receipt-fields)
6. [Optional Receipt Fields](#6-optional-receipt-fields)
7. [VSC Reference Types](#7-vsc-reference-types)
8. [Suggested JSON Shape](#8-suggested-json-shape)
9. [Result Preservation Rule](#9-result-preservation-rule)
10. [Boundary Declaration](#10-boundary-declaration)
11. [TBN Reference Profile](#11-tbn-reference-profile)
12. [CLARIXO Reference Profile](#12-clarixo-reference-profile)
13. [AntifragileOS / Workflow Reference Profile](#13-antifragileos--workflow-reference-profile)
14. [Receipt Integrity](#14-receipt-integrity)
15. [Custody and Handoff](#15-custody-and-handoff)
16. [Interop Verification Semantics](#16-interop-verification-semantics)
17. [Invalid Receipt Cases](#17-invalid-receipt-cases)
18. [Security Invariants](#18-security-invariants)
19. [Non-Goals](#19-non-goals)
20. [Roadmap](#20-roadmap)

---

## 1. Purpose

This document defines how external systems may safely reference VSC evidence while preserving VSC evidence boundaries and result semantics.

An **Interop Receipt** (also called an **External Receipt**) is a structured record created *outside* VSC by an external system — such as a trust layer, attribution system, workflow engine, or audit platform — that references VSC evidence outputs. It is not a replacement for VSC verification. It is a reference object that points to VSC evidence and may add external context around it.

External systems that interact with VSC evidence may need to:
- Attach identity or trust context to a verified Evidence Bundle
- Assign responsibility or attribution to a recorded state transition
- Record custody of a ZIP Handoff Artifact through a handoff chain
- Gate a workflow on a VSC verification result
- Archive a VSC result alongside audit metadata

All of these are legitimate external uses of VSC evidence. This document defines how to do them safely — without overriding, redefining, or conflating VSC result classes with external claims.

This is a draft specification. No implementation change is required by this document. Receipts are not yet generated or verified by the v1.x reference implementation.

---

## 2. Relationship to VSC v2.0, v2.1, and v2.2

| Version | Defines | Role in Interop |
|---------|---------|----------------|
| **v2.0** | Evidence model: tokens, bundles, verifier behavior, result semantics | Provides the evidence objects that receipts reference |
| **v2.1** | Canonical Event model: event structure, identity, canonicalization | Provides `event_id` and `event_hash` that receipts may point to |
| **v2.2** | Conformance test vectors: minimum compatibility set, result class semantics | Defines how implementations must behave — receipts must not override this |
| **v2.3** | **Interop Receipt Profile: how external systems reference VSC outputs** | — (this document) |

The relationship is directional: v2.3 consumes the outputs of v2.0, v2.1, and v2.2. It does not modify them. An Interop Receipt points *to* VSC evidence; it does not contain or replace it.

---

## 3. Interop Principle

> **External systems may reference VSC evidence. They must not redefine it.**

| Rule | Requirement |
|------|-------------|
| **Reference, not replacement** | An Interop Receipt references VSC evidence outputs by ID or hash. It does not replace the Evidence Bundle or the verification result. |
| **No result redefinition** | A VSC PASS remains a VSC PASS. A VSC FAIL remains a VSC FAIL. No external system may override the result class. |
| **Context addition is allowed** | External systems may add trust context, identity context, attribution context, custody records, policy annotations, or workflow state — as long as these are clearly separate from VSC's decision-state verification claim. |
| **Result class preservation** | If a receipt stores a VSC result, it must store it accurately and must not present it as a different result class to downstream consumers. |
| **Disagreement creates a separate record** | If an external system disagrees with a VSC result, it must create its own separate result record. It must not mutate the VSC result. |

---

## 4. External Receipt Definition

An **External Receipt** is a structured record created by a system outside VSC that references one or more VSC evidence objects and declares what the issuing system is claiming about them.

**Properties:**
- Created outside the VSC toolchain by an external issuing system
- References VSC evidence by stable identifiers (bundle IDs, chain token IDs, event IDs, event hashes)
- Declares the issuing system and its role
- Declares what it is claiming (trust, attribution, custody, policy compliance, workflow gate, etc.)
- Declares what it is *not* claiming — specifically, that VSC decision-state verification remains VSC's responsibility
- May include an integrity reference (signature or content hash) over its own content
- Must not modify any canonical VSC evidence object

**An External Receipt is not:**
- A replacement for running `verify-bundle`
- A substitute for the Evidence Bundle's `checksums.sha256` or `manifest.json`
- A VSC verification result
- A legal certification
- An identity proof

---

## 5. Required Receipt Fields

Every External Receipt must include the following fields. A receipt missing any required field is structurally incomplete and must not be treated as a valid Interop Receipt.

| Field | Type | Description |
|-------|------|-------------|
| `receipt_id` | string | Stable unique identifier for this receipt. Issued by the external system. |
| `receipt_type` | string | Declared type of this receipt (e.g. `"vsc_interop_receipt"`). |
| `receipt_version` | string | Version of the Interop Receipt Profile this receipt conforms to (e.g. `"2.3-draft"`). |
| `issuer` | object | Identifies the external system issuing this receipt. Must include at minimum `system` (system name or ID) and `role` (the layer this system operates in: identity, trust, attribution, custody, workflow, audit, etc.). |
| `issued_at` | string | ISO 8601 UTC timestamp of when the receipt was created. |
| `vsc_reference` | object | References to the VSC evidence objects this receipt concerns. Must include at minimum one stable VSC identifier (see §7 for reference types). |
| `vsc_result_class` | string | The VSC result class being referenced: `"PASS"`, `"FAIL"`, `"ERROR"`, or `"PROOF-ONLY"`. Must match the actual VSC verification result. Must not be modified. |
| `semantic_boundary` | object | Explicit declaration of what layer the issuing system operates in and that VSC remains responsible for decision-state verification. Must include `vsc_claim`, `external_claim`, and `no_redefinition: true`. |
| `integrity_ref` | object | Reference to receipt integrity: a signature, content hash, or other integrity mechanism over the receipt itself. May be `null` if receipt integrity is managed externally, but must be declared. |
| `profile` | string | Identifier of the Interop Receipt Profile this receipt uses (e.g. `"vsc-interop-receipt-v2.3-draft"`). |

---

## 6. Optional Receipt Fields

The following fields are optional. Their presence must conform to the types and semantics defined here.

| Field | Type | Description |
|-------|------|-------------|
| `actor_ref` | string | Reference to the actor (human, system, or model) associated with this receipt. Format: `actor:<id>`. Not an identity proof by itself. |
| `trust_ref` | string | Reference to a trust record or trust certificate from the issuing identity/trust layer. |
| `identity_ref` | string | Reference to an identity record for the actor referenced in this receipt. Identity claims come from the identity/trust layer, not from VSC. |
| `attribution_ref` | string | Reference to a responsibility or attribution record from an attribution layer (e.g. CLARIXO). |
| `policy_ref` | string | Reference to the policy or compliance rule that this receipt supports or documents. |
| `custody_ref` | string | Reference to a custody transfer record documenting who held, transmitted, or accepted the evidence artifact. |
| `workflow_ref` | string | Reference to the workflow gate, pipeline step, or automation context that triggered or consumed this receipt. |
| `external_evidence_refs` | string[] | References to additional external evidence artifacts relevant to this receipt (not VSC artifacts). |
| `human_review_ref` | string | Reference to a human review record if a person reviewed the VSC evidence and this receipt records that review. |
| `metadata` | object | Non-canonical metadata for display, tooling, or archival. Must not affect receipt identity or result class. Must be declared as non-canonical. |

---

## 7. VSC Reference Types

The `vsc_reference` field in an External Receipt may reference any of the following VSC evidence objects. Multiple references may be included in a single receipt.

| Reference Type | Format | Points to |
|---------------|--------|-----------|
| **Evidence Bundle reference** | `bundle:<bundle-directory-name>` | The Evidence Bundle directory, identified by its standard name |
| **ZIP Handoff Artifact reference** | `zip:<zip-filename>` | The ZIP Handoff Artifact, identified by filename |
| **Chain Token reference** | `chain-token:<chain-token-id>` | The Chain Token, identified by its chain token ID |
| **Base Token reference** | `base-token:<base-token-id>` | The Base Token, identified by its ID |
| **Latest Token reference** | `latest-token:<latest-token-id>` | The latest (most recent) token in the chain |
| **Delta Token reference** | `delta-token:<from-id>-to-<to-id>` | A specific Delta Token, identified by its from/to pair |
| **Canonical Event reference** | `event:<event-id>` | A Canonical Event, identified by its `event_id` |
| **event_hash reference** | `event-hash:sha256:<hex>` | A Canonical Event identified by its content hash |
| **Verification Result reference** | `verify-result:<bundle-id>:<timestamp>` | A verification result for a specific bundle at a specific time |

**Content-addressed references are preferred** where available — `event_hash` references are more stable than `event_id` references if the event ID format changes between profile versions.

---

## 8. Suggested JSON Shape

The following example illustrates a complete External Receipt in JSON form. Hash values and identifiers are placeholders. **This is not the final enforced schema** — field names and formats may be refined before v2.3 is finalized.

### Valid Receipt Example

```json
{
  "receipt_id": "receipt:example:001",
  "receipt_type": "vsc_interop_receipt",
  "receipt_version": "2.3-draft",
  "issuer": {
    "system": "external-system-example",
    "role": "trust-or-attribution-layer"
  },
  "issued_at": "2026-06-21T14:00:00Z",
  "profile": "vsc-interop-receipt-v2.3-draft",
  "vsc_reference": {
    "bundle_id": "vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13",
    "chain_token_id": "ED9566562A13",
    "base_token_id": "408C8C13C4D4",
    "latest_token_id": "ED9566562A13",
    "verification_result_ref": "verify-result:vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13:2026-06-21T14:01:00Z"
  },
  "vsc_result_class": "PASS",
  "semantic_boundary": {
    "vsc_claim": "decision-state verification",
    "external_claim": "trust-or-attribution-context",
    "no_redefinition": true
  },
  "integrity_ref": {
    "algorithm": "sha256",
    "digest": "sha256:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
  },
  "actor_ref": "actor:optional",
  "trust_ref": "trust:optional",
  "policy_ref": "policy:optional",
  "metadata": {
    "_non_canonical": true,
    "display_note": "Example receipt — not a final enforced schema."
  }
}
```

### Invalid Override Example

The following illustrates a receipt that violates the no-redefinition rule. Any system that produces or accepts a receipt of this form is not conformant with the v2.3 Interop Receipt Profile:

```json
{
  "receipt_id": "receipt:invalid:override",
  "referenced_vsc_result": "FAIL",
  "external_claimed_result": "PASS",
  "_expected_result": "INVALID_RECEIPT",
  "_reason": "External system must not override VSC result class. A FAIL cannot be promoted to PASS by an external receipt."
}
```

---

## 9. Result Preservation Rule

The result preservation rule is the central constraint of the v2.3 Interop Receipt Profile.

> **A VSC result class must not be changed by an external receipt.**

| Scenario | Required behavior |
|----------|------------------|
| VSC returns PASS | Receipt may store `"vsc_result_class": "PASS"`. Must not present this as FAIL or PROOF-ONLY. |
| VSC returns FAIL | Receipt must store `"vsc_result_class": "FAIL"`. Must not convert to PASS. May add diagnostic context around the failure. |
| VSC returns ERROR | Receipt must store `"vsc_result_class": "ERROR"`. Must not count as PASS or FAIL. |
| VSC returns PROOF-ONLY | Receipt must store `"vsc_result_class": "PROOF-ONLY"`. Must not promote to PASS. |
| External system disagrees | The external system must create a **separate result record under its own authority**, clearly labeled as its own assessment. It must not modify the `vsc_result_class` field in the receipt. |

**Wrapping is allowed. Override is not.** An external system may annotate, contextualize, or record additional information about a VSC FAIL. It may not relabel a FAIL as PASS. The distinction is: adding context around a result vs. changing the result.

---

## 10. Boundary Declaration

Every External Receipt must include a `semantic_boundary` declaration that makes explicit:
1. What VSC is responsible for (`vsc_claim`)
2. What the issuing external system is claiming (`external_claim`)
3. That the external system is not redefining VSC semantics (`no_redefinition: true`)

**Example boundary declarations by system type:**

| Issuing System Type | `vsc_claim` | `external_claim` |
|--------------------|-------------|-----------------|
| Identity/trust layer (TBN) | `"decision-state verification"` | `"identity and trust attestation"` |
| Attribution layer (CLARIXO) | `"decision-state verification"` | `"responsibility and attribution context"` |
| Workflow engine (AntifragileOS) | `"decision-state verification"` | `"workflow gating and pipeline state"` |
| Audit system | `"decision-state verification"` | `"audit record and compliance documentation"` |
| Custody system | `"decision-state verification"` | `"custody transfer and handoff record"` |

**Receipts must not imply that VSC:**
- Proves human identity
- Decides legal responsibility
- Certifies model quality
- Claims real-world truth
- Replaces governance frameworks

These are external-layer concerns. Boundary declarations make the separation explicit and machine-readable.

---

## 11. TBN Reference Profile

TBN (Trust Binding Network or equivalent identity/trust layer) may reference VSC evidence in the following ways:

**Permitted:**
- Reference an Evidence Bundle ID in a trust receipt as the upstream evidence artifact
- Reference a `chain_token_id` or `event_hash` as a stable pointer to the VSC evidence record
- Attach identity attestation or trust status as external context around the VSC result
- Store `vsc_result_class: "PASS"` as upstream evidence that state integrity was confirmed before trust evaluation

**Required:**
- Declare `semantic_boundary.vsc_claim: "decision-state verification"` and `external_claim: "identity and trust attestation"`
- Preserve `vsc_result_class` accurately — must not promote FAIL to PASS
- Include `no_redefinition: true` in `semantic_boundary`

**Prohibited:**
- Redefining VSC PASS / FAIL semantics
- Claiming that a VSC PASS proves the identity of an actor
- Claiming that a TBN identity receipt alone is sufficient for VSC evidence validity

**TBN receipt role in the evidence chain:**
```
VSC Evidence Bundle → verify-bundle → PASS
     ↓
TBN Receipt → references bundle_id + chain_token_id
           → attaches identity/trust context
           → stores vsc_result_class: "PASS" as upstream evidence
           → TBN makes its own trust claim (separate layer)
```

---

## 12. CLARIXO Reference Profile

CLARIXO (or equivalent responsibility/attribution layer) may reference VSC evidence in the following ways:

**Permitted:**
- Store a VSC verification result as upstream evidence for a responsibility or attribution record
- Reference a VSC bundle ID or `event_hash` as the evidence anchor for an attribution claim
- Add attribution records (who is responsible for a decision, under what policy) as context around VSC evidence
- Reference specific Canonical Events by `event_id` or `event_hash` to ground attribution in specific state transitions

**Required:**
- Distinguish responsibility context from VSC state verification — CLARIXO assigns responsibility; VSC verifies state
- Declare `semantic_boundary.external_claim: "responsibility and attribution context"`
- Preserve `vsc_result_class` accurately in any receipt that references a VSC result

**Prohibited:**
- Redefining VSC verification semantics
- Claiming that a VSC PASS means CLARIXO has confirmed responsibility
- Treating VSC evidence as a legal proof of responsibility

**CLARIXO receipt role in the evidence chain:**
```
VSC Evidence Bundle → verify-bundle → PASS
     ↓
CLARIXO Attribution Record → references bundle_id + event_hash
                           → stores vsc_result_class: "PASS" as upstream anchor
                           → adds attribution context (who, what policy, what role)
                           → CLARIXO makes its own attribution claim (separate layer)
```

---

## 13. AntifragileOS / Workflow Reference Profile

Workflow systems, pipeline engines, or autonomous decision systems (such as AntifragileOS) may reference VSC evidence as a gating artifact.

**Permitted:**
- Require VSC PASS as a precondition before a workflow step (splice, deployment, remediation, escalation)
- Store a VSC verification result as a gating artifact in pipeline state
- Reference an Evidence Bundle or ZIP Handoff Artifact as the evidence associated with a workflow decision
- Branch or halt a workflow on VSC FAIL or ERROR

**Required:**
- Stop or branch the workflow if VSC returns FAIL or ERROR — a workflow that silently continues past a VSC FAIL is not conformant
- Store `vsc_result_class` accurately — must not suppress FAIL to continue a gated workflow
- Declare `semantic_boundary.external_claim: "workflow gating and pipeline state"`

**Prohibited:**
- Treating a cached or stale VSC PASS as valid if the Evidence Bundle has since changed
- Bypassing VSC verification to unblock a workflow gate
- Relabeling a VSC FAIL as "acceptable" without creating a separate documented exception record

**Workflow receipt role in the evidence chain:**
```
VSC Evidence Bundle → verify-bundle → PASS
     ↓
Workflow Gate → checks vsc_result_class == "PASS"
             → records receipt: vsc_result_class: "PASS", workflow step: "approved"
             → continues pipeline

VSC Evidence Bundle → verify-bundle → FAIL
     ↓
Workflow Gate → checks vsc_result_class == "FAIL"
             → stops or branches
             → records receipt: vsc_result_class: "FAIL", workflow step: "halted"
```

---

## 14. Receipt Integrity

An External Receipt is itself an artifact that may be transmitted, stored, or shared. Receipt integrity means the receipt itself has not been tampered with since it was issued.

**Rules:**

| Rule | Requirement |
|------|-------------|
| **Preferred: content-addressed** | Receipts should include a hash of their own canonical content in `integrity_ref`, enabling later verification that the receipt was not modified |
| **Preferred: signed** | Receipts should be signed by the issuing system where cryptographic signing is available |
| **Receipt integrity ≠ evidence validity** | A signed receipt proves the receipt was not tampered with. It does not prove that the VSC Evidence Bundle is valid — that requires running `verify-bundle` on the bundle itself |
| **No copying mutable content** | Receipts should reference VSC evidence by stable IDs and hashes rather than copying file contents — copied content may go stale; hash references remain stable |
| **Null integrity_ref** | If receipt integrity is managed externally (e.g. stored in an append-only log), `integrity_ref` may be declared as `null`, but must be present in the receipt structure and must not be omitted |

**Integrity chain separation:**
```
Receipt integrity (signature / hash over receipt content)
     ≠
VSC evidence integrity (checksums.sha256 over bundle files)

Both must be verified independently.
One does not substitute for the other.
```

---

## 15. Custody and Handoff

Receipts may document the custody chain of a VSC Evidence Bundle or ZIP Handoff Artifact — who transmitted it, who received it, who reviewed it, and when.

**Rules:**

| Rule | Requirement |
|------|-------------|
| **Custody is metadata** | Custody records document the movement of artifacts, not the validity of their contents. A valid custody chain does not imply a passing verification result. |
| **Separate from canonical evidence** | Custody metadata must be in the receipt's `metadata` or `custody_ref` field — not inside the Evidence Bundle's canonical files |
| **ZIP as transport artifact** | A ZIP Handoff Artifact may be referenced in a custody receipt as the artifact transmitted (`zip:<filename>`). Receipt must note that ZIP is a transport artifact, not a new evidence format. |
| **Custody does not alter verification** | Receiving a ZIP via a documented custody chain does not change the verification result. The recipient must still run `verify-bundle` on the extracted bundle to confirm integrity. |

**Example custody sequence:**
```
Step 1: VSC exports bundle → verify-bundle → PASS
Step 2: zip-bundle → ZIP Handoff Artifact created
Step 3: Sender custody receipt → "transmitted zip:<filename> to recipient-system at T"
Step 4: Recipient custody receipt → "received zip:<filename> from sender-system at T"
Step 5: Recipient runs verify-bundle on extracted bundle → independent PASS
```

Each step produces its own receipt. The custody receipts document transmission. Step 5 confirms the extracted bundle still passes independent verification.

---

## 16. Interop Verification Semantics

A verifier that processes External Receipts (as opposed to VSC Evidence Bundles) must apply distinct verification rules.

**A receipt verifier may check:**

| Check | Description |
|-------|-------------|
| **Referenced artifact existence** | Does the `bundle_id` or `event_hash` in `vsc_reference` correspond to a known, accessible VSC artifact? |
| **Result class consistency** | Does `vsc_result_class` in the receipt match the actual verification result of the referenced bundle at the referenced time? |
| **Receipt integrity** | Does the `integrity_ref` digest match the receipt's canonical content? |
| **Boundary declaration presence** | Is `semantic_boundary` present and does it include `no_redefinition: true`? |
| **Issuer declaration** | Is the `issuer` field present with both `system` and `role`? |
| **Profile recognition** | Is the `profile` declared a recognized Interop Receipt Profile version? |

**A receipt verifier must distinguish:**

| Receipt validity | VSC evidence validity |
|-----------------|----------------------|
| The receipt is well-formed and its integrity check passes | The VSC Evidence Bundle it references passes `verify-bundle` |
| These are independent checks | A valid receipt does not imply a passing bundle; a passing bundle does not depend on the existence of a receipt |

---

## 17. Invalid Receipt Cases

The following receipt conditions are explicitly invalid under the v2.3 Interop Receipt Profile. A receipt verifier must flag these as `INVALID_RECEIPT`.

| Case | Description | Violation |
|------|-------------|-----------|
| **Missing bundle** | Receipt references a bundle ID that does not exist or is inaccessible | `vsc_reference` points to nothing verifiable |
| **Result override** | Receipt stores `vsc_result_class: "PASS"` when the referenced bundle returned FAIL | Violates result preservation rule (§9) |
| **PROOF-ONLY as PASS** | Receipt treats a PROOF-ONLY artifact as PASS | Violates result class semantics |
| **Missing boundary** | Receipt omits `semantic_boundary` or sets `no_redefinition: false` | Violates boundary declaration requirement (§10) |
| **Canonical mutation** | Receipt issuer modified a file inside the Evidence Bundle and still claims the original VSC result | Violates source bundle immutability |
| **Legal responsibility claim** | Receipt claims that VSC PASS proves legal responsibility of an identified actor | VSC does not decide legal responsibility |
| **Identity proof claim** | Receipt claims that VSC alone proves human identity | VSC does not identify humans |
| **Stale result** | Receipt stores a VSC PASS from a previous verification, but the bundle has since been modified and now returns FAIL | `vsc_result_class` must reflect the current bundle state, not a cached historical result |

---

## 18. Security Invariants

The following security invariants must hold for all External Receipts conformant with the v2.3 Interop Receipt Profile:

| Invariant | Rule |
|-----------|------|
| **No result override** | No external system may change a VSC FAIL, ERROR, or PROOF-ONLY into a PASS through a receipt |
| **No canonical mutation** | No external system that issues a receipt may have modified any canonical VSC evidence object (bundle files, token files, checksums) |
| **No identity claim by VSC** | A receipt must not state or imply that VSC proves the identity of any human or actor |
| **No attribution claim by VSC** | A receipt must not state or imply that VSC determines legal responsibility or assigns fault |
| **No hidden promotion** | FAIL, ERROR, and PROOF-ONLY must not be silently promoted by adding additional receipt fields that imply the result was acceptable or passed |
| **Receipt integrity ≠ evidence validity** | A signed or hashed receipt proves receipt integrity only. Evidence validity requires independent `verify-bundle` execution. |
| **Boundary must be declared** | A receipt without an explicit `semantic_boundary` block is structurally incomplete and must not be treated as conformant |
| **Stale result prohibition** | A receipt must not present a cached historical VSC PASS if the referenced bundle has since changed |

---

## 19. Non-Goals

| Non-Goal | Rationale |
|----------|-----------|
| **Replacing VSC verification** | An Interop Receipt references a verification result. It does not execute `verify-bundle` or substitute for it. |
| **Proving real-world truth** | A receipt documents that VSC verification occurred and what it returned. It does not prove that the recorded state reflects real-world truth. |
| **Identifying humans** | `actor_ref` is a reference field. Identity claims come from identity/trust layers, not from VSC receipts. |
| **Deciding legal responsibility** | Attribution and responsibility are external-layer concerns. A receipt may reference attribution context but does not decide responsibility. |
| **Requiring blockchain** | Receipt integrity is achieved through hashing and signing, not through distributed ledger participation. |
| **Requiring one partner system** | The Interop Receipt Profile is system-neutral. TBN, CLARIXO, AntifragileOS, and any other external system may implement it. |
| **Governing partner systems** | This profile defines how external systems reference VSC evidence. It does not govern how those systems operate internally. |

---

## 20. Roadmap

| Version | Title | Scope |
|---------|-------|-------|
| **v2.4** | Go Core Prototype Preparation | Interface design for Go implementation of the VSC verifier, event canonicalization, and receipt validation, based on v2.0–v2.3 specifications |
| **v2.5** | Minimal Go Verifier Prototype | First Go implementation of the VSC verifier tested against v2.2 conformance vectors; initial receipt structure validation |
| **v2.6** | Machine-Readable Schema Drafts | JSON Schema drafts for Evidence Bundle manifests, Canonical Events, and Interop Receipts; formal schema validation tooling |
| **v3.0** | Enterprise Verification Engine | Production-grade multi-bundle, multi-event, policy-driven verification; receipt processing pipeline; integration APIs; audit trail generation; full v2.2 conformance |

The v1.x Node.js reference implementation does not yet produce or verify External Receipts. Receipt generation and receipt verification are planned for v2.5 and v2.6.

---

## Appendix A: Term Glossary

| Term | Definition |
|------|-----------|
| **Interop Receipt** | A structured record created by an external system that references VSC evidence outputs |
| **External Receipt** | Synonym for Interop Receipt |
| **VSC reference** | A field in a receipt pointing to a specific VSC evidence object by stable identifier or hash |
| **Evidence Bundle reference** | Receipt reference to an Evidence Bundle by bundle directory name |
| **Canonical Event reference** | Receipt reference to a Canonical Event by `event_id` |
| **event_hash reference** | Receipt reference to a Canonical Event by its SHA-256 content hash |
| **Verification Result reference** | Receipt reference to a specific `verify-bundle` execution result |
| **Result preservation** | The requirement that a receipt must not change the VSC result class it documents |
| **Semantic boundary** | The explicit declaration in a receipt of what VSC claims and what the external system claims |
| **No redefinition rule** | The core constraint: external systems may not redefine VSC verification result semantics |
| **Receipt integrity** | The property that the receipt itself has not been tampered with since issuance |
| **Custody metadata** | Records documenting who transmitted, received, or reviewed an evidence artifact |
| **Upstream evidence** | A VSC verification result used as an input to an external system's own assessment |
| **Decision-state verification** | VSC's specific claim: the state chain is complete, consistent, and unmodified |
| **Identity / trust layer** | External systems (e.g. TBN) responsible for identity attestation and trust — outside VSC scope |
| **Responsibility / attribution context** | External systems (e.g. CLARIXO) responsible for assigning accountability — outside VSC scope |

---

## Appendix B: Receipt Profile Identifiers

Receipt `profile` field values and their meaning:

| Profile Identifier | Meaning |
|-------------------|---------|
| `vsc-interop-receipt-v2.3-draft` | Draft profile; fields and formats may change before finalization |
| `vsc-interop-receipt-v2.3` | Final v2.3 profile (not yet released; pending v2.3 finalization) |
| `vsc-interop-receipt-tbn-v2.3-draft` | TBN-specific receipt profile extension under v2.3-draft base |
| `vsc-interop-receipt-clarixo-v2.3-draft` | CLARIXO-specific receipt profile extension under v2.3-draft base |

System-specific profile extensions must inherit and preserve all v2.3 base profile requirements. They may add fields but must not remove required fields or override result class semantics.

---

## Appendix C: Relation to v1.x Reference Artifacts

| v2.3 Concept | v1.x Reference Artifact |
|-------------|------------------------|
| Evidence Bundle reference | Bundle directory name in `output/json-event-bundles/` |
| Chain Token reference | `chain-token.json` `chainTokenId` field |
| Base Token reference | `chain-token.json` `baseTokenId` field |
| Latest Token reference | `chain-token.json` `latestTokenId` field |
| Verification Result reference | `verification-summary.json` in the Evidence Bundle |
| ZIP Handoff Artifact reference | `.zip` filename in `output/zips/` |
| Canonical Event reference | `event-summary.json` `session_id` (v1.x session-level analog) |

Receipts referencing v1.x bundles should use the bundle directory name as `bundle_id` and the chain token ID from `chain-token.json` as `chain_token_id`. The `verification-summary.json` inside the bundle is the recommended `verification_result_ref` target.

---

*VSC v2.3 Interop Receipt Profile Draft — © DigiEmu / VSC Project*  
*This document is a draft specification. No source code, token formats, evidence bundle formats, or partner-specific code are changed.*
