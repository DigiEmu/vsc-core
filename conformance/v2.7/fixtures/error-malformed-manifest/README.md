# Fixture: error-malformed-manifest

**Expected result:** ERROR  
**Exit code:** 2

## Purpose

A bundle where `manifest.json` is intentionally invalid JSON (truncated string literal). The checksums.sha256 records the correct hash of the malformed file, so the checksum check passes. The parser error surfaces during the manifest check.

All conformant verifiers must return ERROR for this fixture.

## Injected fault

`manifest.json` content: `{ "fixture_id": "error-malformed-manifest", "status": "intentionally truncated`  
This is invalid JSON — the string value is not closed and the object is not closed.

## Files

| File | Role |
|------|------|
| `bundle/manifest.json` | **Intentionally malformed JSON** (truncated — do not fix) |
| `bundle/chain-token.json` | Valid chain token |
| `bundle/base-token.json` | Valid base token |
| `bundle/delta-tokens/delta-001.json` | Valid delta token |
| `bundle/verification-summary.json` | Required file (minimal fixture content) |
| `bundle/event-summary.json` | Required file (minimal fixture content) |
| `bundle/event-schema.json` | Required file (minimal fixture content) |
| `bundle/checksums.sha256` | Correct SHA-256 for all files including the malformed manifest |

## Run with Go verifier

```
go run ./cmd/vsc-go verify-bundle conformance/v2.7/fixtures/error-malformed-manifest/bundle
go run ./cmd/vsc-go verify-bundle --json conformance/v2.7/fixtures/error-malformed-manifest/bundle
```

Exit code 2 is expected.
