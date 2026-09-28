# VSC Air-Gapped Evaluation Runner Specification

## Version

- **Specification version:** `v0.1`
- **Runner name:** `vsc-airgap`
- **Runner entrypoint:** `cmd/vsc-airgap/main.mjs`
- **Container image tag:** `vsc-airgap-eval:v0.1`

---

## 1. Purpose

Provide a standalone, network-less VSC transformation and evidence-generation tool for the Alyosha/AHT operator to run locally, in an air-gapped environment, for independent benchmarking.

The runner produces a deterministic VSC token and an evidence record from a synthetic, non-sensitive `benchmark-input.json`, without ever accessing a model container, an Ollama endpoint, or any remote service.

---

## 2. Scope

- Read a `benchmark-input.json` from a read-only mount.
- Validate that the input matches the supported contract.
- Transform the `message` field into a VSC text token using the existing repository `src/encodeText.js::encodeTextToVscToken` function.
- Verify the token using `src/decodeText.js::decodeVscToken` and `src/verify.js::verifyDecodedMessage`.
- Write `vsc-request.json` (the VSC token) and `evidence.json` (metadata only) to a writable output mount.
- Print only metadata/status to `stdout`/`stderr`.
- Exit with a documented, fail-closed code.

---

## 3. Non-goals

- This version does not generate an Ollama API request. The `vsc-request.json` output is a VSC token; Ollama request construction is out of scope for `v0.1` because the repository does not contain Ollama request-generation logic. This is reported as a known gap in the handoff document.
- No model response handling.
- No remote proxy, HTTP server, or telemetry.
- No system-prompt processing.
- No credentials or secrets.
- No access to model weights or the AHT container.
- No Docker image publication.

---

## 4. Threat / Security Boundary

### Environment

- The container is intended to run with `--network none`.
- No network is required by the runner.
- No HTTP, TCP, UDP, or IPC listeners are started.

### Data handling

- The `message` field is read from the input file.
- The `message` string is not printed to `stdout` or `stderr`.
- The `message` string does not appear in `evidence.json`.
- The `evidence.json` contains only hashes, byte counts, VSC metrics, duration, and status.
- The `vsc-request.json` (VSC token) is a reversible sparse-bit representation of the uppercased message. It is the transformed output artifact, not a log. The operator is responsible for handling it under the same sensitivity rules as the input.
- No `system` prompt, `messages` array, or `api_key` is accepted or processed. Inputs containing these fail closed.

### Filesystem

- The input mount should be read-only (`:ro`).
- The output mount should be writable.
- The runner writes only to the specified `--output` and `--evidence` paths.

---

## 5. Exact Input JSON Contract

`benchmark-input.json` is a single JSON object.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `run_id` | string | No | Stable run identifier. Generated if omitted. |
| `message` | string | Yes | Non-empty text message to encode. |
| `type` | string | No | VSC token type. Defaults to `"TEXT"`. |
| `config` | object | No | Allowed keys: `model`, `temperature`, `seed`, `num_ctx`, `stream`. |

### Allowed `config` fields

| Key | Type | Description |
|-----|------|-------------|
| `model` | string | Model name, e.g., `"qwen3:30b"`. Not used by the runner; passed through as metadata. |
| `temperature` | number | Sampling temperature. Not used by the runner. |
| `seed` | number | Sampling seed. Not used by the runner. |
| `num_ctx` | number | Context size. Not used by the runner. |
| `stream` | boolean | Whether the operator will stream. Not used by the runner. |

### Rejected fields (fail closed)

- `system`
- `messages`
- `api_key`, `apikey`, `token`, `key`
- Any unknown top-level or `config` field

### Example

```json
{
  "run_id": "airgap-demo-001",
  "message": "DETERMINISTIC RECONSTRUCTION ALLOWS INDEPENDENT VERIFICATION OF AI OUTPUTS.",
  "type": "TEXT",
  "config": {
    "model": "qwen3:30b",
    "temperature": 0.6,
    "seed": 15,
    "num_ctx": 61501
  }
}
```

