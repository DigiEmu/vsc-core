# VSC — Versioned State Commit

**v1.7 — Visual State Grammar**

Research prototype / proof-of-concept. Not production-ready.

---

## Core Concept

VSC is a base + delta + proof + recovery model for folder and file state:

```
T = (B, Δ, P, R)

B = base snapshot     — full state, chunked and root-hashed
Δ = ordered deltas    — only the files that changed
P = proof             — root hash / chain hash for verification
R = recovery          — rules for reconstructing state from base + deltas
```

Store a full state once. Store only what changes. Verify by root hash. Restore from base + ordered deltas.

---

## WordPress MVP Demo

A WordPress-style folder was backed up once (1.58 MB base), then two later changes were captured as ordered deltas (641 B total). The latest state was reconstructed and verified.

| Strategy | Storage |
|----------|---------|
| Traditional full-copy (3×) | 4.75 MB |
| VSC (base + 2 deltas) | 1.58 MB |
| Saved | 3.17 MB (66.65%) |

`verify-all` result: **PASS: 3 / PROOF-ONLY: 12 / FAIL: 0**

→ [Full demo details](docs/wordpress-mvp-demo.md)

---

## Visual Token Language

VSC tokens are rendered as SVG seals. Each token type has a distinct visual identity:

| Token | Core symbol | Reading |
|-------|-------------|---------|
| FOLDER | `⊞ BASE SNAPSHOT` | Stable complete state |
| DELTA | `Δ CHANGED FILES` | Changed subset, BASE → TARGET |
| CHAIN | `N DELTA STEPS` | Ordered progression, latest verified |
| RECOVERY | `▣ RECOVERABLE` | Dense chunked payload |
| PROOF | `◌ SPARSE PROOF` | Lightweight deterministic proof |

→ [Full visual grammar](docs/vsc-visual-token-language.md)

---

## Current Status

**What works:**
- Folder base snapshots, restore, verification
- Folder deltas (file-level add / modify / delete)
- Delta-on-delta and delta chains
- Chain restore and chain verification
- Chain storage report
- Static token gallery with SVG seal previews
- `verify-all` batch verification

**Not yet built:**
- API layer
- Distributed object storage
- Authentication / tenant model
- Production hardening

---

## CLI Commands

```bash
# Encode folder base
npm run encode-folder <folder>

# Encode folder delta
npm run encode-folder-delta <base-token.json> <folder>

# Build delta chain
npm run create-chain <base.json> <delta1.json> [delta2.json ...]

# Restore latest state from chain
npm run restore-chain <chain.json>

# Verify restored state
npm run verify-chain <chain.json> <restored-folder>

# Storage report
npm run report-chain <chain.json>

# Verify all tokens
npm run verify-all

# Clean manifest
npm run clean-manifest

# Open gallery
start output\gallery.html
```

---

## VSC v1.9 One-command Demo

VSC v1.9 adds a complete reproducible demo command. One command runs the full WordPress-style base + delta + chain + restore + verify flow:

```bash
npm run vsc -- demo:run
```

No manual token ID replacement. No placeholder values. The runner discovers generated paths from the manifest and prints a final summary with `DEMO RESULT: PASS`.

→ [Full demo documentation](docs/vsc-v1-9-one-command-demo.md)

---

## VSC v1.8 CLI

VSC v1.8 introduces a simplified CLI wrapper. The old scripts remain available and unchanged.

```bash
npm run vsc -- help          # command overview
npm run vsc -- demo          # create demo fixture
npm run vsc -- backup test-wp
npm run vsc -- delta output\vsc-<BASE>-folder-recovery.json test-wp
npm run vsc -- chain <base> <delta1> <delta2>
npm run vsc -- restore output\vsc-chain-<BASE>-to-<D2>.json
npm run vsc -- verify  output\vsc-chain-<BASE>-to-<D2>.json output\chain-<BASE>-to-<D2>\restored-test-wp
npm run vsc -- report  output\vsc-chain-<BASE>-to-<D2>.json
npm run vsc -- verify-all
npm run vsc -- gallery
```

→ [Full CLI documentation](docs/vsc-v1-8-cli.md)

---

## Repository / Demo Notes

This repository is a research prototype / MVP. The following conventions apply:

- Generated recovery chunk folders (`output/recovery-*/`) are excluded from git — they can be large and are always reproducible locally.
- The `test-wp/` fixture folder is excluded from git. Recreate it with `npm run demo:fixture`.
- Token JSON and SVG files in `output/` are lightweight and may be committed as reference artifacts.
- See [docs/demo-artifact-policy.md](docs/demo-artifact-policy.md) for the full artifact commit policy.
- See [docs/reproduce-wordpress-demo.md](docs/reproduce-wordpress-demo.md) to reproduce the full demo from a clean clone.

```
npm run demo:fixture       # create or reset test-wp/ demo fixture
npm run encode-folder      # encode a folder as a base snapshot
npm run encode-folder-delta # encode a folder delta
npm run create-chain       # build a delta chain
npm run report-chain       # storage metrics report
npm run restore-chain      # restore latest state from chain
npm run verify-chain       # verify restored state
npm run verify-all         # verify all registered tokens
npm run clean-manifest     # remove stale manifest entries
```

---

## Documentation

- [VSC Visual Token Language](docs/vsc-visual-token-language.md)
- [WordPress MVP Demo](docs/wordpress-mvp-demo.md)
- [VSC MVP Architecture](docs/vsc-mvp-architecture.md)
- [VSC v1.7 Release Note](docs/vsc-v1-7-release-note.md)
- [Demo Artifact Policy](docs/demo-artifact-policy.md)
- [Reproduce WordPress Demo](docs/reproduce-wordpress-demo.md)
- [VSC v1.8 CLI](docs/vsc-v1-8-cli.md)
- [VSC v1.9 One-command Demo](docs/vsc-v1-9-one-command-demo.md)
