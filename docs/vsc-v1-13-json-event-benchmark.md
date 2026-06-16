# VSC v1.13 — JSON Event Benchmark

**Version:** v1.13  
**Purpose:** Reproducible measurement of storage-load reduction for structured AI event evidence  
**Status:** Research prototype / proof-of-concept

---

## Overview

VSC v1.13 JSON Event Benchmark extends the v1.12 Benchmark Mode from folder/file state to **structured AI decision event logs represented as deterministic JSON**. This bridges the existing file/folder proof-of-concept toward AI evidence logging.

The benchmark shows that VSC can measure storage-load reduction for:
- Growing event logs (each state contains more events)
- Structured JSON with canonical key ordering
- Deterministic synthetic AI events (prompts, tool calls, policy checks)

---

## JSON Event Model

### Primary Unit of Proof: Individual Event

Each event represents one discrete AI-relevant decision step:

| Field | Description | Example |
|-------|-------------|---------|
| `event_id` | Unique deterministic identifier | `A1B2C3D4E5F6...` |
| `sequence` | Ordered position in stream | `42` |
| `timestamp` | Deterministic ISO timestamp | `2024-01-01T00:00:42.000Z` |
| `event_type` | Classification | `prompt_response`, `tool_call`, `policy_check`, `retrieval`, `final_decision` |
| `actor` | System component | `ai_agent`, `orchestrator`, `validator`, `retriever` |
| `session_id` | Session context | `SESSION123...` |
| `model` | AI model identifier | `gpt-4`, `claude-3`, `llama-3` |
| `input_hash` | Content hash | `a1b2c3d4...` |
| `output_hash` | Content hash | `e5f6a7b8...` |
| `policy_result` | Policy decision | `allowed`, `blocked`, `flagged`, `review_required` |
| `tool_calls` | Structured invocations | `[{tool: "search", args: {...}}]` |
| `metadata` | Event metrics | `{tokens_in: 150, tokens_out: 75}` |
| `prev_event_hash` | Chain integrity | `d4e5f6a7...` |
| `canonical` | Deterministic marker | `true` |

### Event Types

- **prompt_response**: Standard prompt/response cycle
- **tool_call**: External tool invocation
- **policy_check**: Safety/policy evaluation
- **retrieval**: Knowledge base/document lookup
- **final_decision**: Conclusive action

---

## State Representation

Each benchmark state is a folder containing a canonical `events.json` file:

```
test-json-benchmark/
├── state-000/
│   └── events.json          # Base: 1 event
├── state-001/
│   └── events.json          # 2 events
├── state-002/
│   └── events.json          # 3 events
...
└── state-099/
    └── events.json          # State N: N+1 events (accumulating)
```

- State 0 (base): Contains 1 event
- State N: Contains N+1 events (accumulating log model)
- The existing folder-based VSC engine snapshots/deltas the JSON state

---

## Usage

### Basic Usage

```bash
# Run default benchmark (medium profile, 100 states)
npm run vsc -- benchmark:json

# Run specific profile
npm run vsc -- benchmark:json small    # 10 states - fast smoke test
npm run vsc -- benchmark:json medium  # 100 states - default
npm run vsc -- benchmark:json large   # 1000 states - extended

# Alternative: direct script
npm run json-benchmark
npm run json-benchmark small
```

### Output

Benchmark produces three files in `output/json-benchmark/`:

| File | Purpose |
|------|---------|
| `json-benchmark-summary.json` | Machine-readable JSON with all metrics |
| `json-benchmark-report.md` | Human-readable Markdown report |
| `json-benchmark-chart-data.json` | Chart-ready data for visualization |

---

## Benchmark Profiles

| Profile | States | Events per State | Total Events | Purpose | Typical Duration |
|---------|--------|------------------|--------------|---------|-----------------|
| `small` | 10 | 1 | 55 | Fast smoke test | ~15 seconds |
| `medium` | 100 | 1 | 5,050 | Default benchmark | ~2-3 minutes |
| `large` | 1000 | 1 | 500,500 | Extended scaling test | ~30+ minutes |

*Note: Total events = sum of 1+2+3+...+N = N*(N+1)/2 for accumulating model*

---

## Deterministic Generation

All events are generated deterministically:

- **Timestamps**: Start from `2024-01-01T00:00:00.000Z`, increment by 1 second per event
- **Event IDs**: SHA-256 of `event-{session}-{sequence}`
- **Content hashes**: SHA-256 of placeholder text
- **Session ID**: SHA-256 of seed value
- **Event types**: Cycle through 5 types based on sequence
- **No random values** (unless seeded)
- **No network calls**

This ensures **reproducible benchmark results** across runs and environments.

---

## What It Measures

### Storage Metrics

| Metric | Description |
|--------|-------------|
| `raw_json_full_copy_bytes` | Hypothetical storage if each state were stored as full JSON |
| `vsc_base_bytes` | Size of base snapshot |
| `vsc_delta_bytes_total` | Total size of all delta tokens |
| `vsc_total_bytes` | Combined VSC storage (base + deltas) |
| `saved_bytes` | Absolute bytes saved by VSC approach |
| `total_chain_reduction_percent` | Percentage reduction (VSC vs full-copy) |
| `delta_only_reduction_percent` | Delta size relative to baseline |

### Timing Metrics

- Base snapshot generation time
- Delta generation time (total for all deltas)
- Chain construction time
- Restore time (latest state reconstruction)
- Verify time (root hash comparison)

---

## Separation from Public Showcase

**JSON Event Benchmark** is a measurement layer for structured event logs.  
**Public Showcase** remains the stable WordPress-style folder demo.

The showcase (`npm run vsc -- showcase`) explicitly excludes:
- Chains with base sizes below 100 KB
- Tokens marked with `source: 'json-benchmark'`
- SVGs from JSON benchmark runs

JSON benchmark results are written to `output/json-benchmark/` and do not affect the public showcase metrics.

---

## Limitations

- **Synthetic events**: Deterministic placeholder content, not real AI logs
- **Accumulating model**: Each state contains all previous events (worst-case for storage)
- **No streaming**: Events are batched as JSON files (v2 will address streaming)
- **No WAL**: Events are written directly to state files (v2 will add Write-Ahead Log)
- **Research prototype**: Not enterprise production software
- **No compression**: Only delta encoding, no additional compression
- **Local only**: Network/distributed scenarios not tested

---

## Architecture Context

This benchmark aligns with v2 architecture principles (documented in `vsc-v2-architecture-notes.md`):

- **Individual Event** as primary unit of proof
- **Micro-batching** as technical optimization (not proof structure change)
- **Checkpointed State Chains** for storage optimization
- Foundation for future **Proof / Locate / Recover** modes
- Bridge toward **streaming ingestion** and **WAL** in v2

---

## Reproduction

```bash
# Verify benchmark works
npm run vsc -- benchmark:json small

# Check outputs exist
ls output/json-benchmark/
# json-benchmark-summary.json
# json-benchmark-report.md
# json-benchmark-chart-data.json

# Verify other commands still work
npm run vsc -- verify-all        # FAIL: 0
npm run vsc -- showcase           # Uses WordPress demo, not JSON benchmark
npm run vsc -- benchmark          # v1.12 folder benchmark still works
```

---

## Related Documentation

- [VSC v1.12 Benchmark Mode](vsc-v1-12-benchmark-mode.md) — Folder/file benchmark
- [VSC v2 Architecture Notes](vsc-v2-architecture-notes.md) — Future design
- [WordPress MVP Demo](wordpress-mvp-demo.md) — Stable public demo

---

*VSC v1.13 — Measuring storage-load reduction for structured AI event evidence*