---

## 6. Exact Transformed-Output Contract

`vsc-request.json` is the serialized VSC token produced by `src/encodeText.js::encodeTextToVscToken`.

### Fields present

| Field | Source | Description |
|-------|--------|-------------|
| `protocol` | VSC token | `"VSC"` |
| `version` | VSC token | `"0.3"` |
| `id` | VSC token | First 12 hex characters of `payloadHash`, uppercased. |
| `type` | VSC token | Uppercased input type. |
| `baseline` | VSC token | `"0"` |
| `encoding` | VSC token | `"ASCII"` |
| `messageLength` | VSC token | Length of the uppercased message. |
| `readRule` | VSC token | Radial sparse-bit read rule. |
| `delta` | VSC token | Sparse bit positions of the uppercased message. |
| `proof` | VSC token | SHA-256 of the uppercased message. |

### Determinism

- For a fixed `message` and `type`, the token is byte-identical across runs.
- `JSON.stringify` with two-space indentation is used.
- No timestamps, run IDs, or random values are embedded in the token.

### Ollama compatibility note

The `v0.1` `vsc-request.json` is a VSC token, not an Ollama `/api/generate` or `/api/chat` request. The operator must construct the Ollama request separately or use the message from `benchmark-input.json` as the `prompt`. This is a documented v0.1 limitation.

---

## 7. Evidence JSON Contract

`evidence.json` contains only the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `input_bytes` | number | Byte length of the raw `benchmark-input.json` file. |
| `input_sha256` | string | SHA-256 of the raw `benchmark-input.json` file. |
| `processing_duration_ms` | number | Non-deterministic wall-clock duration in milliseconds. **Not used for integrity.** |
| `run_id` | string | The run identifier. |
| `status` | string | `"PASS"` or `"ERROR"`. |
| `transformed_output_bytes` | number | Byte length of the raw `vsc-request.json` file. |
| `transformed_output_sha256` | string | SHA-256 of the raw `vsc-request.json` file. |
| `vsc_token_delta_count` | number | Number of sparse deltas in the VSC token. |
| `vsc_token_message_length` | number | `messageLength` from the VSC token. |
| `vsc_version` | string | `version` field from the VSC token. |

The fields are emitted in alphabetical key order for byte stability.

---

## 8. Deterministic Requirements

- For the same `benchmark-input.json` bytes and the same `vsc-airgap` version, `vsc-request.json` bytes are identical.
- The deterministic subset of `evidence.json` (`input_sha256`, `transformed_output_sha256`, `input_bytes`, `transformed_output_bytes`, `vsc_token_message_length`, `vsc_token_delta_count`, `vsc_version`, `run_id`, `status`) is identical across runs.
- `processing_duration_ms` is non-deterministic and excluded from integrity checks.

---

## 9. Permitted and Prohibited Logging

### Permitted output to `stdout` / `stderr`

- Exit due to invalid input.
- Metadata/status JSON (no message content).
- Field names of rejected input.

### Prohibited output to `stdout` / `stderr`

- Raw `message` content.
- Any `prompt`, `system`, `messages`, or `api_key` value.
- Token payload text decoded from the VSC token.
- File paths that reveal sensitive names.

---

## 10. CLI Contract

```
vsc-airgap transform \
  --input <path-to-benchmark-input.json> \
  --output <path-to-vsc-request.json> \
  --evidence <path-to-evidence.json>
```

### Local invocation (Windows)

```powershell
cmd\vsc-airgap\vsc-airgap.cmd transform `
  --input airgap\fixtures\benchmark-input-example.json `
  --output output\airgap\vsc-request.json `
  --evidence output\airgap\evidence.json
