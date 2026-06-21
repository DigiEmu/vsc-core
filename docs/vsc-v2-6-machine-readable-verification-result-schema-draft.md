# VSC v2.6 — Machine-readable Verification Result Schema Draft

**Status:** DRAFT  
**Version:** v2.6-draft  
**Date:** 2026-06-21

---

## 1. Purpose

This document defines a stable, implementation-neutral JSON schema for VSC verification results.

The schema specifies the structure of machine-readable output produced by VSC-conformant verifiers — including the Node.js reference implementation, the Go verifier prototype, future API endpoints, and conformance test harnesses. It does not change VSC verification semantics. A verifier that produces this JSON output and a verifier that does not are evaluated identically against the evidence; the schema governs how results are reported, not how they are computed.

**Why structured output is needed:**

- **Go verifier comparison** — Node.js and Go verifiers must produce comparable result artifacts so that disagreements between implementations surface as explicit structural mismatches, not as text diff noise.
- **Conformance test harnesses** — conformance fixtures (v2.2) require a stable expected result format against which actual verifier output can be asserted.
- **External interop receipts** — systems operating under the v2.3 Interop Receipt Profile may reference a VSC verification result by its result class and profile; a stable schema makes those references precise.
- **Future APIs** — an HTTP verification service (v3.0 scope) must emit a well-defined response body. Defining the schema now prevents divergence between CLI and API outputs.

**What this schema does not do:**

- It does not redefine PASS / FAIL / ERROR / PROOF-ONLY.
- It does not add new evidence checks.
- It does not change how checksums are computed or compared.
- It does not alter CLI human-readable output format.
- It does not grant legal, identity, or attribution meaning to a PASS result.

---

## 2. Relationship to v2.0–v2.5

| Release | Contribution |
|---------|-------------|
| **v2.0** | Formal evidence model: token roles, bundle structure, verifier behavior, validation semantics |
| **v2.1** | Canonical Event Model: smallest verifiable event unit for structured event logs |
| **v2.2** | Conformance Test Vectors: compatibility test surface, expected-result fixtures |
| **v2.3** | Interop Receipt Profile: boundary rules for TBN, CLARIXO, and external system references |
| **v2.4** | Go Core Prototype Preparation: scope, conformance requirements, migration path |
| **v2.5** | Minimal Go Verifier Prototype: `cmd/vsc-go verify-bundle`, read-only, 6 checks |
| **v2.6** | **This document.** Machine-readable result schema: common JSON surface for all verifiers |

v2.6 completes the foundational specification layer. v2.7 and beyond begin implementation-level alignment work.

---

## 3. Design Principles

**Human-readable CLI output may vary. Machine-readable result classes must not.**

1. **Result class stability** — the `result` field must be one of the four defined classes: `PASS`, `FAIL`, `ERROR`, `PROOF-ONLY`. No implementation may introduce additional top-level result classes without a schema version bump.
2. **Determinism** — the same evidence input, verified by a conformant verifier, must produce the same `result` class. Diagnostics (timings, byte counts) may differ between runs.
3. **Additive extension** — implementations may add fields to the `checks`, `diagnostics`, or `metadata` objects without breaking compatibility. Required fields must not be removed or renamed without a profile version change.
4. **Semantic preservation** — no field in the result object may contradict the result class. A result with `"result": "PASS"` must not contain a failing check with status `FAIL` unless the failing check is annotated `NOT_IMPLEMENTED` or `SKIPPED` and that annotation is semantically justified.
5. **Read-only report** — the result JSON is a report about an evidence bundle. Its production must not modify the source bundle in any way.

---

## 4. Top-level JSON Structure

