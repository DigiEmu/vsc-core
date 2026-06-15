# VSC WordPress MVP Demo

## Demo Summary

A WordPress-style folder (`test-wp/`) was backed up once as a base snapshot. Two later changes — one to the database export, one to a plugin file — were captured as ordered delta tokens. The three tokens were assembled into a delta chain, and the latest folder state was reconstructed from base + deltas and verified by root hash.

This demonstrates the core VSC claim: store a full state once, then store only what changed.

---

## Token Flow

```
21A8390BFA3F  ← Base snapshot (full WordPress-style folder, 1.58 MB)
  ↓ Delta 1: database.sql changed
F3876A4BCFE1  ← Delta token (376 B stored)
  ↓ Delta 2: vsc-demo-plugin.php changed
954BEB0FF3AA  ← Delta token (265 B stored)

Chain: DDE0844718A5  ← Ordered chain of base + 2 deltas
```

---

## Storage Report

| Metric | Value |
|--------|-------|
| Base size | 1.58 MB |
| Delta 1 | 376 B |
| Delta 2 | 265 B |
| Total delta size | 641 B |
| Traditional full-copy size (3× snapshots) | 4.75 MB |
| VSC storage size (base + deltas) | 1.58 MB |
| Saved | 3.17 MB |
| Total chain reduction vs full-copy | 66.65% |
| Delta-only reduction | 99.96% |

> The delta-only reduction (99.96%) reflects that only 641 B of actual changes were stored across two versions. The total chain reduction (66.65%) reflects VSC vs a naive 3-snapshot full-copy strategy.

---

## Changed Files

- `database.sql` — Delta 1
- `wp-content/plugins/vsc-demo-plugin/vsc-demo-plugin.php` — Delta 2

---

## Verification

The latest reconstructed folder root hash matched the expected target root hash stored in the chain token. `verify-chain` returned **PASS**. `verify-all` returned **FAIL: 0**.

---

## Commands

**Build the chain:**
```
npm run create-chain output\vsc-21A8390BFA3F-folder-recovery.json output\vsc-21A8390BFA3F-to-F3876A4BCFE1-folder-delta.json output\vsc-F3876A4BCFE1-to-954BEB0FF3AA-folder-delta.json
```

**Report storage metrics:**
```
npm run report-chain output\vsc-chain-21A8390BFA3F-to-954BEB0FF3AA.json
```

**Restore latest state:**
```
npm run restore-chain output\vsc-chain-21A8390BFA3F-to-954BEB0FF3AA.json
```

**Verify restored state:**
```
npm run verify-chain output\vsc-chain-21A8390BFA3F-to-954BEB0FF3AA.json output\chain-21A8390BFA3F-to-954BEB0FF3AA\restored-test-wp
```

**Verify all tokens:**
```
npm run verify-all
```

---

## Claim

VSC stores a full WordPress-style state once, then stores only ordered, verifiable deltas. The latest state can be reconstructed from base + deltas and verified by root hash. This is a local proof-of-concept. It does not involve a production server, API, or database.
