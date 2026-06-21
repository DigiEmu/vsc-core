# Interop Roadmap / Pre-v3 Planning

Project: DigiEmu VSC / VSC Core  
Release context: v2.21  
Status: roadmap / planning only

## Purpose

This document consolidates the interoperability work completed in v2.17 through v2.20 and defines a safe roadmap before any possible v3.0 transition.

It is a planning document.

It does not implement verifier behavior.

It does not start v3.0.

It does not change the VSC proof boundary.

## Core boundaries

```text
VSC proves state integrity, not truth.
```

```text
External references are pointers, not proof imports.
```

```text
Reference validation is not artifact validation.
```

These boundaries must remain stable unless a future release explicitly defines a new profile and a new verifier responsibility.

## Completed interop arc

The current interop foundation consists of:

```text
v2.17 — TBN / VSC / CLARIXO boundary notes
v2.18 — External Reference Profile Draft + JSON Schema
v2.19 — External Reference Examples
v2.20 — External Reference Validation Notes
```

## What is already available

### Boundary notes

```text
docs/interop/TBN_VSC_CLARIXO_BOUNDARIES.md
```

Defines how TBN, VSC, and CLARIXO can be discussed without confusing proof boundaries.

### External reference profile draft

```text
docs/interop/EXTERNAL_REFERENCE_PROFILE_DRAFT.md
schemas/external-reference-profile-v2.18-draft.schema.json
```

Defines a draft machine-readable structure for references to external artifacts.

### External reference examples

```text
examples/external-references/
```

Provides example references for:

- TBN receipts
- CLARIXO records
- external audit notes
- partner evidence records
- other external context artifacts

### External reference validation notes

```text
docs/interop/EXTERNAL_REFERENCE_VALIDATION_NOTES.md
```

Explains what future reference-shape validation could check and what remains outside VSC.

## Phase 0 — Completed boundary foundation

Status: completed in v2.17 to v2.20.

This phase established:

- layer separation
- external reference draft profile
- JSON Schema draft
- safe examples
- validation boundary notes

No external artifact validation is implemented.

No completed TBN / VSC / CLARIXO integration is claimed.

## Phase 1 — Optional reference-shape validation

Status: possible future work.

A future release may validate the shape of external reference objects.

Safe checks could include:

- required fields are present
- enum values are allowed
- `proof_boundary` is `external_reference_only`
- `verified_by_vsc` is `false`
- the reference object matches the JSON Schema draft

This phase must preserve the rule:

```text
Reference validation is not artifact validation.
```

A valid reference object would not mean the referenced artifact is valid, true, trusted, authoritative, or legally meaningful.

## Phase 2 — Optional external reference conformance examples

Status: possible future work.

Future releases may add conformance-style examples for external reference objects.

Example classes could include:

- valid external reference object
- invalid reference type
- invalid relation
- invalid proof boundary
- invalid `verified_by_vsc`
- malformed reference JSON

These examples would test reference-object shape, not external artifact truth.

## Phase 3 — Optional reporting integration

Status: possible future work.

A future verification report may include external reference sections.

Such sections should clearly mark referenced artifacts as:

```text
external_reference_only
```

The report should not imply that external artifacts were verified by VSC.

Safe reporting language:

```text
External reference recorded.
External artifact remains outside VSC proof boundary.
```

Unsafe reporting language:

```text
External artifact verified by VSC.
```

## Phase 4 — Optional partner handoff profiles

Status: possible future work.

Future partner workflows may define handoff profiles where:

- TBN references VSC evidence bundle IDs
- VSC metadata references TBN receipts
- CLARIXO references VSC verification results
- partner systems reference VSC evidence artifacts

These handoffs should remain explicit reference patterns, not automatic proof imports.

## Phase 5 — Optional external verifier handoff

Status: possible future work.

If external artifact verification becomes necessary, it should be handled by a separate verifier or external profile.

Example:

```text
TBN verifies TBN receipts.
VSC verifies VSC state evidence.
CLARIXO provides responsibility / attribution context.
```

VSC should not silently take responsibility for external proof domains.

## v3.0 gate

A move toward v3.0 should only be considered if the following are stable:

- VSC v2 proof boundary remains clear
- external reference schema draft is stable
- examples are stable
- validation notes are stable
- reporting language is safe
- no external proof claims are imported into VSC
- partner handoff patterns are documented
- the project has a clear reason to introduce new verifier responsibilities

v3.0 should not begin merely because external references exist.

v3.0 would require a clear decision about whether any new verifier behavior is introduced.

## What must remain permanently clear

VSC does not prove:

- truth
- identity
- legal guilt
- responsibility attribution
- fairness
- full compliance
- external artifact validity
- issuer authority

Unless a separate external verifier is explicitly defined, these remain outside VSC.

## Recommended next step after v2.21

Possible next release:

```text
v2.22 — External Reference Shape Validation Plan
```

This would still be a plan, not implementation.

It would define candidate validation cases before any verifier changes are made.

## Summary

The interop path should remain careful and staged.

VSC can become more interoperable without expanding its proof claims.

The safe rule is:

```text
VSC should evolve from reference documentation to reference validation only when the proof boundary remains unchanged.
```
