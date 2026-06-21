# Fixture: pass-basic

**Expected result:** PASS  
**Exit code:** 0

## Purpose

A minimal, deterministic VSC Evidence Bundle that all conformant verifiers must accept as PASS.

All required files are present. All checksums in `checksums.sha256` match the actual file contents. The chain token carries valid `baseTokenId` and `latestTokenId`. One delta token file exists matching the `steps` count. The manifest is valid JSON.

## Files

| File | Role |
|------|------|
| `bundle/manifest.json` | Bundle manifest (valid JSON) |
| `bundle/chain-token.json` | Chain token with 1 step |
| `bundle/base-token.json` | Base token |
| `bundle/delta-tokens/delta-001.json` | Single delta token |
| `bundle/verification-summary.json` | Required file (minimal fixture content) |
| `bundle/event-summary.json` | Required file (minimal fixture content) |
| `bundle/event-schema.json` | Required file (minimal fixture content) |
| `bundle/checksums.sha256` | SHA-256 digests for all 7 files |

## Run with Go verifier

```
go run ./cmd/vsc-go verify-bundle conformance/v2.7/fixtures/pass-basic/bundle
go run ./cmd/vsc-go verify-bundle --json conformance/v2.7/fixtures/pass-basic/bundle
```
