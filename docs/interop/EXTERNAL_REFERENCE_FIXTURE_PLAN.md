# External Reference Fixture Plan

Project: DigiEmu VSC / VSC Core  
Release context: v2.23  
Status: planning only

## Purpose

This document plans possible future fixture classes for external reference shape validation.

It does not create fixture files.

It does not implement fixture validation.

It does not change verifier behavior.

It does not change schema semantics.

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

```text
Fixture planning does not implement fixture validation.
```

```text
A fixture result class describes reference-object shape only, not external artifact truth.
```

## Current reference basis

Current draft profile:

```text
vsc-external-reference-v2.18-draft
```

Current schema:

```text
schemas/external-reference-profile-v2.18-draft.schema.json
```

Current examples:

```text
examples/external-references/
```

Current shape validation plan:

```text
docs/interop/EXTERNAL_REFERENCE_SHAPE_VALIDATION_PLAN.md
```

## Candidate fixture result classes

Future fixture result classes may use careful names such as:

```text
REFERENCE_SHAPE_PASS
REFERENCE_SHAPE_FAIL
REFERENCE_SHAPE_WARNING
```

These names are planning labels only.

They are not implemented in this release.

They should not be interpreted as external artifact validation.

## Candidate valid fixtures

Future valid fixtures may include:

```text
valid-tbn-reference
valid-clarixo-reference
valid-external-audit-note-reference
valid-partner-evidence-reference
valid-other-reference
```

Expected future class:

```text
REFERENCE_SHAPE_PASS
```

Meaning:

```text
The reference object is structurally valid and boundary-safe.
```

Non-meaning:

```text
The referenced external artifact is valid, true, trusted, authoritative, or legally meaningful.
```

## Candidate invalid shape fixtures

Future invalid shape fixtures may include:

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

Expected future class:

```text
REFERENCE_SHAPE_FAIL
```

Meaning:

```text
The reference object violates the draft shape or boundary constraints.
```

Non-meaning:

```text
The external artifact itself has been evaluated.
```

## Candidate warning fixtures

Future warning fixtures may include:

```text
missing-optional-hash
missing-optional-uri
missing-issuer
missing-notes
placeholder-hash-used
```

Expected future class:

```text
REFERENCE_SHAPE_WARNING
```

Meaning:

```text
The reference object may be structurally acceptable but less useful for review, traceability, or handoff.
```

Non-meaning:

```text
The external artifact is invalid.
```

## Possible future fixture index shape

A future fixture index could use a shape similar to:

```json
{
  "profile": "vsc-external-reference-fixture-index-v2.x-draft",
  "fixtures": [
    {
      "fixture_id": "valid-tbn-reference",
      "path": "fixtures/external-references/valid-tbn-reference.json",
      "expected_reference_shape_result": "REFERENCE_SHAPE_PASS",
      "external_artifact_validation": "out_of_scope"
    }
  ]
}
```

This is a planning example only.

It is not created in this release.

## Required fixture metadata principles

Future fixture metadata should make these boundaries explicit:

- fixture result class concerns the reference object only
- external artifact validation remains out of scope
- `verified_by_vsc` must not be set to `true`
- `proof_boundary` must remain `external_reference_only`
- result labels must not imply identity, attribution, compliance, fairness, truth, or legal responsibility

## Out-of-scope proof cases

Future fixtures should not attempt to test:

- whether a TBN receipt is true or valid
- whether a CLARIXO record is true or valid
- whether an external audit conclusion is correct
- whether a partner evidence record is trustworthy
- whether an issuer is authoritative
- whether an external timestamp is authoritative
- whether identity is proven
- whether attribution is proven
- whether compliance is proven
- whether fairness is proven
- whether legal responsibility is proven
- whether truth is proven

These remain outside VSC unless a separate external verifier and profile are explicitly defined.

## Future implementation guardrails

If fixtures are created in a future release, they should:

- live outside generated output folders
- not alter existing conformance fixture semantics
- not change current PASS / FAIL / ERROR semantics
- use explicit reference-shape result classes
- clearly distinguish shape validation from artifact validation
- preserve the VSC proof boundary

## Not part of this release

v2.23 does not add:

- fixture files
- fixture index files
- verifier logic
- CLI commands
- CI workflow changes
- schema changes
- external artifact validation
- integration-complete claims

## Summary

v2.23 plans future external reference fixtures without creating them.

The safe rule remains:

```text
A fixture result class describes reference-object shape only, not external artifact truth.
```
