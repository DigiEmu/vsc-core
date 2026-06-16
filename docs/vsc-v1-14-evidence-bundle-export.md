# VSC v1.14 — Evidence Bundle Export

**Version:** v1.14  
**Purpose:** Export complete, portable evidence packages for VSC delta chains  
**Status:** Research prototype / proof-of-concept

---

## Overview

VSC v1.14 adds **Evidence Bundle Export** — a CLI command that turns a verified VSC delta chain into a **portable evidence package** containing all proof artifacts:

- Chain token (complete delta chain)
- Base token (initial state snapshot)
- Delta tokens (ordered state changes)
- Chain report (human-readable summary)
- SVG seals (visual proof representations)
- Verification summary
- Complete manifest
- SHA-256 checksums

These bundles can be **shared with partners, auditors, researchers**, or used as **DigiEmu proof artifacts**.

---

## Usage

### Basic Usage

```bash
# Export bundle for a chain token
npm run vsc -- bundle output/vsc-chain-21A8390BFA3F-to-954BEB0FF3AA.json

# Alternative: direct script
npm run bundle output/vsc-chain-21A8390BFA3F-to-954BEB0FF3AA.json

# Or use Node directly
node scripts/exportEvidenceBundle.js output/vsc-chain-21A8390BFA3F-to-954BEB0FF3AA.json
```

### Output

Bundle is created in `output/bundles/vsc-bundle-<BASE>-to-<LATEST>/`:

```
output/bundles/vsc-bundle-21A8390BFA3F-to-954BEB0FF3AA/
├── README.md                    # Human-readable bundle guide
├── manifest.json                # Complete artifact inventory
├── chain-token.json             # The delta chain token
├── base-token.json              # Base state recovery token
├── verification-summary.json    # Verification status & instructions
├── checksums.sha256            # SHA-256 checksums for all files
├── delta-tokens/
│   ├── delta-1.json            # First delta step
│   └── delta-2.json            # Second delta step
├── reports/
│   └── chain-report.md         # Human-readable chain report
└── seals/
    ├── base.svg                # Base state seal
    ├── delta-1.svg             # First delta seal
    ├── delta-2.svg             # Second delta seal
    └── chain.svg               # Chain seal
```

---

## Bundle Structure

### Core Tokens

| File | Description |
|------|-------------|
| `chain-token.json` | Complete delta chain with all steps, proofs, and hashes |
| `base-token.json` | Initial state snapshot (content hash, root hash, recovery manifest) |
| `delta-tokens/delta-*.json` | Ordered delta steps (1.json, 2.json, etc.) |

### Documentation

| File | Description |
|------|-------------|
| `README.md` | Bundle guide: inspection, verification, reproduction steps |
| `reports/chain-report.md` | Human-readable storage/timing report (if available) |
| `manifest.json` | Machine-readable inventory of all artifacts |
| `verification-summary.json` | Verification status, expected hashes, instructions |

### Verification

| File | Description |
|------|-------------|
| `checksums.sha256` | SHA-256 checksums for all included files |
| `seals/*.svg` | Visual proof seals (base, deltas, chain) |

---

## Verification

### Automatic Checksums

Verify file integrity:

```bash
cd output/bundles/vsc-bundle-21A8390BFA3F-to-954BEB0FF3AA
sha256sum -c checksums.sha256
```

### Manual Chain Verification

Restore and verify the chain:

```bash
# 1. Restore latest state
npm run vsc -- restore chain-token.json

# 2. Verify root hash match
npm run vsc -- verify chain-token.json output/chain-21A8390BFA3F-to-954BEB0FF3AA/restored-test-wp
```

Expected result: **Root hash match: YES**

---

## Manifest Format

The `manifest.json` provides machine-readable bundle metadata:

