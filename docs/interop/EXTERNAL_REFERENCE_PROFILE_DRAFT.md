# External Reference Profile Draft

Project: DigiEmu VSC / VSC Core  
Release context: v2.18  
Profile status: draft

## Purpose

This document defines a draft profile for referencing external artifacts from VSC bundles, verification reports, or related evidence metadata.

External artifacts may include:

- TBN trust receipts
- CLARIXO responsibility records
- external audit notes
- partner evidence records
- other external context artifacts

## Core boundary

```text
External references are pointers, not proof imports.
```

A VSC external reference points to an external artifact.

It does not mean that VSC has verified the external artifact.

It does not mean that VSC has absorbed or endorsed the external artifact's proof claims.

The core VSC boundary remains:

```text
VSC proves state integrity, not truth.
```

## Draft status

This profile is a draft.

It does not change:

- Go verifier behavior
- Node runner behavior
- CI workflow behavior
- conformance fixture semantics
- PASS / FAIL / ERROR meaning
- evidence bundle verification logic

## Minimum external reference object

A minimal external reference object should contain:

```json
{
  "profile": "vsc-external-reference-v2.18-draft",
  "reference_id": "ref-001",
  "reference_type": "tbn_receipt",
  "target_system": "TBN",
  "target_artifact_id": "receipt-123",
  "relation": "references_external_trust_context",
  "proof_boundary": "external_reference_only",
  "verified_by_vsc": false
}
```

## Required fields

### profile

Identifies the external reference profile.

Expected value:

```text
vsc-external-reference-v2.18-draft
```

### reference_id

A local identifier for the external reference.

Example:

```text
ref-001
```

### reference_type

The type of external artifact being referenced.

Allowed draft values:

```text
tbn_receipt
clarixo_record
external_audit_note
partner_evidence_record
other
```

### target_system

The external system or context being referenced.

Examples:

```text
TBN
CLARIXO
ExternalAudit
PartnerSystem
```

### target_artifact_id

The identifier of the external artifact in its own system or context.

VSC treats this as an external identifier.

### relation

Describes why the external artifact is being referenced.

Allowed draft values:

```text
references_external_trust_context
references_external_attribution_context
references_external_audit_context
references_partner_evidence
other
```

### proof_boundary

Must be:

```text
external_reference_only
```

This means the referenced artifact stays outside the VSC proof boundary.

### verified_by_vsc

Must be:

```json
false
```

in this draft profile.

This explicitly prevents confusion between referencing an artifact and verifying that artifact.

## Optional fields

Optional fields may include:

```json
{
  "target_artifact_hash": "sha256:...",
  "target_artifact_uri": "https://example.invalid/artifact",
  "issued_at": "2026-06-21T00:00:00Z",
  "issuer": "External system or organization",
  "notes": "VSC does not verify or absorb the external proof claim."
}
```

### target_artifact_hash

A hash supplied for external reference convenience.

If present, it does not mean VSC has verified the external artifact unless a future profile explicitly defines such behavior.

### target_artifact_uri

A URI or location string for the external artifact.

This is a pointer only.

### issued_at

Timestamp supplied by or about the external artifact.

VSC does not validate the external timestamp's trustworthiness in this draft.

### issuer

Human-readable external issuer or source.

### notes

Human-readable explanatory note.

## Example: TBN receipt reference

```json
{
  "profile": "vsc-external-reference-v2.18-draft",
  "reference_id": "ref-tbn-001",
  "reference_type": "tbn_receipt",
  "target_system": "TBN",
  "target_artifact_id": "tbn-receipt-agent-demo-001",
  "target_artifact_hash": "sha256:example-placeholder",
  "relation": "references_external_trust_context",
  "proof_boundary": "external_reference_only",
  "verified_by_vsc": false,
  "notes": "This reference points to a TBN trust receipt. VSC does not verify identity or trust status."
}
```

## Example: CLARIXO record reference

```json
{
  "profile": "vsc-external-reference-v2.18-draft",
  "reference_id": "ref-clarixo-001",
  "reference_type": "clarixo_record",
  "target_system": "CLARIXO",
  "target_artifact_id": "clarixo-responsibility-record-001",
  "target_artifact_hash": "sha256:example-placeholder",
  "relation": "references_external_attribution_context",
  "proof_boundary": "external_reference_only",
  "verified_by_vsc": false,
  "notes": "This reference points to a CLARIXO responsibility context record. VSC does not prove responsibility attribution."
}
```

## What VSC does not verify in this draft

VSC does not verify:

- whether the external artifact is true
- whether the external artifact is legally valid
- whether the external artifact proves identity
- whether the external artifact proves attribution
- whether the external artifact proves compliance
- whether the external artifact issuer is trusted
- whether the external artifact timestamp is authoritative

## Safe interpretation

Safe wording:

```text
This VSC report references an external artifact.
The external artifact remains outside the VSC proof boundary.
```

Unsafe wording:

```text
VSC verified the external artifact.
VSC imported the external proof claim.
VSC proved identity or attribution through the external reference.
```

## Summary

External references make VSC evidence easier to connect to broader trust ecosystems.

But references must remain clearly separated from proof claims.

```text
Pointer does not mean proof import.
Reference does not mean endorsement.
VSC proves state integrity, not truth.
```
