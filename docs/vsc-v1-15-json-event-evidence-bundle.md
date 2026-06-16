# VSC v1.15 — JSON Event Evidence Bundle

**Version:** v1.15  
**Purpose:** Export portable evidence bundles for JSON AI event chains  
**Status:** Research prototype / proof-of-concept

---

## Overview

VSC v1.15 adds **JSON Event Evidence Bundle Export** — a specialized export mode that turns deterministic JSON AI event chains into **portable evidence packages**. This bridges VSC from generic state-delta evidence toward **AI decision-event evidence** suitable for audit, post-incident review, and DigiEmu verification workflows.

The bundle includes:
- **Event schema** — Complete event structure definition
- **Event summary** — Session statistics and event counts
- **JSON benchmark data** — Summary, report, and chart data
- **VSC chain token** — Complete delta chain with all events
- **Base token** — Initial state snapshot
- **Delta tokens** — Ordered state transitions
- **Verification summary** — Restore/verify status and instructions
- **Complete manifest** — Machine-readable inventory
- **SHA-256 checksums** — File integrity verification

---

## Usage

### Basic Usage

```bash
# Export bundle using latest JSON benchmark results
npm run vsc -- bundle:json

# Export bundle with explicit chain token
npm run vsc -- bundle:json output/json-benchmark/vsc-chain-*.json

# Alternative: direct script
npm run bundle:json [chain-token.json]
```

### Prerequisites

```bash
# 1. First, run the JSON event benchmark
npm run vsc -- benchmark:json

# 2. Then export the evidence bundle
npm run vsc -- bundle:json
```

The `bundle:json` command reads the JSON benchmark summary to locate the chain token and event data.

---

## Bundle Structure

```
output/json-event-bundles/vsc-json-event-bundle-<BASE>-to-<LATEST>/
├── README.md                           # Human-readable bundle guide
├── manifest.json                       # Complete artifact inventory
├── event-schema.json                   # Event structure definition
├── event-summary.json                  # Session statistics
├── json-benchmark-summary.json         # Benchmark metrics
├── json-benchmark-report.md            # Human-readable report
├── json-benchmark-chart-data.json      # Chart/plot data
├── chain-token.json                    # Complete delta chain
├── base-token.json                     # Initial state snapshot
├── verification-summary.json           # Verification status
├── checksums.sha256                   # SHA-256 checksums
└── delta-tokens/
    ├── delta-001.json                 # First delta step
    ├── delta-002.json                 # Second delta step
    └── ...
```

---

## Event Model

### Primary Unit of Proof

**Individual Event** — Each AI decision, tool call, policy check, or retrieval is recorded as a discrete, verifiable event.

### Event Types

| Type | Description |
|------|-------------|
| `prompt_response` | AI prompt/response cycle |
| `tool_call` | External tool invocation |
| `policy_check` | Safety/policy evaluation |
| `retrieval` | Knowledge base lookup |
| `final_decision` | Ultimate output/decision |

### Required Event Fields

```json
{
  "event_id": "sha256-hash-of-event-data",
  "sequence": 1,
  "timestamp": "2026-01-01T00:00:01.000Z",
  "event_type": "prompt_response",
  "actor": "ai-model",
  "session_id": "fixed-session-id",
  "model": "gpt-4-class",
  "input_hash": "sha256-of-input",
  "output_hash": "sha256-of-output",
  "policy_result": "pass",
  "tool_calls": [],
  "metadata": {}
}
```

### Determinism

JSON Event Benchmark uses **deterministic synthetic data**:

- Fixed timestamp base (deterministic epoch)
- Deterministic event IDs (SHA-256 based on content)
- Fixed session ID per benchmark run
- Canonical JSON serialization
- No random or network-dependent event data

This ensures **reproducible, verifiable results** across runs.

---

## Verification

### Automatic Checksums

Verify file integrity:

```bash
cd output/json-event-bundles/vsc-json-event-bundle-<BASE>-to-<LATEST>
sha256sum -c checksums.sha256
```

### Check Benchmark Results

```bash
# View restore and verify status
cat json-benchmark-summary.json | jq '.restoreResult, .verifyResult'
```

Expected: `PASS` for both.

### Manual Chain Verification

```bash
# 1. Restore latest state
npm run vsc -- restore chain-token.json

# 2. Verify root hash match
npm run vsc -- verify chain-token.json output/chain-<BASE>-to-<LATEST>/restored-<folder>
```

---

## What's Included vs Excluded

### Included

