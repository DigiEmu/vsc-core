# VSC v2.1 — Canonical Event Model Draft

**Status:** Draft  
**Version:** v2.1-draft  
**Date:** 2026-06-21  
**Depends on:** [VSC v2.0 Formal Specification Draft](vsc-v2-0-formal-specification-draft.md)  
**Reference Implementation:** VSC v1.x (Node.js)

---

> This document is a draft specification for the VSC Canonical Event Model.
> It defines the structure, identity, ordering, and verification semantics of
> individual VSC events. No source code, token formats, or evidence bundle
> formats are changed by this document.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Relationship to VSC v2.0](#2-relationship-to-vsc-v20)
3. [Canonical Event Definition](#3-canonical-event-definition)
4. [Required Fields](#4-required-fields)
5. [Optional Fields](#5-optional-fields)
6. [Suggested JSON Shape](#6-suggested-json-shape)
7. [Event Identity](#7-event-identity)
8. [Canonicalization Rules](#8-canonicalization-rules)
9. [Ordering Rules](#9-ordering-rules)
10. [State Transition Semantics](#10-state-transition-semantics)
11. [Event Types](#11-event-types)
12. [Evidence References](#12-evidence-references)
13. [Relationship to Delta Tokens](#13-relationship-to-delta-tokens)
14. [Relationship to Evidence Bundles](#14-relationship-to-evidence-bundles)
15. [Verification Semantics](#15-verification-semantics)
16. [Non-Canonical Metadata](#16-non-canonical-metadata)
17. [Interop Boundary](#17-interop-boundary)
18. [Security Invariants](#18-security-invariants)
19. [Non-Goals](#19-non-goals)
20. [Roadmap](#20-roadmap)

---

## 1. Purpose

This document defines the **smallest verifiable event unit** in VSC: the **Canonical Event**.

A Canonical Event is a structured, state-relevant record that captures one of:
- A state-relevant transition (a change from one state to another)
- A state-relevant observation (a recorded condition without state change)
- A decision or approval that affected subsequent state
- An evidence-producing step (a tool call, model output, or policy check that generated verifiable artifacts)

The event model exists to support two properties:

1. **Deterministic reconstruction** — given a sequence of Canonical Events, a verifier or reviewer can reconstruct the full history of state transitions step by step
2. **Later verification** — each event carries enough structured information for an independent verifier to confirm its integrity without access to the source system

This is a draft specification. No implementation change is required by this document. The v1.x JSON event evidence bundles (`event-schema.json`, `event-summary.json`, `json-benchmark-summary.json`) are the current reference material against which this draft is written.

---

## 2. Relationship to VSC v2.0

The VSC v2.0 Formal Specification defines the overall evidence model: Base Tokens, Delta Tokens, Chain Tokens, Evidence Bundles, ZIP Handoff Artifacts, and verifier behavior. (See [`vsc-v2-0-formal-specification-draft.md`](vsc-v2-0-formal-specification-draft.md).)

VSC v2.1 defines the **canonical structure of individual events** — the sub-token-level evidence unit that explains *why* and *how* a state transition occurred.

| Layer | Defined by | Scope |
|-------|-----------|-------|
| Evidence Bundle structure, verifier rules | v2.0 | Bundle, tokens, checksums, manifest |
| Individual event structure and identity | **v2.1** | Per-event canonical form, ordering, hashing |

Canonical Events may be referenced by:
- **Delta Tokens** — a delta may reference one or more events that caused the transition
- **Evidence Bundles** — an event summary or schema may be included as a bundle artifact
- **Handoff Reports** — a human-readable record of events may accompany a bundle
- **External interoperability receipts** — TBN, CLARIXO, or other systems may reference event IDs or hashes

---

## 3. Canonical Event Definition

A **VSC Canonical Event** is a structured, state-relevant record with the following properties:

- **Structured** — it serializes to canonical JSON with stable field ordering
- **State-relevant** — it records or references a state transition, observation, or evidence-producing step
- **Identifiable** — it has a stable `event_id` derived from or bound to its canonical content hash
- **Verifiable** — its `event_hash` is computed over its canonicalized content, enabling later integrity checking
- **Ordered** — it carries a `sequence_index` placing it within a chain or bundle event sequence

A Canonical Event **may** reference:
- Previous and next state (via `input_state_hash`, `output_state_hash`)
- A Delta Token or transition artifact (via `delta_ref`)
- A policy, actor, model, or tool involved (via `policy_ref`, `actor_ref`, `model_ref`, `tool_refs`)
- One or more evidence artifacts (via `evidence_refs`)
- An Evidence Bundle it belongs to (via `bundle_ref`)
- A verification result (via `verification_ref`)
- External receipts from interoperating systems (via `external_receipt_refs`)

A Canonical Event **must not** claim trust, identity, or legal validity by itself. Those claims belong to external systems that consume event evidence.

---

## 4. Required Fields

Every Canonical Event must include the following fields. A Canonical Event missing any required field is structurally invalid and must not achieve PASS.

| Field | Type | Description |
|-------|------|-------------|
| `event_id` | string | Stable unique identifier for this event. Must be derived from or bound to `event_hash`. Must change if any canonical field changes. |
| `event_type` | string | Declared event type (see §11 for defined types). Must be one of the declared types or a namespaced extension. |
| `event_version` | string | Version of the Canonical Event model this event conforms to (e.g. `"2.1-draft"`). |
| `sequence_index` | integer | Position of this event within its containing sequence. Must be unique within scope unless explicitly scoped. |
| `timestamp` | string | ISO 8601 UTC timestamp of when the event occurred or was recorded. |
| `input_state_hash` | string | Hash of the state immediately before this event. Format: `sha256:<hex>`. May be `null` for the first event in a chain. |
| `output_state_hash` | string | Hash of the state immediately after this event. Format: `sha256:<hex>`. |
| `delta_ref` | string | Reference to the Delta Token or transition artifact this event is associated with. Format: `delta:<id>`. May be `null` if not yet bound. |
| `canonicalization_profile` | string | Identifier of the canonicalization profile used to compute `event_hash`. Determines which fields are included in the canonical hash and how. |
| `event_hash` | string | SHA-256 hash of the canonicalized event content, computed according to `canonicalization_profile`. Format: `sha256:<hex>`. |

---

## 5. Optional Fields

The following fields are optional. Their absence does not invalidate an event, but their presence must conform to the types and semantics defined here.

| Field | Type | Description |
|-------|------|-------------|
| `actor_ref` | string | Reference to the actor (human, system, or model) that produced or triggered this event. Format: `actor:<id>`. Not an identity proof. |
| `policy_ref` | string | Reference to the policy or rule that governed this event. Format: `policy:<id>`. |
| `model_ref` | string | Reference to the model involved in producing this event. Format: `model:<id>`. |
| `tool_refs` | string[] | References to tools invoked during this event. Format: `tool:<id>`. |
| `evidence_refs` | string[] | Content-addressed references to evidence artifacts (files, tokens, reports, receipts). |
| `bundle_ref` | string | Reference to the Evidence Bundle this event belongs to. Format: `bundle:<id>`. |
| `verification_ref` | string | Reference to a verification result associated with this event. Format: `verify:<id>`. |
| `external_receipt_refs` | string[] | References to receipts issued by external systems (TBN, CLARIXO, etc.) for this event. |
| `metadata` | object | Non-canonical metadata for display or tooling purposes. Must not affect `event_hash`. Must be declared as non-canonical. |

---

## 6. Suggested JSON Shape

The following example illustrates a Canonical Event in JSON form. Field names are stable. Hash values and references are shown as placeholders. **This is not the final enforced schema** — field names and formats may be refined before v2.1 is finalized.

```json
{
  "event_id": "evt_7a3f2c1d9e8b4a0f",
  "event_type": "decision",
  "event_version": "2.1-draft",
  "sequence_index": 42,
  "timestamp": "2026-06-21T14:00:00Z",
  "input_state_hash": "sha256:4b2d9e1f3a7c8d0e5f6a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e",
  "output_state_hash": "sha256:9e1f3a7c8d0e5f6a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a",
  "delta_ref": "delta:408C8C13C4D4-to-ED9566562A13",
  "actor_ref": "actor:optional",
  "policy_ref": "policy:optional",
  "model_ref": "model:optional",
  "tool_refs": [
    "tool:optional-tool-a"
  ],
  "evidence_refs": [
    "bundle:file:json-benchmark-summary.json",
    "token:408C8C13C4D4"
  ],
  "bundle_ref": "bundle:vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13",
  "verification_ref": "verify:PASS:2026-06-21T14:01:00Z",
  "external_receipt_refs": [],
  "canonicalization_profile": "vsc-json-c14n-v1",
  "event_hash": "sha256:c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
  "metadata": {
    "_non_canonical": true,
    "display_label": "Session decision at step 42",
    "reviewer_note": "Display-only — not included in event_hash"
  }
}
```

**Notes on the example:**
- `metadata._non_canonical: true` explicitly marks the metadata block as excluded from `event_hash`
- All hash values are placeholder hex strings — real values are computed at event creation time
- `actor_ref`, `policy_ref`, `model_ref` are optional and carry no trust claim by themselves
- `external_receipt_refs` is an empty array here; populated receipts would carry external system references

---

## 7. Event Identity

**`event_id`** is the stable identifier of a Canonical Event.

Rules:
- `event_id` must be derived from canonical event content or be directly bound to `event_hash`
- A simple valid approach: `event_id = "evt_" + first_16_hex_chars_of(event_hash)`
- `event_id` must remain **stable** if no evidence-critical (canonical) field changes
- `event_id` must **change** if any field included in the canonical hash changes
- Changing only non-canonical metadata (e.g. `metadata`) must not alter `event_id`

**`event_hash`** is the cryptographic integrity anchor.

Rules:
- `event_hash` must be calculated over canonicalized event content according to the declared `canonicalization_profile`
- The canonicalization profile determines exactly which fields are included and how they are serialized before hashing
- `event_hash` must be reproducible: given the same canonical fields and the same profile, the same hash must result
- `event_hash` must use SHA-256 as the minimum required algorithm (format: `sha256:<hex>`)

**Relationship:** `event_id` is for reference and lookup. `event_hash` is for integrity verification. Both must be consistent — an `event_id` that does not correspond to a verifiable `event_hash` is not a valid Canonical Event identity.

---

## 8. Canonicalization Rules

A Canonical Event's `event_hash` is only meaningful if the canonicalization process is deterministic and unambiguous.

**Required rules for any conformant `canonicalization_profile`:**

| Rule | Requirement |
|------|-------------|
| **Deterministic serialization** | The same canonical fields must always produce the same byte sequence before hashing |
| **Stable field ordering** | Fields included in the canonical hash must appear in a declared, fixed order |
| **Whitespace exclusion** | Whitespace (spaces, newlines) outside of string values must not affect the hash |
| **Non-canonical exclusion** | Fields declared as non-canonical (e.g. the `metadata` block) must be excluded from the canonical hash |
| **Unknown field treatment** | Unknown fields must not silently affect PASS. A `canonicalization_profile` must declare whether unknown fields are included, excluded, or cause ERROR |
| **Profile declaration** | Every event must declare its `canonicalization_profile`. A verifier must reject an event whose profile it does not recognize |
| **Hash algorithm declaration** | The `event_hash` format prefix (`sha256:`) declares the algorithm. A verifier must not assume a default algorithm |

**Reference profile:** `vsc-json-c14n-v1`

The `vsc-json-c14n-v1` profile is the draft reference canonicalization profile for VSC v2.1. It defines:
- Alphabetical field ordering for required fields before serialization
- Exclusion of the `metadata` block
- SHA-256 over the resulting UTF-8 JSON bytes with no trailing whitespace
- Unknown fields are excluded (not an error in draft mode)

This profile is not yet finalized and will be formalized in v2.2 conformance test vectors.

---

## 9. Ordering Rules

Canonical Events are meaningful only in a defined order. An unordered set of events is not a Canonical Event sequence.

**Rules:**

| Rule | Requirement |
|------|-------------|
| **`sequence_index` defines order** | Events are ordered by ascending `sequence_index` within a chain or bundle scope |
| **Deterministic ordering** | Events must be ordered deterministically before chain construction. The ordering must not depend on wall-clock arrival time if `sequence_index` is already assigned |
| **Uniqueness within scope** | Duplicate `sequence_index` values are invalid unless explicitly scoped to different sub-sequences (e.g. different session IDs) |
| **Gap detection** | Missing `sequence_index` values (e.g. 1, 2, 4 — gap at 3) must be detected and reported. A gap may indicate an incomplete event chain |
| **First event** | The first event in a sequence may have `input_state_hash: null` if no prior state exists |
| **Continuity invariant** | `output_state_hash` of event N should equal `input_state_hash` of event N+1. Discontinuity must be detected and reported |

---

## 10. State Transition Semantics

Each Canonical Event records a state transition through its hash references:

| Field | Meaning |
|-------|---------|
| `input_state_hash` | Identifies the system state immediately before this event was processed |
| `output_state_hash` | Identifies the system state immediately after this event was processed |
| `delta_ref` | Links this event to the Delta Token or transition artifact that encodes the state change |

**Verification semantics:**

A verifier comparing events to token-level state:
- May compare `input_state_hash` and `output_state_hash` against corresponding token state references
- Must treat a hash mismatch between event and token as a structural inconsistency
- Must not treat a match as a semantic truth claim — hash consistency means structural agreement, not that the transition was correct or appropriate

**Chain continuity:**

```
Event[0]: null → output_state_hash[0]
Event[1]: input_state_hash[1] = output_state_hash[0]  → output_state_hash[1]
Event[2]: input_state_hash[2] = output_state_hash[1]  → output_state_hash[2]
...
Event[N]: input_state_hash[N] = output_state_hash[N-1] → output_state_hash[N]
```

A break in this chain (any `input_state_hash[i] ≠ output_state_hash[i-1]`) indicates a gap, reordering, or modification and must be reported.

---

## 11. Event Types

The following event types are defined for VSC v2.1. Types are extensible but must be explicitly declared — an unknown, undeclared type must not silently pass verification.

| Event Type | Description |
|------------|-------------|
| `decision` | A choice was made that affected subsequent state. May reference policy, actor, and model. |
| `observation` | A condition was recorded without producing a state change. |
| `policy_check` | A policy rule was evaluated. Records the policy reference and outcome. |
| `tool_call` | An external tool was invoked. Records inputs, outputs, and tool reference. |
| `model_output` | A model produced an output that became evidence. Records model reference and output hash. |
| `human_approval` | A human reviewed and approved a state or decision. Records actor reference and timestamp. |
| `external_receipt` | An external system issued a receipt referencing this event. Records the receipt reference. |
| `verification` | A verification result was recorded as an event in the sequence. |
| `handoff` | The evidence artifact was handed off to another party or system. Records bundle and recipient references. |
| `system_checkpoint` | A system-level state snapshot was recorded. Used for periodic anchoring of state chains. |

**Extension types** must use a namespaced format: `<namespace>:<type>` (e.g. `clarixo:attribution_assignment`). Extension types must be declared in the event schema of any bundle that uses them.

---

## 12. Evidence References

`evidence_refs` links a Canonical Event to the artifacts that constitute its evidence.

**Rules:**

| Rule | Requirement |
|------|-------------|
| **Content addressing** | Evidence references should be content-addressed where possible (e.g. `sha256:<hash>` or `bundle:file:<filename>`) |
| **No implicit trust** | An evidence reference does not imply that the referenced artifact is trusted, verified, or authoritative. It is a pointer, not a certification |
| **External attribution** | Trust, identity, and legal attribution associated with a referenced artifact come from external systems, not from the reference itself |
| **Bundle-internal references** | References to files within an Evidence Bundle should use `bundle:file:<relative-path>` format |
| **Token references** | References to VSC tokens should use `token:<token-id>` format |
| **External system references** | References to receipts or records from external systems should use `external:<system>:<id>` format |

Evidence references enable traceability — a reviewer can follow the chain from a Canonical Event to its evidence artifacts, to the Evidence Bundle, and to independent verification — without requiring access to the source system.

---

## 13. Relationship to Delta Tokens

A Delta Token (defined in VSC v2.0 §6) records a state transition as a proof artifact. A Canonical Event records *why* or *how* that transition occurred.

**Relationship rules:**

| Relationship | Description |
|-------------|-------------|
| **Event explains delta** | An event may carry the contextual record of why a Delta Token was created — the decision, tool call, or observation that caused the transition |
| **Delta may reference events** | A Delta Token may include references to one or more Canonical Event IDs or hashes |
| **One-to-one** | A single Canonical Event may correspond directly to one state transition and one Delta Token |
| **Many-to-one** | A batch of Canonical Events may correspond to a single Delta Token (e.g. a set of observations that together triggered one state change) |
| **One-to-many** | A single Canonical Event may reference multiple Delta Tokens if the event triggered branching or parallel transitions (uncommon; must be explicitly declared) |

**Invariant:** `delta_ref` in a Canonical Event is a reference, not a proof. A verifier must not treat the presence of `delta_ref` as confirmation that the Delta Token exists or passes verification. The Delta Token must be verified separately.

---

## 14. Relationship to Evidence Bundles

An Evidence Bundle (defined in VSC v2.0 §8) may include event-related artifacts that provide context beyond the token structure.

**In v1.x JSON Event Evidence Bundles, the following event artifacts are included:**

| File | Role |
|------|------|
| `event-schema.json` | Declares the event types and field structure used in this bundle |
| `event-summary.json` | Session-level summary of events, including session ID and aggregate metrics |
| `json-benchmark-summary.json` | Benchmark evidence for the event session |

**Rules for event artifacts in Evidence Bundles:**

| Rule | Requirement |
|------|-------------|
| **Manifest description** | The bundle `manifest.json` must describe any event-related files it includes |
| **Checksum binding** | `checksums.sha256` must bind all included event files — event artifacts are evidence, not decoration |
| **External reference option** | Full event records may be referenced externally rather than included directly, as long as references are verifiable |
| **Schema declaration** | If event types or fields are customised, an `event-schema.json` must declare the customisation |

---

## 15. Verification Semantics

Verification of a Canonical Event has two distinct layers that must not be conflated:

**Structural validity** (what a VSC verifier checks):
- All required fields are present
- `event_hash` matches the canonicalized content according to the declared `canonicalization_profile`
- `sequence_index` is consistent with adjacent events
- `input_state_hash` and `output_state_hash` are consistent with adjacent state references
- `delta_ref` points to an existing and verifiable Delta Token (if full bundle verification is in scope)

**Semantic trust** (outside VSC verifier scope):
- Whether the actor identified by `actor_ref` was authorised to take the action
- Whether the model identified by `model_ref` was appropriate for the context
- Whether the decision recorded was correct, ethical, or legally compliant
- Whether external receipts in `external_receipt_refs` are authentic

**Result mapping:**

| Situation | Result |
|-----------|--------|
| All required fields present, `event_hash` matches canonical content | PASS (structural) |
| Required field missing | FAIL |
| `event_hash` does not match canonical content | FAIL |
| Unknown `canonicalization_profile` | ERROR |
| Malformed JSON or unparseable event | ERROR |
| Structural PASS but semantic trust unresolved | PASS (structural) — semantic trust is external |

---

## 16. Non-Canonical Metadata

Some metadata is useful for display, tooling, or debugging but must not be part of the canonical event hash.

**Rules:**

| Rule | Requirement |
|------|-------------|
| **Explicit separation** | Non-canonical metadata must be clearly separated from canonical fields (e.g. in a dedicated `metadata` block) |
| **Declared exclusion** | The `canonicalization_profile` must explicitly declare that the `metadata` block is excluded from `event_hash` |
| **Identity stability** | Changing only non-canonical metadata must not alter `event_id` or `event_hash` |
| **Identity change** | Changing any canonical field must alter `event_hash` and therefore `event_id` |
| **No hidden canonical fields** | A field that affects PASS must not be placed in the `metadata` block |
| **Tooling note** | Tools that add display labels, reviewer notes, or workflow annotations must place them in `metadata`, not in canonical fields |

**Examples of non-canonical metadata:**
- `display_label` — a human-readable label for UI display
- `reviewer_note` — a note added by a reviewer after the fact
- `workflow_stage` — an internal pipeline tag
- `_non_canonical: true` — explicit machine-readable marker

---

## 17. Interop Boundary

VSC Canonical Events are designed to interoperate with external systems through reference, not through semantic absorption.

**Rules:**

| System | Interop Pattern |
|--------|----------------|
| **TBN** | May reference `event_id` or `event_hash` in trust or identity receipts. The receipt points to the event; it does not replace VSC verification semantics. |
| **CLARIXO** | May store `event_hash` as upstream evidence for attribution context. Attribution is external to VSC — VSC records the event, CLARIXO assigns responsibility. |
| **Any external system** | Must not redefine VSC canonicalization semantics. Must not relabel a structural FAIL as PASS. Must not mutate canonical event content. |
| **External receipts** | May be added to `external_receipt_refs` without altering canonical fields. Adding a receipt must not change `event_hash`. |

**Interop principle:** External systems consume VSC event evidence by referencing it. They do not rewrite it.

---

## 18. Security Invariants

The following invariants must hold for any conformant implementation of the VSC Canonical Event Model:

| Invariant | Rule |
|-----------|------|
| **Required fields** | No PASS if any required canonical field is missing |
| **Hash consistency** | No PASS if `event_hash` does not match the canonicalized content according to the declared profile |
| **No silent reordering** | Events must not be silently reordered. Reordering must be detected and reported |
| **No hidden mutation** | Canonical fields must not be modified after `event_hash` is computed. Any post-hoc change to a canonical field breaks the event identity |
| **No trust from hash alone** | The existence of a valid `event_hash` does not imply that the recorded event was correct, authorised, or semantically trustworthy |
| **No mixing without declaration** | Non-canonical metadata must not be placed in canonical fields, and canonical fields must not be silently placed in the metadata block |
| **Profile must be known** | A verifier that encounters an unknown `canonicalization_profile` must report ERROR, not PASS |
| **Fail-closed** | Any unresolvable structural inconsistency must result in non-zero exit |

---

## 19. Non-Goals

The following are explicit non-goals of the VSC Canonical Event Model:

| Non-Goal | Rationale |
|----------|-----------|
| **Human identification** | `actor_ref` is a reference, not an identity proof. VSC records that an actor reference was present; it does not verify who the actor was. |
| **Legal responsibility proof** | Recording an event does not assign or prove legal responsibility. That is a function of external governance systems. |
| **Real-world truth certification** | `event_hash` binds the canonical content of the event record. It does not certify that the recorded content reflects real-world truth. |
| **Blockchain requirement** | Hash integrity is achieved through SHA-256 and ordered structure. No distributed ledger is required. |
| **Single programming language** | The event model is defined in language-independent terms. Any language may implement it. |
| **Policy governance replacement** | The `policy_ref` field points to a policy. It does not evaluate, enforce, or replace governance frameworks. |
| **Generic log format** | A Canonical Event is not a generic log line. It is a structured, ordered, hash-bound, verifiable evidence unit with declared semantics. |

---

## 20. Roadmap

| Version | Title | Scope |
|---------|-------|-------|
| **v2.2** | Conformance Test Vectors | A canonical set of valid and intentionally invalid Canonical Events for testing conformance of any VSC implementation, including event hash verification, ordering, and canonicalization profile conformance |
| **v2.3** | Interop Receipt Profile | Formal definition of how external systems (TBN, CLARIXO, etc.) should reference VSC Canonical Events in receipts, attribution records, and governance artifacts |
| **v2.4** | Go Core Prototype Preparation | Design of the Go implementation interface for Canonical Event serialization, hashing, and verification, based on the v2.1 draft and v2.2 conformance vectors |
| **v3.0** | Enterprise Verification Engine | Production-grade multi-bundle, multi-event verification with policy-driven rules, integration APIs, and audit trail generation |

The v1.x Node.js JSON event evidence bundle (`event-schema.json`, `event-summary.json`, `json-benchmark-summary.json`) serves as the reference implementation material for the concepts defined here.

---

## Appendix A: Term Glossary

| Term | Definition |
|------|-----------|
| **Canonical Event** | The smallest verifiable VSC evidence unit: a structured, state-relevant, hash-bound event record |
| **`event_id`** | Stable identifier derived from or bound to `event_hash`; must change if any canonical field changes |
| **`event_hash`** | SHA-256 hash of canonicalized event content; the integrity anchor of the Canonical Event |
| **`canonicalization_profile`** | Declared identifier of the algorithm used to serialize and hash canonical event fields |
| **`input_state_hash`** | Hash of the state immediately before this event |
| **`output_state_hash`** | Hash of the state immediately after this event |
| **`delta_ref`** | Reference to the Delta Token or transition artifact associated with this event |
| **`sequence_index`** | Integer position of this event within its containing ordered sequence |
| **Structural validity** | The property that all required fields are present and `event_hash` matches canonical content |
| **Semantic trust** | Claims about correctness, authorization, or real-world accuracy — outside VSC verifier scope |
| **Non-canonical metadata** | Fields useful for display or tooling that are explicitly excluded from `event_hash` |
| **Evidence Bundle** | (v2.0) Portable directory artifact containing all files required for verification |
| **Delta Token** | (v2.0) Token representing one ordered state transition |
| **Deterministic reconstruction** | The property that a sequence of Canonical Events always produces the same state history |

---

## Appendix B: Relation to v1.x Reference Artifacts

| v2.1 Concept | v1.x Reference Artifact |
|-------------|------------------------|
| Canonical Event schema | `event-schema.json` in JSON event evidence bundles |
| Event session summary | `event-summary.json` (includes session ID, aggregate metrics) |
| Benchmark event evidence | `json-benchmark-summary.json`, `json-benchmark-report.md` |
| Event artifact checksum binding | Entries in `checksums.sha256` for event files |
| Event artifact manifest description | `manifest.json` sections describing event files |
| Bundle-level event reference | `bundle_ref` field in Canonical Events → bundle directory name |

The v1.x `event-schema.json` `session_id` field (`2F9047C9F1C1A3FF` in the v1.15 canonical bundle) is the closest current analog to the `event_id` concept for session-level identity. The v2.1 model formalizes this into per-event identity with cryptographic binding.

---

*VSC v2.1 Canonical Event Model Draft — © DigiEmu / VSC Project*  
*This document is a draft specification. No source code, token formats, or evidence bundle formats are changed.*
