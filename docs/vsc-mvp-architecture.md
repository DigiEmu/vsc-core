# VSC MVP Architecture

## Core Model

```
VSC = Base + Delta + Proof + Recovery

T = (B, Δ, P, R)

B = base snapshot     — full folder or file state, chunked and hashed
Δ = ordered changes   — set of file-level operations applied to B
P = proof             — root hash, payload hash, or chain hash
R = recovery          — chunk index and restore rules for reconstructing state
```

A VSC token is a self-contained record: it stores what changed (or what the base state is), how to verify it, and how to recover it.

---

## Token Types

| Type | Mode | Description |
|------|------|-------------|
| `FOLDER_RECOVERY` | `FOLDER_RECOVERY` | Full folder base snapshot, chunked, root-hashed |
| `FOLDER_DELTA` | `FOLDER_DELTA` | Sparse delta from one folder state to another |
| `DELTA_CHAIN` | `DELTA_CHAIN` | Ordered sequence: base token + delta tokens |
| `RECOVERY` | `RECOVERY` | Binary file, chunked, recoverable by hash |
| `PROOF` | `PROOF` | Proof-only token for small or structured payloads |

---

## Restore Model

```
Base snapshot
  + Delta 1  (apply added/modified/deleted files)
  + Delta 2
  + ...
= Latest reconstructed state
```

Each delta stores only the files that changed — added, modified, or deleted — relative to the previous state. Restoring applies each delta in order onto a working copy of the base.

---

## Verification Model

Each token stores a `proof` object containing one or more of:

- `payloadHash` — SHA-256 hash of the full payload
- `targetFolderRootHash` — SHA-256 of all file hashes in the target folder, sorted
- `chainHash` — SHA-256 of the concatenated root hashes across all chain steps
- `latestFolderRootHash` — root hash of the final reconstructed state

Verification reconstructs the expected hash from the stored data and compares it against the proof field. No match = FAIL.

---

## Current MVP Limits

- Local filesystem storage only
- No distributed object storage yet
- No API layer yet
- No authentication or tenant model yet
- No production hardening yet
- Token storage is flat files in `output/` — no indexed database
- Gallery is a static HTML file generated at encode time

---

## Next Scaling Direction

The current MVP is a single-process Node.js CLI tool. The intended next layers are:

- **vsc-core** — portable token logic as a library
- **vsc-cli** — command-line interface wrapping core
- **vsc-api** — REST API for token creation, verification, and restore
- **vsc-worker** — queue-based async processing for large payloads
- **object storage** — S3-compatible chunk and token storage
- **PostgreSQL metadata** — indexed token manifest, chain index, proof records
- **queue-based processing** — decouple encode/decode from API response time
