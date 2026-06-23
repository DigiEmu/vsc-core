# VSC Verify Flow

Status: review-ready documentation note  
Scope: VSC evidence bundle verification  
Boundary: `VSC verifies state integrity, not real-world truth.`

## Purpose

VSC checks whether an evidence bundle can be independently reconstructed and compared against declared rules.

It does not make claims about events, decisions, identities, or facts outside the bundle itself.

## Verify flow

1. Load evidence bundle
2. Read manifest
3. Check required files
4. Read declared checksums
5. Recalculate SHA-256 hashes
6. Compare expected vs actual checksums
7. Validate chain / base / delta / metadata references
8. Classify as PASS / FAIL / ERROR
9. Emit human-readable and/or machine-readable result

## Result classes

| Result | Meaning |
|--------|---------|
| PASS   | Structurally valid and deterministic comparison succeeded |
| FAIL   | Valid enough to compare, but integrity / checksum / comparison failed |
| ERROR  | Verification could not be completed due to malformed, missing, unsupported, or unreadable input |

## What PASS does not mean

PASS does not prove:

- real-world truth
- legal compliance
- AI safety
- human identity
- intent
- external trust status

## Review boundary

```text
VSC proves state integrity within a declared evidence bundle.
It does not prove truth, identity, intent, model safety, policy compliance, or regulatory certification.
```
