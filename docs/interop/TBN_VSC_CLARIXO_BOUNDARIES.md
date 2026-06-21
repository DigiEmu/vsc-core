# TBN / VSC / CLARIXO Integration Boundary Notes

Project: DigiEmu VSC / VSC Core  
Release context: v2.17

## Status of this document

This document describes interoperability boundaries.

It is not an integration-complete claim.

It does not state that TBN, VSC, and CLARIXO are fully integrated in production.

It defines how the layers can be discussed safely without confusing their proof boundaries.

## Core principle

```text
Each layer may reference the others,
but no layer should redefine the proof boundary of another layer.
```

## Three-layer model

```text
TBN     = identity / trust verification
VSC     = decision-state verification
CLARIXO = responsibility / attribution context
```

In simple terms:

```text
TBN verifies identity / trust status.
VSC verifies decision-state evidence integrity.
CLARIXO provides responsibility / attribution context.
```

## VSC boundary

VSC verifies the integrity of decision-state evidence.

VSC can help check:

- required evidence files
- checksums
- token chains
- delta presence
- manifest readability
- reproducible verification result classes

VSC does not prove:

- truth
- identity
- legal guilt
- responsibility attribution
- fairness
- moral correctness
- full compliance by itself

Short boundary:

```text
VSC proves state integrity, not truth.
```

## TBN boundary

TBN belongs to the identity / trust verification layer.

A TBN-style receipt may help answer questions such as:

- which agent, system, or actor was associated with a trust state
- whether a trust or identity status was valid according to TBN's own rules
- whether a trust receipt can be referenced by another layer

TBN does not, by itself, prove VSC decision-state integrity.

If a TBN receipt references a VSC bundle, the VSC bundle still needs to be verified by VSC rules.

## CLARIXO boundary

CLARIXO belongs to the responsibility / attribution context layer.

A CLARIXO-style record may help organize context around:

- responsibility records
- attribution context
- upstream evidence references
- continuity of responsibility-related metadata

CLARIXO does not change the result of a VSC verification.

If CLARIXO references a VSC evidence bundle or verification result, the VSC result remains defined by VSC.

## Safe reference patterns

The following reference patterns are safe to describe at the boundary level.

### TBN may reference VSC

A TBN trust receipt may reference a VSC evidence bundle ID or verification result ID.

This does not mean TBN has verified the VSC state.

It means TBN can point to VSC evidence as an external artifact.

### VSC may include TBN metadata

A VSC evidence bundle may include external metadata pointing to a TBN receipt.

This does not mean VSC proves identity.

It means the VSC evidence can carry or reference external identity / trust metadata.

### CLARIXO may reference both

A CLARIXO responsibility record may reference:

- a TBN trust receipt
- a VSC evidence bundle
- a VSC verification result

This does not mean CLARIXO changes the TBN or VSC result.

It means CLARIXO can use those artifacts as upstream context.

## Unsafe claims to avoid

Avoid saying:

- TBN proves VSC state integrity.
- VSC proves TBN identity.
- VSC proves legal responsibility.
- CLARIXO changes VSC verification results.
- A three-layer reference proves truth.
- A VSC PASS proves the AI decision was correct.
- A VSC FAIL proves wrongdoing.
- This boundary note means production integration is complete.

## Example boundary sentence

A safe way to describe the relationship is:

```text
TBN can provide identity / trust context, VSC can provide decision-state evidence verification,
and CLARIXO can provide responsibility / attribution context. These layers may reference each
other, but each keeps its own proof boundary.
```

## Integration maturity language

Use cautious maturity language:

```text
boundary model
interoperability note
reference pattern
possible handoff
external artifact reference
candidate integration path
```

Avoid finality language unless a concrete implementation exists:

```text
fully integrated
production verified
legally complete
end-to-end responsibility proof
complete governance stack
```

## External reference profile

For a draft machine-readable structure for external artifact references, see:

[`docs/interop/EXTERNAL_REFERENCE_PROFILE_DRAFT.md`](EXTERNAL_REFERENCE_PROFILE_DRAFT.md)  
[`schemas/external-reference-profile-v2.18-draft.schema.json`](../../schemas/external-reference-profile-v2.18-draft.schema.json)

This profile defines external references as pointers, not proof imports.

## Summary

TBN, VSC, and CLARIXO can be complementary layers.

But they should remain clearly separated:

```text
TBN checks identity / trust.
VSC checks state evidence.
CLARIXO organizes responsibility / attribution context.
```

VSC remains focused on its own role:

```text
VSC proves state integrity, not truth.
```
