# VSC v1.7 Release Note

## Version

**VSC v1.7 — Visual State Grammar**

---

## What Works

- Folder base snapshots (chunked, root-hashed)
- Folder restore from base snapshot
- Folder verification by root hash
- Folder deltas (file-level add / modify / delete)
- Delta-on-delta (delta applied on top of another delta's target)
- Delta chains (ordered base + N deltas)
- Chain restore (reconstruct latest state from chain)
- Chain verification (verify reconstructed state by root hash)
- Chain report (storage metrics vs full-copy baseline)
- Static token gallery (`output/gallery.html`) with card-level detail
- Human-readable SVG seal grammar (FOLDER, DELTA, CHAIN, RECOVERY, PROOF)
- `verify-all` — batch verification across all manifest entries

---

## WordPress Demo Result

WordPress-style base snapshot at 1.58 MB. Two changes stored as ordered deltas totaling 641 B. Latest state reconstructed from base + 2 deltas. Chain verification returned **PASS**. Total storage vs 3 naive full copies: 1.58 MB vs 4.75 MB (66.65% reduction).

See [wordpress-mvp-demo.md](wordpress-mvp-demo.md) for full details.

---

## Verification Status

```
verify-all: PASS: 3 / PROOF-ONLY: 12 / FAIL: 0
```

PASS = cryptographic hash verification passed.  
PROOF-ONLY = token is proof-only (no recoverable chunks to verify); hash proof stored.  
FAIL = 0.

---

## Visual Seal Grammar

The SVG seal language was redesigned in v1.7 to make token type and state relationship readable at thumbnail size:

- DELTA seal: split BASE (dashed left arc) / TARGET (solid right arc), Δ core, op nodes on delta ring
- CHAIN seal: left-rail timeline spine, three differentiated node types, `■ LATEST VERIFIED STATE` callout
- Generic seals: type-specific core symbol (`⊞` / `▣` / `◌`), reduced ring noise

See [vsc-visual-token-language.md](vsc-visual-token-language.md) for the full grammar.

---

## Status

**Research prototype / MVP proof-of-concept. Not production-ready.**

This version demonstrates the core VSC model (base + ordered deltas + root-hash verification + restore) on a local filesystem with a WordPress-style test dataset. No production server, authentication, distributed storage, or API exists yet.