- ✅ Event schema (complete structure definition)
- ✅ Event summary (session statistics)
- ✅ JSON benchmark summary, report, and chart data
- ✅ Chain token (complete delta chain)
- ✅ Base token (initial state)
- ✅ Delta tokens (ordered steps)
- ✅ Verification summary
- ✅ Complete manifest
- ✅ SHA-256 checksums

### Excluded (by design)

- ❌ Recovery chunk folders (`output/recovery-*`)
- ❌ Restored state folders (`output/chain-*/restored-*`)
- ❌ Benchmark fixture folders (`test-json-benchmark/`)
- ❌ Heavy binary files
- ❌ `node_modules/`
- ❌ Source code

---

## Safety & Limitations

### Research Prototype

This is **research prototype software**, not enterprise production infrastructure:

- **Synthetic Data** — Events are deterministically generated, not real AI inference
- **Simulated Tools** — Tool calls are recorded but not actually executed
- **Single Session** — Fixed session ID, not multi-session orchestration
- **No Streaming** — Events are batch-generated
- **No WAL** — No write-ahead logging for durability guarantees

### Bundle Limitations

| Aspect | Limitation |
|--------|------------|
| Recovery | Chunk folders must be regenerated from tokens |
| Restore | State must be restored manually for verification |
| Events | Synthetic, not real AI inference |
| Scope | Single-session, not multi-session |

### AI Evidence Context

This bundle is a **bridge toward AI evidence logging**, not a claim of enterprise-ready infrastructure:

- Models deterministic AI-style events
- Uses synthetic data for reproducibility
- Demonstrates proof-of-concept for future AI audit trails
- Suitable for research, not production compliance

---

## Use Cases

### Audit Trail

Create verifiable evidence for AI decision logs:

```bash
# Run benchmark and export evidence
npm run vsc -- benchmark:json
npm run vsc -- bundle:json

# Archive bundle for compliance
cp -r output/json-event-bundles/vsc-json-event-bundle-* ./audit-archive/
```

### Research Publication

Package reproducible AI event evidence:

```bash
npm run vsc -- benchmark:json
npm run vsc -- bundle:json
cp -r output/json-event-bundles/vsc-json-event-bundle-* ./paper/artifacts/
```

### Post-Incident Review

Capture AI decision state for investigation:

```bash
# After running AI-style workload through VSC
npm run vsc -- bundle:json output/vsc-chain-<SESSION>-*.json
# Review event-summary.json for decision timeline
```

### DigiEmu Verification

Export as DigiEmu proof artifact:

```bash
npm run vsc -- bundle:json
tar czf digiemu-proof.tar.gz output/json-event-bundles/vsc-json-event-bundle-*/
```

---

## Manifest Format

The `manifest.json` provides machine-readable bundle metadata:

```json
{
  "bundle_name": "vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13",
  "bundle_version": "1.0",
  "bundle_type": "json_event_evidence_bundle",
  "vsc_version": "v1.15",
  "event_model": {
    "primary_unit_of_proof": "Individual Event",
    "schema_version": "v1.0",
    "event_types": ["prompt_response", "tool_call", ...],
    "required_fields": ["event_id", "sequence", "timestamp", ...]
  },
  "benchmark": {
    "total_events": 1000,
    "state_count": 100,
    "session_id": "fixed-session-id",
    "restore_status": "PASS",
    "verify_status": "PASS"
  },
  "chain": {
    "token_id": "vsc-chain-408C8C13C4D4-to-ED9566562A13",
    "base_token_id": "408C8C13C4D4",
    "latest_token_id": "ED9566562A13",
    "delta_count": 99
  },
  "warnings": [],
  "limitations": [...]
}
```

---

## Reproduction

To reproduce a bundle from scratch:

```bash
# 1. Run JSON event benchmark
npm run vsc -- benchmark:json

# 2. Verify benchmark completed
npm run vsc -- verify-all
# Expected: FAIL: 0

# 3. Export evidence bundle
npm run vsc -- bundle:json

# 4. Verify bundle
sha256sum -c output/json-event-bundles/vsc-json-event-bundle-*/checksums.sha256
```

---

## Related Documentation

- [VSC v1.14 Evidence Bundle Export](vsc-v1-14-evidence-bundle-export.md) — Generic bundle export
- [VSC v1.13 JSON Event Benchmark](vsc-v1-13-json-event-benchmark.md) — JSON benchmark
- [VSC v1.12 Benchmark Mode](vsc-v1-12-benchmark-mode.md) — Folder/file benchmark
- [VSC v2 Architecture Notes](vsc-v2-architecture-notes.md) — Future design

---

*VSC v1.15 — Portable AI event proof for verifiable state commitments*