```

### Container invocation

```bash
docker run --rm --network none \
  -v <host-input>:/input:ro \
  -v <host-output>:/output \
  vsc-airgap-eval:v0.1 \
  transform \
  --input /input/benchmark-input.json \
  --output /output/vsc-request.json \
  --evidence /output/evidence.json
```

---

## 11. Exit Codes

| Exit | Meaning |
|------|---------|
| `0` | Transformation and evidence generation succeeded (`status: PASS`). |
| `1` | CLI usage error or unknown command. |
| `2` | Invalid input, unsafe input, or transformation failure. |

---

## 12. Failure Behavior

- All failure modes are fail-closed: no `vsc-request.json` or `evidence.json` with `status: PASS` is produced for invalid or unsafe input.
- On error, the runner exits non-zero and prints an `ERROR` line to `stderr` without exposing the message content.
- Missing or malformed `config` fields, `system` fields, `messages` arrays, or unsupported fields result in exit `2`.

---

## 13. Docker Execution Model

- Base image: `node:20-alpine`
- Network: none (`--network none`)
- Entrypoint: `vsc-airgap`
- Input mount: `/input` (read-only)
- Output mount: `/output` (read-write)
- No volumes or state are persisted inside the container.
- No `package.json` or `node_modules` are required in the image; the runner uses only Node built-in modules and the copied `src/encodeText.js`, `src/decodeText.js`, and `src/verify.js`.

---

## 14. File-Mount Model

```
host-input/
  benchmark-input.json

host-output/
  vsc-request.json
  evidence.json
```

The operator provides the input mount as read-only and the output mount as writable. The runner does not read or write outside these two mount points.

---

## 15. Acceptance Criteria

1. The container builds successfully.
2. The container runs with `--network none`.
3. The same input twice produces byte-identical `vsc-request.json`.
4. The same input twice produces identical deterministic evidence fields.
5. `stdout`/`stderr` never contain the input `message` string.
6. Invalid input fails closed (exit `2`).
7. Input with `system` or `messages` fields fails closed.
8. `evidence.json` contains no prompt, system, or secret fields.
9. `vsc-request.json` contains no credentials or added system-prompt fields.
10. Existing VSC Go verifier and conformance comparison still pass.

---

## 16. Version / Integrity Requirements

- The image tag is `vsc-airgap-eval:v0.1`.
- The runner version is embedded in the `evidence.json` as `vsc_version` (the VSC token version).
- The `run_id` allows the operator to correlate `benchmark-input.json`, `vsc-request.json`, and `evidence.json`.
- SHA-256 of the input and output files is recorded in `evidence.json`.

---

## 17. Operator Workflow

1. Create `benchmark-input.json` with a synthetic, non-sensitive `message`.
2. Mount the input file into `/input` and an empty output directory into `/output`.
3. Run the container with `--network none`.
4. Retrieve `vsc-request.json` and `evidence.json` from `/output`.
5. Use `benchmark-input.json` (or the message extracted from it) as the Ollama `prompt` in a separate, non-VSC process.
6. Retain `vsc-request.json` and `evidence.json` for later VSC integrity verification.

---

## 18. Limitations

- `v0.1` does not produce an Ollama-compatible request. `vsc-request.json` is a VSC token.
- Only single text `message` inputs are supported.
- `processing_duration_ms` is non-deterministic and for measurement only.
- The VSC token is reversible to the uppercased message; handle it with the same sensitivity as the input.
- No compression is guaranteed for short text; `vsc-request.json` may be larger than the input.

---

## 19. Open Questions

1. Should `v0.2` produce a true Ollama `/api/generate` or `/api/chat` request JSON that carries the VSC token inside an ignored or documented field?
2. Should the token be encrypted or masked before it leaves the air-gapped container?
3. Should the runner support file-based (`src/encodeFile.js`) inputs for binary prompts?
4. Should the operator require a signed `benchmark-input.json` or a checksum at the input mount?
5. Should `vsc-request.json` be named `vsc-token.json` instead to avoid implying Ollama compatibility in `v0.1`?
