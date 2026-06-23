# TBN / VSC Interop Example Bundle 001

Status: reference example  
Scope: interop demonstration  
Boundary: not a formal TBN integration

## Purpose

This bundle demonstrates how an external trust or identity system can reference a VSC evidence bundle without redefining VSC's proof claims.

It shows that an external system may point to VSC artifacts as context without importing or absorbing the VSC proof boundary.

## What this example shows

- bundle structure
- manifest references
- checksum verification
- external-reference boundary
- deterministic state comparison

## What this example does not prove

- human identity
- real-world intent
- legal validity
- AI safety
- factual truth
- TBN trust status
- production integration between TBN and VSC

## Expected files

| File | Role |
|------|------|
| `manifest.json` | Bundle manifest declaring structure and references |
| `checksums.json` | Declared SHA-256 checksums for bundle files |
| `base_token.json` | Base state token |
| `chain_token.json` | Chain token linking base and delta states |
| `delta_tokens.json` | Delta state tokens |
| `event_metadata.json` | Event metadata associated with the state chain |

## Usage

Use this bundle to test deterministic verification, checksum comparison, manifest consistency, PASS / FAIL / ERROR behavior, and external-reference boundaries.

Do not use it as a claim of production readiness, certification, or identity proof.
