# External Reference Examples

Release context: v2.19  
Profile: `vsc-external-reference-v2.18-draft`

## Purpose

This directory contains example JSON files using the VSC v2.18 external reference profile draft.

These examples show how a VSC bundle, report, or related metadata structure may point to external artifacts without absorbing their proof claims.

## Core boundary

```text
External references are pointers, not proof imports.
```

In these examples:

```json
{
  "proof_boundary": "external_reference_only",
  "verified_by_vsc": false
}
```

This means the referenced external artifact remains outside the VSC proof boundary.

## Example files

```text
tbn-receipt-reference.json
clarixo-record-reference.json
external-audit-note-reference.json
partner-evidence-record-reference.json
other-reference.json
```

## What these examples are

These examples are:

- draft reference examples
- schema-shaped JSON examples
- safe interoperability illustrations
- pointers to external context artifacts

## What these examples are not

These examples are not:

- production integrations
- proof that external artifacts are valid
- proof that TBN, VSC, and CLARIXO are fully integrated
- proof of identity
- proof of attribution
- proof of legal responsibility
- proof of compliance
- proof of truth

## Validation notes

These examples demonstrate schema-shaped external reference pointers.

A well-shaped external reference does not mean the referenced external artifact is valid.

For the distinction between reference-shape validation and external artifact validation, see:

[`docs/interop/EXTERNAL_REFERENCE_VALIDATION_NOTES.md`](../../docs/interop/EXTERNAL_REFERENCE_VALIDATION_NOTES.md)

## Summary

The examples demonstrate how VSC can reference external context while keeping the VSC proof boundary intact.
