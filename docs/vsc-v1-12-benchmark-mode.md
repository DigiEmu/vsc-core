# VSC v1.12 — Benchmark Mode

**Version:** v1.12  
**Purpose:** Reproducible measurement of storage-load reduction and restore/verify performance

---

## Benchmark Mode vs Public Showcase

**Benchmark Mode** is a measurement layer for reproducible testing.  
**Public Showcase** is a stable demo layer for presentation.

They are intentionally separate:

- Benchmark artifacts are **not** automatically used as public showcase metrics
- Benchmark results are written to `output/benchmark/` (isolated namespace)
- Public showcase uses the stable WordPress-style demo chain, not benchmark chains
- Benchmark chains have tiny base fixtures (~287 B) that would show misleading negative reduction values in the public showcase

The public showcase (`npm run vsc -- showcase`) explicitly excludes:
- Chains with base sizes below 100 KB
- Tokens marked with `source: 'benchmark'`
- SVGs from benchmark runs

---

## What Benchmark Mode Measures

VSC Benchmark Mode makes the claim of storage-load reduction **measurable and reproducible**. It measures:

1. **Storage-load reduction** — Comparison between VSC base+delta storage vs. traditional full-copy storage
2. **Restore time** — Time to reconstruct the latest state from a delta chain
3. **Verify time** — Time to cryptographically verify a restored state

### Metrics Reported

| Metric | Description |
|--------|-------------|
| `base_bytes` | Size of the base snapshot |
| `delta_bytes_total` | Total size of all delta tokens |
| `vsc_total_bytes` | Combined base + delta storage |
| `traditional_full_copy_bytes` | Hypothetical storage if each state were a full copy |
| `saved_bytes` | Absolute bytes saved by VSC approach |
| `total_chain_reduction_percent` | Percentage storage reduction (VSC vs full-copy) |
| `delta_only_reduction_percent` | Delta size relative to baseline state |
| `restore_time_ms` | Time to restore latest state from chain |
| `verify_time_ms` | Time to verify restored state by root hash |

---

## What Benchmark Mode Does NOT Claim

To maintain credibility, Benchmark Mode explicitly avoids unbenchmarked claims:

- ❌ Does not claim "90% savings" — the percentage depends on fixture and change patterns
- ❌ Does not claim "instant reconstruction" — timing is measured and reported
- ❌ Does not claim linear scaling — benchmark profiles are fixed and documented
- ❌ Does not measure network transfer, compression, or distributed scenarios
- ❌ Does not benchmark streaming ingestion (future v2 feature)

---

## Usage

### Basic Usage

```bash
# Run default benchmark (medium profile, 100 states)
npm run vsc -- benchmark

# Run specific profile
npm run vsc -- benchmark small    # 10 states - fast smoke test
npm run vsc -- benchmark medium  # 100 states - default
npm run vsc -- benchmark large   # 1000 states - extended test

# Alternative: direct script
npm run benchmark
npm run benchmark small
```

### Output

Benchmark produces three files in `output/benchmark/`:

| File | Purpose |
|------|---------|
| `benchmark-summary.json` | Machine-readable JSON with all metrics |
| `benchmark-report.md` | Human-readable Markdown report |
| `benchmark-chart-data.json` | Chart-ready data for visualization |

---

## Benchmark Profiles

| Profile | States | Purpose | Typical Duration |
|---------|--------|---------|-----------------|
| `small` | 10 | Fast smoke test, CI verification | ~10 seconds |
| `medium` | 100 | Default benchmark, representative | ~60 seconds |
| `large` | 1000 | Extended test, scaling indicator | ~5 minutes |

---

## Fixture Strategy

Benchmark Mode generates **deterministic fixtures** with controlled changes:

1. **Base state** — Initial folder with JSON configs, text files, metadata
2. **Subsequent states** — Sequential modifications following a pattern:
   - Edit text files (append timestamp lines)
   - Add metadata files
   - Modify JSON fields
   - Add small log files
   - Append to existing logs

### Reproducibility Guarantees

- ✅ Deterministic file content (no random bytes)
- ✅ Seeded pseudo-random for change selection (if used)
- ✅ Fixed timestamps for file content
- ✅ No network calls
- ✅ No external dependencies
- ✅ Works on Windows PowerShell
- ✅ Works in GitHub Actions

---

## Calculation Rules

### Total Chain Reduction

```
total_chain_reduction_percent = 100 * (1 - (vsc_total_bytes / traditional_full_copy_bytes))
```

This answers: *"How much storage does VSC save compared to storing full copies of every state?"*

### Delta-Only Reduction

```
delta_only_reduction_percent = 100 * (1 - (delta_bytes_total / base_bytes))
```

This answers: *"How small are the deltas compared to a single full-copy baseline?"*

---

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║   VSC v1.12 — BENCHMARK MODE                               ║
╚════════════════════════════════════════════════════════════╝
Profile: medium
States:  100

Storage Comparison:
  Traditional full-copy storage: 2.45 MB
  VSC total storage:             45.23 KB
    - Base:                      24.50 KB
    - Deltas total:              20.73 KB
  Saved bytes:                   2.41 MB
  Total chain reduction:         98.19%
  Delta-only reduction:          15.38%

Timing:
  Base snapshot time:     245ms
  Delta generation time:  12.4s
  Chain creation time:    156ms
  Restore time:           890ms
  Verify time:            234ms
  Total benchmark time:   15.2s

Verification:
  Restore:                PASS
  Verify:                 PASS
```

---

## Integration with Existing VSC

Benchmark Mode **wraps** the existing VSC engine without changing it:

- Calls `src/encodeFolderCli.js` for base snapshots
- Calls `src/encodeFolderDeltaCli.js` for deltas
- Calls `src/createDeltaChainCli.js` for chain building
- Calls `src/restoreDeltaChain.js` for restoration
- Calls `src/verifyDeltaChain.js` for verification

No existing token, hashing, restore, verify, chain, report, showcase, or SVG seal logic is modified.

---

## Git Safety

### Do NOT Commit

- `test-benchmark/` — Generated fixture folders (large, reproducible)
- `output/benchmark/` — Benchmark outputs (reproducible, environment-specific)
- `output/recovery-*/` — Recovery chunk folders
- `output/delta-*/` — Delta recovery folders
- `output/chain-*/` — Chain restored folders

### Safe to Commit

- `scripts/runBenchmark.js` — Benchmark runner source
- `docs/vsc-v1-12-benchmark-mode.md` — Documentation
- `docs/vsc-v2-architecture-notes.md` — Architecture notes
- Small benchmark JSON outputs if explicitly chosen

---

## Related Documentation

- [VSC v2 Architecture Notes](vsc-v2-architecture-notes.md) — Future design decisions
- [VSC MVP Architecture](vsc-mvp-architecture.md) — Current v1.x architecture
- [WordPress MVP Demo](wordpress-mvp-demo.md) — Existing proof flow

---

## Reproduction Checklist

To verify Benchmark Mode works correctly:

```bash
# 1. Help should show benchmark command
npm run vsc -- help | findstr benchmark

# 2. Benchmark should complete successfully
npm run vsc -- benchmark small

# 3. Output files should exist
dir output\benchmark\benchmark-summary.json
dir output\benchmark\benchmark-report.md

# 4. verify-all should still work
npm run vsc -- verify-all

# 5. Showcase should still work
npm run vsc -- showcase
```

---

*VSC v1.12 — Credibility through reproducible measurement*