```json
{
  "profile":         "<string>",
  "schema_version":  "<string>",
  "verifier":        { ... },
  "input":           { ... },
  "bundle":          { ... },
  "result":          "<PASS | FAIL | ERROR | PROOF-ONLY>",
  "checks":          { ... },
  "diagnostics":     { ... },
  "timestamps":      { ... },
  "warnings":        [ ... ],
  "errors":          [ ... ],
  "metadata":        { ... }
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `profile` | Yes | string | Schema profile identifier. Must be `"vsc-verification-result-v2.6-draft"` for v2.6 results. |
| `schema_version` | Yes | string | Schema version string. Must be `"2.6-draft"` for this release. |
| `verifier` | Yes | object | Identity of the verifier that produced this result. See §7. |
| `input` | Yes | object | Description of the input artifact being verified. See §8. |
| `bundle` | No | object | Metadata extracted from the bundle during verification. See §9. May be `null` if bundle could not be opened. |
| `result` | Yes | string | Final result class. See §5. |
| `checks` | Yes | object | Per-check outcomes. See §10. |
| `diagnostics` | No | object | Numeric metadata about the verification run. See §12. |
| `timestamps` | No | object | Timing metadata. Keys: `started_at`, `completed_at` (ISO 8601). |
| `warnings` | No | array | Non-fatal diagnostic messages. See §13. |
| `errors` | No | array | Error records for unreadable or malformed inputs. See §13. |
| `metadata` | No | object | Free-form implementation-specific metadata. Must not override any required field. |

---

## 5. Result Classes

The four result classes are defined in v2.0 §12 and preserved here without change.

### PASS
All implemented required checks passed. The bundle is complete, internally consistent, and every file matched its checksum binding at verification time.

**PASS does not mean:**
- The recorded state reflects real-world truth
- The decisions encoded in the state were correct or appropriate
- The bundle is legally certified
- The verifier confirms actor identity

**PASS means:** the evidence is structurally sound and has not been modified since it was sealed.

### FAIL
The evidence structure is readable but one or more required integrity checks did not pass. The bundle may be incomplete, internally inconsistent, or contain checksum mismatches.

### ERROR
The input could not be read, parsed, or processed. At least one required file is missing, malformed, or inaccessible. Verification could not be completed.

### PROOF-ONLY
A recognized VSC proof artifact is present but is not sufficient for a full PASS. Typical cases: a chain token without a base token, or a delta set without a base snapshot. The artifact is not rejected — it is classified as partial evidence.

**PROOF-ONLY must not be counted as PASS** in any conformance comparison, interop receipt, or downstream governance assertion.

---

## 6. Exit Code Mapping

Conformant CLI implementations should use the following process exit codes:

| Result class | Exit code |
|-------------|-----------|
| `PASS` | `0` |
| `FAIL` | `1` |
| `ERROR` | `2` |
| `PROOF-ONLY` | `3` |

Exit codes are a projection of the result class onto the process interface. They do not add information beyond the result class. Callers should not infer result class from exit code alone when the JSON result is available — prefer reading `result` from the JSON output.

---

## 7. Verifier Object

```json
"verifier": {
  "name":           "<string>",
  "version":        "<string>",
  "implementation": "<string>",
  "language":       "<string>",
  "commit":         "<string | null>",
  "profile":        "<string>"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Short name of the verifier. Examples: `"vsc-node"`, `"vsc-go"`. |
| `version` | Yes | Verifier version string. Example: `"v1.16"`, `"v2.5-prototype"`. |
| `implementation` | No | Human-readable implementation label. Example: `"minimal-go-verifier"`. |
| `language` | No | Implementation language. Examples: `"nodejs"`, `"go"`. |
| `commit` | No | Git commit hash of the verifier build, or `null` if unavailable. |
| `profile` | No | Schema profile this verifier claims to produce. Should match top-level `profile`. |

**Verifier identity does not affect evidence validity.** A PASS produced by the Node.js reference verifier and a PASS produced by the Go prototype carry the same result class semantics. The verifier object is metadata for traceability, not for evidence evaluation.

---

## 8. Input Object

```json
"input": {
  "input_type":     "<string>",
  "path":           "<string>",
  "resolved_path":  "<string | null>",
  "read_only":      true,
  "transport":      "<string | null>"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `input_type` | Yes | Type of the input artifact. Defined values: `"evidence_bundle_folder"`, `"evidence_bundle_zip"`, `"api_request"`. |
| `path` | Yes | The path or identifier as supplied by the caller. |
| `resolved_path` | No | Absolute path after resolution, or `null` if not applicable. |
| `read_only` | Yes | Must be `true`. Conformant verifiers never write to the source bundle. |
| `transport` | No | How the input was delivered. Examples: `"filesystem"`, `"http"`, `"s3"`. Omit if filesystem. |

---

## 9. Bundle Object

Fields extracted from the bundle during verification. All fields may be `null` if the corresponding artifact could not be parsed.

```json
"bundle": {
  "bundle_id":       "<string | null>",
  "bundle_type":     "<string | null>",
  "base_token_id":   "<string | null>",
  "latest_token_id": "<string | null>",
  "chain_token_id":  "<string | null>",
  "session_id":      "<string | null>",
  "delta_count":     "<integer | null>",
  "checksum_count":  "<integer | null>"
}
```

| Field | Source | Description |
|-------|--------|-------------|
| `bundle_id` | Bundle folder name or manifest | Stable identifier for this bundle. |
| `bundle_type` | manifest.json or detection | `"JSON Event Evidence Bundle"` or `"Generic Evidence Bundle"`. |
| `base_token_id` | chain-token.json `baseTokenId` | ID of the base (initial state) token. |
| `latest_token_id` | chain-token.json `latestTokenId` | ID of the most recent delta token. |
| `chain_token_id` | chain-token.json `id` | ID of the chain token itself. |
| `session_id` | json-benchmark-summary.json or event-summary.json | Session ID for JSON Event bundles. |
| `delta_count` | Derived from chain-token.json `steps` length | Number of delta steps in the chain. |
| `checksum_count` | Derived from checksums.sha256 | Number of files covered by checksum binding. |

---

## 10. Checks Object

Each key in `checks` corresponds to one verification step. Step names are stable identifiers — they must not change between verifier versions without a profile version bump.

```json
"checks": {
  "required_files":      { ... },
  "checksums":           { ... },
  "chain_token":         { ... },
  "base_token":          { ... },
  "delta_tokens":        { ... },
  "manifest":            { ... },
  "json_event_metadata": { ... },
  "canonical_events":    { ... },
  "interop_receipt":     { ... }
}
```

Each check object has the following shape:

```json
{
  "status":      "<PASS | FAIL | ERROR | SKIPPED | NOT_IMPLEMENTED | WARNING>",
  "message":     "<string | null>",
  "expected":    "<any | null>",
  "actual":      "<any | null>",
  "diagnostics": { ... }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `status` | Yes | Outcome of this check. See §11. |
| `message` | No | Human-readable description of the outcome or failure reason. |
| `expected` | No | Expected value or count (for numeric comparisons). |
| `actual` | No | Actual observed value or count. |
| `diagnostics` | No | Check-specific numeric or structural metadata. |

**Ordering note:** implementations should evaluate checks in the order listed above. `checksums` must be evaluated before `chain_token` because the chain token file itself is covered by the checksum binding (v2.2 §8).

**Check definitions:**

| Check name | Description | Required for PASS |
|-----------|-------------|-------------------|
| `required_files` | All structurally required files are present. | Yes |
| `checksums` | Every file in checksums.sha256 matches its recorded digest. | Yes |
| `chain_token` | chain-token.json is present, parseable, and carries valid base/latest token IDs. | Yes |
| `base_token` | base-token.json is present and parseable. | Yes |
| `delta_tokens` | All expected delta token files are present. | Yes |
| `manifest` | manifest.json is present and parseable. | Yes |
| `json_event_metadata` | JSON event artifacts are present and parseable (JSON Event bundles only). | Conditional |
| `canonical_events` | Events conform to the v2.1 Canonical Event Model. | Not yet (v2.7+ scope) |
| `interop_receipt` | Optional receipt fields validate against v2.3 profile. | Not yet (v2.7+ scope) |

---

## 11. Check Status Values

| Status | Meaning | Counts against PASS? |
|--------|---------|----------------------|
| `PASS` | Check completed and all assertions satisfied. | No |
| `FAIL` | Check completed but one or more assertions failed. | **Yes** |
| `ERROR` | Check could not be completed (missing or malformed input). | **Yes** |
| `SKIPPED` | Check was intentionally not run (e.g. not applicable for this bundle type). | No |
| `NOT_IMPLEMENTED` | Check is defined in the schema but not yet implemented by this verifier. | No — with constraint |
| `WARNING` | Check completed but a non-fatal anomaly was observed. | No |

**`NOT_IMPLEMENTED` constraint:** a check marked `NOT_IMPLEMENTED` must not be presented as evidence that the corresponding assertion passed. If a conformance comparison requires that check, the overall comparison result must be `INCOMPLETE`, not `PASS`.

**`SKIPPED` constraint:** a check may only be `SKIPPED` if the bundle type makes it inapplicable. For example, `json_event_metadata` may be `SKIPPED` for a Generic Evidence Bundle. It must not be `SKIPPED` for a JSON Event Evidence Bundle.

---

## 12. Diagnostics Object

```json
"diagnostics": {
  "files_verified":           "<integer | null>",
  "files_expected":           "<integer | null>",
  "checksums_verified":       "<integer | null>",
  "checksums_expected":       "<integer | null>",
  "delta_tokens_found":       "<integer | null>",
  "delta_tokens_expected":    "<integer | null>",
  "bytes_read":               "<integer | null>",
  "duration_ms":              "<number | null>",
  "hash_algorithm":           "<string>",
  "canonicalization_profile": "<string | null>"
}
```

| Field | Description |
|-------|-------------|
| `files_verified` | Number of files successfully verified (required files check). |
| `files_expected` | Total number of required files for this bundle type. |
| `checksums_verified` | Number of files with matching SHA-256 digest. |
| `checksums_expected` | Total number of entries in checksums.sha256. |
| `delta_tokens_found` | Number of expected delta token files actually present. |
| `delta_tokens_expected` | Expected count from chain-token.json `steps` length. |
| `bytes_read` | Total bytes read from the bundle during verification, if tracked. |
| `duration_ms` | Wall-clock duration of the verification run in milliseconds. |
| `hash_algorithm` | Hash algorithm used for checksum verification. Must be `"sha256"` for v2.6. |
| `canonicalization_profile` | Canonicalization profile if canonical event checks were run. `null` otherwise. |

Diagnostics fields are optional and may be `null` if not computed. Partial diagnostics are acceptable — a result with some `null` diagnostics fields is still a valid v2.6 result.

---

## 13. Warnings and Errors

### Warnings

Warnings are non-fatal diagnostics. A result may include warnings and still carry `"result": "PASS"`.

```json
"warnings": [
  {
    "code":    "<string>",
    "message": "<string>",
    "context": "<string | null>"
  }
]
```

Example warning codes: `MANIFEST_CHAIN_SECTION_MISSING`, `BUNDLE_TYPE_INFERRED`, `DELTA_FALLBACK_UNPADDED`.

### Errors

Errors record unreadable, malformed, or unprocessable conditions that prevented a check from completing.

```json
"errors": [
  {
    "code":    "<string>",
    "message": "<string>",
    "file":    "<string | null>",
    "context": "<string | null>"
  }
]
```

Example error codes: `MALFORMED_JSON`, `FILE_NOT_FOUND`, `HASH_COMPUTATION_FAILED`, `CHECKSUM_MISMATCH`.

**A result with one or more entries in `errors` must not carry `"result": "PASS"`.** The `result` must be `FAIL` or `ERROR` depending on whether the condition is an integrity failure or a processing failure.

---

## 14. Required Minimal v2.6 Result

The minimum valid v2.6 result object must contain:

```json
{
  "profile":        "vsc-verification-result-v2.6-draft",
  "schema_version": "2.6-draft",
  "verifier": {
    "name":    "<string>",
    "version": "<string>"
  },
  "input": {
    "input_type": "<string>",
    "path":       "<string>",
    "read_only":  true
  },
  "result": "<PASS | FAIL | ERROR | PROOF-ONLY>",
  "checks": {
    "required_files": { "status": "<string>" },
    "checksums":      { "status": "<string>" },
    "chain_token":    { "status": "<string>" },
    "base_token":     { "status": "<string>" },
    "delta_tokens":   { "status": "<string>" },
    "manifest":       { "status": "<string>" }
  }
}
```

- `bundle`, `diagnostics`, `timestamps`, `warnings`, `errors`, and `metadata` are optional.
- Diagnostics may be partially populated.
- `checks` entries for `json_event_metadata`, `canonical_events`, and `interop_receipt` are optional in the minimal form.

---

## 15. Example: PASS Result

This example reflects the current canonical bundle produced by the Node.js reference implementation.

```json
{
  "profile": "vsc-verification-result-v2.6-draft",
  "schema_version": "2.6-draft",
  "verifier": {
    "name": "vsc-go",
    "version": "v2.5-prototype",
    "implementation": "minimal-go-verifier",
    "language": "go"
  },
  "input": {
    "input_type": "evidence_bundle_folder",
    "path": "output/json-event-bundles/vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13",
    "read_only": true
  },
  "bundle": {
    "bundle_type": "JSON Event Evidence Bundle",
    "base_token_id": "408C8C13C4D4",
    "latest_token_id": "ED9566562A13",
    "chain_token_id": "D5C25ED07934",
    "delta_count": 99,
    "checksum_count": 108
  },
  "result": "PASS",
  "checks": {
    "required_files": {
      "status": "PASS"
    },
    "checksums": {
      "status": "PASS",
      "expected": 108,
      "actual": 108
    },
    "chain_token": {
      "status": "PASS",
      "message": "408C8C13C4D4 → ED9566562A13"
    },
    "base_token": {
      "status": "PASS"
    },
    "delta_tokens": {
      "status": "PASS",
      "expected": 99,
      "actual": 99
    },
    "manifest": {
      "status": "PASS"
    },
    "json_event_metadata": {
      "status": "PASS"
    },
    "canonical_events": {
      "status": "NOT_IMPLEMENTED"
    },
    "interop_receipt": {
      "status": "NOT_IMPLEMENTED"
    }
  },
  "diagnostics": {
    "checksums_verified": 108,
    "checksums_expected": 108,
    "delta_tokens_found": 99,
    "delta_tokens_expected": 99,
    "hash_algorithm": "sha256"
  },
  "warnings": [],
  "errors": []
}
```

---

## 16. Example: FAIL Result

Scenario: a file in the bundle was modified after export, causing a checksum mismatch.

```json
{
  "profile": "vsc-verification-result-v2.6-draft",
  "schema_version": "2.6-draft",
  "verifier": {
    "name": "vsc-go",
    "version": "v2.5-prototype"
  },
  "input": {
    "input_type": "evidence_bundle_folder",
    "path": "output/json-event-bundles/vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13",
    "read_only": true
  },
  "result": "FAIL",
  "checks": {
    "required_files": {
      "status": "PASS"
    },
    "checksums": {
      "status": "FAIL",
      "message": "checksum mismatch: manifest.json",
      "expected": "a3f1...",
      "actual": "9c27..."
    },
    "chain_token": {
      "status": "PASS"
    },
    "base_token": {
      "status": "PASS"
    },
    "delta_tokens": {
      "status": "PASS",
      "expected": 99,
      "actual": 99
    },
    "manifest": {
      "status": "PASS"
    }
  },
  "diagnostics": {
    "checksums_verified": 107,
    "checksums_expected": 108,
    "hash_algorithm": "sha256"
  },
  "warnings": [],
  "errors": [
    {
      "code": "CHECKSUM_MISMATCH",
      "message": "checksum mismatch: manifest.json",
      "file": "manifest.json"
    }
  ]
}
```

**A FAIL result must not be relabelled PASS** by any external system, receipt issuer, or downstream orchestrator. The result class is the authoritative statement about bundle integrity at verification time.

---

## 17. Example: ERROR Result

Scenario: `manifest.json` contains malformed JSON (e.g. a truncated file).

```json
{
  "profile": "vsc-verification-result-v2.6-draft",
  "schema_version": "2.6-draft",
  "verifier": {
    "name": "vsc-go",
    "version": "v2.5-prototype"
  },
  "input": {
    "input_type": "evidence_bundle_folder",
    "path": "output/json-event-bundles/vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13",
    "read_only": true
  },
  "result": "ERROR",
  "checks": {
    "required_files": {
      "status": "PASS"
    },
    "checksums": {
      "status": "PASS",
      "expected": 108,
      "actual": 108
    },
    "chain_token": {
      "status": "PASS"
    },
    "base_token": {
      "status": "PASS"
    },
    "delta_tokens": {
      "status": "PASS",
      "expected": 99,
      "actual": 99
    },
    "manifest": {
      "status": "ERROR",
      "message": "manifest.json could not be parsed: unexpected end of JSON input"
    }
  },
  "diagnostics": {
    "hash_algorithm": "sha256"
  },
  "warnings": [],
  "errors": [
    {
      "code": "MALFORMED_JSON",
      "message": "manifest.json could not be parsed: unexpected end of JSON input",
      "file": "manifest.json"
    }
  ]
}
```

An `ERROR` result means verification could not be completed. It does not mean the bundle is invalid — it means the verifier could not determine validity. If the manifest is later repaired (or replaced with the original), a new verification run may produce `PASS` or `FAIL`.

---

## 18. Compatibility Rules

1. **Additive fields** — implementations may add fields to `checks.[name]`, `diagnostics`, or `metadata` without a profile version bump, provided required fields remain present.
2. **No field renaming** — required fields (`profile`, `schema_version`, `verifier`, `input`, `result`, `checks`) must not be renamed without bumping `schema_version`.
3. **Result class preservation** — no implementation may introduce additional top-level `result` values beyond `PASS`, `FAIL`, `ERROR`, `PROOF-ONLY` within the v2.6 profile. Additional classes require a new profile.
4. **Check name stability** — the nine check names defined in §10 are stable identifiers. New checks may be added as additional keys; existing keys must not be repurposed.
5. **Conformance comparison order** — when comparing two verifier outputs against the same bundle, compare `result` class first. If both are `PASS`, compare per-check statuses. Diagnostics (counts, timings) are informational and must not be used to override a result class comparison.
6. **`NOT_IMPLEMENTED` boundary** — a check with `status: "NOT_IMPLEMENTED"` must not contribute to a conformance PASS determination. Conformance test harnesses must mark the comparison `INCOMPLETE` for any vector that exercises an unimplemented check.

---

## 19. Security and Boundary Rules

1. **The result JSON is a report, not the evidence.** The JSON output documents what the verifier found. It is not the evidence bundle, does not replace the evidence bundle, and does not carry the cryptographic guarantees of the bundle's checksum binding.

2. **The result JSON must not mutate the source bundle.** Producing a verification result is a read-only operation. No file in the source bundle may be created, modified, or deleted as a side-effect of result generation.

3. **The result JSON must not claim legal proof, identity proof, or attribution proof.** A `"result": "PASS"` value means the bundle passed its structural and integrity checks at verification time. It does not certify that the content is legally valid, that the actor who produced the content has been identified, or that any party bears responsibility for the decisions recorded in the bundle.

4. **External systems may reference the result but must not redefine it.** A system operating under the v2.3 Interop Receipt Profile may store a VSC verification result reference in a receipt. That receipt may record that VSC returned `PASS`. It must not relabel the result, override the result class, or claim that the VSC result implies something beyond its defined semantics.

5. **Profile mismatch is an error condition.** If a result document carries `schema_version: "2.6-draft"` but contains fields or result classes inconsistent with this specification, consuming systems must treat it as malformed. Silently accepting a malformed result is a conformance violation.

---

## 20. Roadmap

| Release | Scope |
|---------|-------|
| **v2.6.1** | Implement `--json` flag in `cmd/vsc-go` producing v2.6-conformant output. Validate against §14 minimal required fields. |
| **v2.7** | Conformance Fixture Package: expected v2.6 result documents for each v2.2 conformance vector. Enables automated Node.js vs. Go comparison. |
| **v2.8** | Node.js / Go Result Comparison: produce v2.6 JSON from the Node.js verifier; compare against Go output for the same bundle; surface any divergence. |
| **v3.0** | Enterprise Verification Engine: HTTP verification service emitting v2.6 JSON responses; multi-bundle batch verification; signed result envelopes. |

---

## Appendix A: Defined Profile Identifiers

| Profile string | Release | Description |
|---------------|---------|-------------|
| `vsc-verification-result-v2.6-draft` | v2.6 | This schema. Prototype-level schema. |

Future versions will use the pattern `vsc-verification-result-vX.Y`.

---

## Appendix B: Defined Check Names

| Check name | Introduced | Required for PASS |
|-----------|-----------|-------------------|
| `required_files` | v2.6 | Yes |
| `checksums` | v2.6 | Yes |
| `chain_token` | v2.6 | Yes |
| `base_token` | v2.6 | Yes |
| `delta_tokens` | v2.6 | Yes |
| `manifest` | v2.6 | Yes |
| `json_event_metadata` | v2.6 | Conditional (JSON Event bundles only) |
| `canonical_events` | v2.6 (defined) / v2.7 (implemented) | Not yet |
| `interop_receipt` | v2.6 (defined) / v2.7 (implemented) | Not yet |

---

## Appendix C: Hash Algorithm Registry

Only `sha256` is defined for v2.6. Future versions may extend this registry.

| Identifier | Algorithm | Key length | Notes |
|-----------|-----------|------------|-------|
| `sha256` | SHA-256 | 256-bit | Required for v2.6 |
