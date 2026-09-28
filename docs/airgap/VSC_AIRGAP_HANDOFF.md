# VSC Air-Gapped Evaluation Runner — Handoff

## Package version

- `v0.1`
- Image tag: `vsc-airgap-eval:v0.1`
- Runner entrypoint: `vsc-airgap`

## What is in this package

A standalone, network-less, Docker-runnable VSC transformation tool. It reads a synthetic `benchmark-input.json` and writes:

- `vsc-request.json` — a deterministic VSC text token.
- `evidence.json` — metadata and hashes only.

The package contains no Ollama client, no HTTP server, no telemetry, no credentials, and no model access. It is intended for local, air-gapped comparative benchmarking by the operator.

## Known limitation

**`vsc-request.json` is a VSC token, not an Ollama `/api/generate` or `/api/chat` request.** The operator must construct the actual Ollama prompt from `benchmark-input.json` (or from the message the operator already possesses) in a separate, non-VSC step. The VSC token is an integrity artifact for later verification.

## Build instructions

From the repository root:

```powershell
docker build -t vsc-airgap-eval:v0.1 -f Dockerfile.airgap .
```

## Save / load instructions

To create a transportable archive:

```powershell
docker save vsc-airgap-eval:v0.1 -o vsc-airgap-eval-v0.1.tar
```

To load on the air-gapped host:

```bash
docker load -i vsc-airgap-eval-v0.1.tar
```

## Docker run (file-in / file-out)

On the air-gapped host, create a directory with `benchmark-input.json`:

```bash
mkdir -p /path/to/input /path/to/output
cp benchmark-input.json /path/to/input/
```

Run with the network disabled:

```bash
docker run --rm --network none \
  -v /path/to/input:/input:ro \
  -v /path/to/output:/output \
  vsc-airgap-eval:v0.1 \
  transform \
  --input /input/benchmark-input.json \
  --output /output/vsc-request.json \
  --evidence /output/evidence.json
```

Retrieve the outputs from `/path/to/output`.

## Files produced

- `/output/vsc-request.json` — deterministic VSC token of the input message.
- `/output/evidence.json` — run metadata, hashes, byte counts, and VSC token metrics.
- `stdout` — a short status JSON (metadata only, no message).

## Security guarantees and limitations

### Guarantees

- The container requires no network (`--network none`).
- No Ollama API is called.
- No AHT or model container is accessed.
- No HTTP server is started.
- No telemetry is sent.
- No credentials, `.env`, or secrets are read or written.
- `evidence.json` does not contain the message text.
- `stdout`/`stderr` do not contain the message text.
- Inputs with `system`, `messages`, `api_key`, or other unsupported fields fail closed.

### Limitations

- `v0.1` does not generate an Ollama-compatible request JSON.
- The VSC token in `vsc-request.json` is reversible to the uppercased message; handle it with the same sensitivity as the input.
- Only single text messages are supported.
- `processing_duration_ms` is a non-deterministic measurement and not an integrity field.
- The image does not include `package.json`, `node_modules`, or unrelated repository material.

## How Alya runs baseline separately

1. Create a `benchmark-input.json` with the baseline `message` (no VSC token).
2. Run the airgap container to produce `vsc-request.json` and `evidence.json`.
3. In a separate, non-VSC process, pass the original `message` from `benchmark-input.json` to the local `qwen3:30b` (Ollama).
4. Record the baseline response.

## How Alya runs the VSC condition separately

1. Create a `benchmark-input.json` with the VSC condition `message` (synthetic, non-sensitive).
2. Run the airgap container to produce `vsc-request.json` and `evidence.json`.
3. In a separate, non-VSC process, pass the original `message` to the local `qwen3:30b` (Ollama).
4. Record the VSC condition response.
5. Compare baseline and VSC condition results using the operator's own comparison methodology.

## Statement on VSC / Ollama / AHT access

This `v0.1` package does not access Ollama, the AHT container, or any remote service. It performs only local file transformation using existing VSC `src/encodeText.js`, `src/decodeText.js`, and `src/verify.js` logic. Model interaction is entirely outside this container and is the operator's responsibility.

## Verification after loading

Run a smoke test:

```bash
docker run --rm --network none \
  -v $(pwd)/airgap/fixtures:/input:ro \
  -v $(pwd)/output/airgap-smoke:/output \
  vsc-airgap-eval:v0.1 \
  transform \
  --input /input/benchmark-input-example.json \
  --output /output/vsc-request.json \
  --evidence /output/evidence.json
```

Expected:

- Exit `0`.
- `output/vsc-request.json` contains the VSC token.
- `output/evidence.json` contains `status: "PASS"`.
- No message text in the container logs.