```json
{
  "bundle_name": "vsc-bundle-21A8390BFA3F-to-954BEB0FF3AA",
  "bundle_version": "1.0",
  "created_at": "2026-06-16T00:00:00.000Z",
  "vsc_version": "v1.14",
  "chain": {
    "token_id": "vsc-chain-21A8390BFA3F-to-954BEB0FF3AA",
    "base_token_id": "21A8390BFA3F",
    "latest_token_id": "954BEB0FF3AA",
    "delta_count": 2,
    "chain_hash_prefix": "a1b2c3d4e5f6..."
  },
  "base": {
    "token_id": "21A8390BFA3F",
    "bundle_file": "base-token.json"
  },
  "deltas": [
    { "index": 1, "token_id": "F3876A4BCFE1", "bundle_file": "delta-tokens/delta-1.json" }
  ],
  "seals": [
    { "type": "base", "token_id": "21A8390BFA3F", "bundle_file": "seals/base.svg" }
  ],
  "warnings": [],
  "limitations": [
    "Recovery chunks not included (can be regenerated)",
    "Research prototype — not enterprise software"
  ]
}
```

---

## What's Included vs Excluded

### Included

- ✅ Chain token (complete delta chain)
- ✅ Base token (initial state)
- ✅ Delta tokens (ordered steps)
- ✅ Chain report (if available)
- ✅ SVG seals (base, deltas, chain)
- ✅ Verification summary
- ✅ Complete manifest
- ✅ SHA-256 checksums

### Excluded (by design)

- ❌ Recovery chunk folders (`output/recovery-*`) — can be regenerated from tokens
- ❌ Restored state folders (`output/chain-*/restored-*`) — can be regenerated via restore
- ❌ Benchmark fixture folders (`test-benchmark/`, `test-json-benchmark/`)
- ❌ Heavy binary files (PDFs, unless explicitly lightweight)
- ❌ `node_modules/`
- ❌ Source code

---

## Safety & Limitations

### Research Prototype

This is **research prototype software**, not enterprise production infrastructure:

- No streaming ingestion (v2 roadmap)
- No WAL (v2 roadmap)
- No Go implementation (future)
- No API server
- No enterprise guarantees

### Bundle Limitations

| Aspect | Limitation |
|--------|------------|
| Recovery | Chunk folders must be regenerated from tokens |
| Restore | State must be restored manually for verification |
| Size | Very large chains may require significant disk space |
| Verify | Manual verification required for full proof |

### Security Notes

- Checksums verify file integrity, not authenticity
- Verify the source of the bundle independently
- For high-stakes proof, run your own verification
- Checksums can be recomputed: `sha256sum -c checksums.sha256`

---

## Use Cases

### Partner Sharing

Share a verified state change with a partner:

```bash
npm run vsc -- bundle output/vsc-chain-ABC123-to-DEF456.json
tar czf proof-bundle.tar.gz output/bundles/vsc-bundle-ABC123-to-DEF456/
# Send proof-bundle.tar.gz to partner
```

### Audit Trail

Create verifiable evidence for compliance:

```bash
# After each significant state change
npm run vsc -- bundle output/vsc-chain-$(date +%Y%m%d)-*.json
# Store bundle in audit archive
```

### Research & Publication

Package reproducible proof artifacts:

```bash
npm run vsc -- bundle output/vsc-chain-EXPERIMENT-*.json
cp -r output/bundles/vsc-bundle-EXPERIMENT-* ./paper/artifacts/
```

---

## Reproduction

To reproduce a bundle from scratch:

```bash
# 1. Create base snapshot
npm run vsc -- backup test-wp

# 2. Create deltas
npm run vsc -- delta output/vsc-21A8390BFA3F-folder-recovery.json test-wp-v2

# 3. Build chain
npm run vsc -- chain output/vsc-21A8390BFA3F-folder-recovery.json output/vsc-21A8390BFA3F-to-*.json

# 4. Export bundle
npm run vsc -- bundle output/vsc-chain-21A8390BFA3F-to-*.json
```

---

## Related Documentation

- [VSC v1.13 JSON Event Benchmark](vsc-v1-13-json-event-benchmark.md) — Structured event log benchmark
- [VSC v1.12 Benchmark Mode](vsc-v1-12-benchmark-mode.md) — Folder/file benchmark
- [VSC v2 Architecture Notes](vsc-v2-architecture-notes.md) — Future design
- [WordPress MVP Demo](wordpress-mvp-demo.md) — Stable public demo

---

*VSC v1.14 — Portable proof for verifiable state commitments*
