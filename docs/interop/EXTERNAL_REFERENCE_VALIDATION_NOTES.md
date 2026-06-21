# External Reference Validation Notes

Project: DigiEmu VSC / VSC Core  
Release context: v2.20  
Status: documentation only

## Purpose

This document clarifies what VSC may safely validate in external reference structures and what must remain outside VSC.

It does not implement verifier behavior.

It does not change the v2.18 external reference schema.

It does not change PASS / FAIL / ERROR semantics.

## Core boundary

```text
External references are pointers, not proof imports.
```

A VSC external reference can point to an external artifact.

That does not mean VSC has verified the external artifact.

That does not mean VSC has imported or endorsed the external artifact's proof claims.

## Validation boundary

```text
Reference validation is not artifact validation.
```

VSC may validate the shape of an external reference.

That is different from validating the external artifact itself.

For example, VSC may later check that a reference has the required fields and uses allowed enum values.

But that would not mean VSC has verified a TBN receipt, CLARIXO record, audit note, or partner evidence record.

## Current draft status

The current external reference profile is:

```text
vsc-external-reference-v2.18-draft
```

The current schema is:

```text
schemas/external-reference-profile-v2.18-draft.schema.json
```

In this draft profile:

```json
{
  "proof_boundary": "external_reference_only",
  "verified_by_vsc": false
}
```

These fields are intentional.

They protect the VSC proof boundary.

## What future reference validation could safely check

A future VSC validation step could safely check the structure of an external reference.

For example, it could check:

- `profile` exists and matches the expected draft profile
- `reference_id` exists
- `reference_type` is an allowed enum value
- `target_system` exists
- `target_artifact_id` exists
- `relation` is an allowed enum value
- `proof_boundary` is `external_reference_only`
- `verified_by_vsc` is `false`
- optional fields have expected JSON shapes
- the reference object matches the JSON Schema draft

These are shape and boundary checks.

They do not validate the external artifact.

## What must remain out of scope

VSC should not claim to validate:

- whether a TBN receipt is true or valid
- whether a CLARIXO record is true or valid
- whether an external audit note is correct
- whether a partner evidence record is trustworthy
- whether an external issuer is authoritative
- whether an external timestamp is authoritative
- whether an external artifact proves identity
- whether an external artifact proves attribution
- whether an external artifact proves compliance
- whether an external artifact proves legal responsibility
- whether an external artifact proves fairness
- whether an external artifact proves truth

These questions belong outside VSC's proof boundary unless a separate external verifier and profile explicitly define them.

## Safe wording

Safe:

```text
VSC can validate the structure of an external reference.
```

Safe:

```text
The referenced artifact remains outside the VSC proof boundary.
```

Safe:

```text
A valid external reference does not mean the external artifact is valid.
```

Unsafe:

```text
VSC verified the TBN receipt.
```

Unsafe:

```text
VSC proved the CLARIXO attribution record.
```

Unsafe:

```text
VSC confirmed the external audit conclusion.
```

## Pointer validation vs proof validation

Pointer validation asks:

```text
Is this reference object well-shaped and boundary-safe?
```

Proof validation asks:

```text
Is the external artifact's claim true, trusted, valid, or authoritative?
```

VSC can safely approach the first question.

VSC should not claim the second question unless a future external verification system is explicitly defined.

## Future phase language

Future work may define:

- schema validation for external references
- example conformance fixtures for reference objects
- warning-level validation for malformed reference objects
- explicit non-import behavior in verification reports
- external verifier handoff profiles

Future work should not silently expand VSC's proof boundary.

Any future validation must preserve the distinction:

```text
Reference validation is not artifact validation.
```

## Summary

External references help VSC connect to broader trust ecosystems.

But VSC must remain clear about what it verifies.

```text
External references are pointers, not proof imports.
Reference validation is not artifact validation.
VSC proves state integrity, not truth.
```
