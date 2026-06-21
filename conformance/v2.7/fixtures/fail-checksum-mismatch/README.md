# Fixture: fail-checksum-mismatch

**Expected result:** FAIL  
**Exit code:** 1

## Purpose

A structurally complete but integrity-failed VSC Evidence Bundle. `manifest.json` is present and valid JSON, but its entry in `checksums.sha256` records an all-zero hash (`0000...0000`) that does not match the actual file content.

All conformant verifiers must return FAIL (not PASS, not ERROR) for this fixture.

## Injected fault

| File | Entry in checksums.sha256 | Actual hash |
|------|--------------------------|-------------|
| `manifest.json` | `0000000000000000000000000000000000000000000000000000000000000000` | real SHA-256 |

## Files

| File | Role |
|------|------|
| `bundle/manifest.json` | Valid JSON — checksum intentionally wrong in checksums.sha256 |
| `bundle/chain-token.json` | Valid chain token |
| `bundle/base-token.json` | Valid base token |
| `bundle/delta-tokens/delta-001.json` | Valid delta token |
| `bundle/verification-summary.json` | Required file (minimal fixture content) |
| `bundle/event-summary.json` | Required file (minimal fixture content) |
| `bundle/event-schema.json` | Required file (minimal fixture content) |
| `bundle/checksums.sha256` | Contains one intentionally wrong hash for manifest.json |

## Run with Go verifier

```
go run ./cmd/vsc-go verify-bundle conformance/v2.7/fixtures/fail-checksum-mismatch/bundle
go run ./cmd/vsc-go verify-bundle --json conformance/v2.7/fixtures/fail-checksum-mismatch/bundle
```

Exit code 1 is expected.
