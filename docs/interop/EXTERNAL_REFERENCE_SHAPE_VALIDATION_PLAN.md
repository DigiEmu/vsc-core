# External Reference Shape Validation Plan

Project: DigiEmu VSC / VSC Core  
Release context: v2.22  
Status: planning only

## Purpose

This document defines candidate shape-validation cases for the VSC external reference profile.

It does not implement verifier behavior.

It does not create conformance fixtures.

It does not change the external reference schema.

It does not change PASS / FAIL / ERROR semantics.

## Core boundaries

```text
External references are pointers, not proof imports.
```

```text
Reference validation is not artifact validation.
```

```text
Shape validation checks the reference object, not the external artifact.
```

These boundaries must remain stable in any future validation work.

## Current profile

Current draft profile:

```text
vsc-external-reference-v2.18-draft
```

Current schema:

```text
schemas/external-reference-profile-v2.18-draft.schema.json
```

Required boundary fields:

```json
{
  "proof_boundary": "external_reference_only",
  "verified_by_vsc": false
}
```

## What shape validation may mean

Shape validation may check whether an external reference object is structurally valid.

For example:

- required fields are present
- values match allowed enums
- boundary fields are not weakened
- JSON is parseable
- the object matches the draft schema

Shape validation does not check whether the referenced external artifact is true, valid, trusted, authoritative, or legally meaningful.

## Candidate valid cases

Future fixtures or tests may include valid reference objects such as:

```text
valid-tbn-reference
valid-clarixo-reference
valid-external-audit-note-reference
valid-partner-evidence-reference
valid-other-reference
```

These cases would show that reference objects match the draft schema and preserve the proof boundary.

A valid reference object would still mean only:

```text
The reference shape is valid.
```

It would not mean:

```text
The external artifact is valid.
```

## Candidate invalid shape cases

Future fixtures or tests may include invalid reference objects such as:

```text
missing-profile
invalid-profile
missing-reference-id
invalid-reference-type
missing-target-system
missing-target-artifact-id
invalid-relation
missing-proof-boundary
invalid-proof-boundary
missing-verified-by-vsc
verified-by-vsc-true
malformed-json
additional-property-present
invalid-issued-at-format
```

These cases would test the shape and boundary constraints of the reference object.

## Candidate warning cases

Some future validation cases may be warnings rather than failures.

Possible warning-level cases could include:

```text
missing-optional-hash
missing-optional-uri
missing-issuer
missing-notes
placeholder-hash-used
```

Warning cases should not weaken the VSC proof boundary.

## Possible future result classes

If shape validation is implemented later, result language should remain careful.

Possible future wording:

```text
REFERENCE_SHAPE_PASS
REFERENCE_SHAPE_FAIL
REFERENCE_SHAPE_WARNING
```

These names are planning examples only.

They are not implemented in this release.

They should not be confused with external artifact validation.

## Out-of-scope proof cases

Future validation should not attempt to prove:

- TBN receipt truth or validity
- CLARIXO record truth or validity
- audit conclusion correctness
- partner evidence trustworthiness
- issuer authority
- identity
- responsibility attribution
- legal responsibility
- compliance
- fairness
- truth

These remain outside VSC unless a separate external verifier and profile are explicitly defined.

## Future implementation guardrails

Any future implementation should preserve these guardrails:

- `verified_by_vsc` must not silently become `true`
- `proof_boundary` must not silently change from `external_reference_only`
- valid reference shape must not imply valid external artifact
- reports must clearly mark external references as outside the VSC proof boundary
- external artifact validation must require a separate explicit verifier or profile

## Not part of this release

v2.22 does not add:

- verifier logic
- CLI commands
- CI workflow changes
- conformance fixtures
- schema changes
- external artifact validation
- integration-complete claims

## Summary

This plan prepares future validation work without expanding VSC's proof boundary.

The safe rule remains:

```text
Shape validation checks the reference object, not the external artifact.
```
