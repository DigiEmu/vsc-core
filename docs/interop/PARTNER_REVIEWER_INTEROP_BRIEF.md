# Partner / Reviewer Interop Brief

Project: DigiEmu VSC / VSC Core  
Release context: v2.25  
Status: partner / reviewer brief

## Purpose

This brief gives external partners and reviewers a compact overview of the VSC interoperability model.

It summarizes how VSC can safely reference external systems without taking over their proof domains.

This is a brief.

It does not implement new verifier behavior.

It does not implement external reference validation.

It does not create fixtures.

It does not start v3.0.

## One-paragraph summary

VSC is an evidence layer for verifiable AI decision-state integrity. It supports portable evidence bundles, deterministic reconstruction, comparison flows, and independent verification of VSC state evidence. VSC can also point to external artifacts such as trust receipts, responsibility records, audit notes, or partner evidence records, while keeping those external artifacts outside the VSC proof boundary.

## Core rule

```text
VSC can point outward without taking over external proof domains.
```

Related boundaries:

```text
VSC proves state integrity, not truth.
External references are pointers, not proof imports.
Reference validation is not artifact validation.
Shape validation checks the reference object, not the external artifact.
```

## Current interop status

The current interop model is documentation, draft profile, examples, and planning.

It includes:

- layer boundary notes
- external reference profile draft
- JSON Schema draft
- example external reference objects
- validation boundary notes
- pre-v3 roadmap
- shape-validation plan
- fixture plan
- consolidation summary

External reference validation is not implemented today.

External artifact validation is not implemented by VSC.

## Layer separation

A safe three-layer interpretation is:

```text
TBN      = identity / trust verification
VSC      = decision-state verification
CLARIXO  = responsibility / attribution context
```

Each layer may reference artifacts from another layer.

No layer should silently redefine the proof boundary of another layer.

## What an external reference means

An external reference means:

```text
This VSC-related object points to an external artifact.
```

It may help reviewers connect VSC evidence to external context.

Examples:

- a TBN receipt reference
- a CLARIXO record reference
- an external audit note reference
- a partner evidence record reference

## What an external reference does not mean

An external reference does not mean:

- VSC verified the external artifact
- VSC imported the external proof claim
- VSC proved identity
- VSC proved attribution
- VSC proved legal responsibility
- VSC proved compliance
- VSC proved truth
- VSC completed a production integration with the external system

## Safe handoff pattern

A safe handoff pattern is:

```text
External system creates its own artifact.
VSC records a reference to that artifact.
VSC keeps the reference marked as external_reference_only.
VSC verifies only its own state evidence.
External artifact validation remains with the external system or a separate explicit verifier.
```

## Example interpretation

Safe:

```text
This VSC evidence bundle references a TBN receipt as external trust context.
```

Unsafe:

```text
VSC verified the TBN receipt.
```

Safe:

```text
This VSC report references a CLARIXO record as external attribution context.
```

Unsafe:

```text
VSC proved CLARIXO attribution.
```

## Review questions for partners

Partners and reviewers may use these questions:

- Which artifact does your system produce?
- What proof claim does your system make?
- Should VSC only reference that artifact, or should another verifier validate it?
- What identifier should VSC record?
- Should a hash or URI be included?
- Which relation type best describes the reference?
- How should the reference remain clearly outside the VSC proof boundary?
- What wording would avoid overclaiming?

## Non-claims

This brief does not claim:

- completed TBN / VSC / CLARIXO integration
- external reference validation implementation
- external artifact validation by VSC
- legal responsibility proof
- identity proof
- attribution proof
- compliance proof
- fairness proof
- truth proof
- v3.0 start

## Deeper documents

For full details, see:

```text
docs/interop/INTEROP_CONSOLIDATION_SUMMARY.md
docs/interop/TBN_VSC_CLARIXO_BOUNDARIES.md
docs/interop/EXTERNAL_REFERENCE_PROFILE_DRAFT.md
schemas/external-reference-profile-v2.18-draft.schema.json
examples/external-references/
docs/interop/EXTERNAL_REFERENCE_VALIDATION_NOTES.md
docs/interop/INTEROP_ROADMAP_PRE_V3.md
docs/interop/EXTERNAL_REFERENCE_SHAPE_VALIDATION_PLAN.md
docs/interop/EXTERNAL_REFERENCE_FIXTURE_PLAN.md
```

## Suggested partner wording

Safe partner wording:

```text
VSC provides a verifiable state-evidence layer that can reference external trust, attribution, audit, or partner evidence artifacts without importing their proof claims.
```

Short version:

```text
VSC verifies its own state evidence and references external context without taking over external proof domains.
```

## Summary

VSC interoperability should remain explicit, narrow, and boundary-safe.

The central rule is:

```text
VSC can point outward without taking over external proof domains.
```
