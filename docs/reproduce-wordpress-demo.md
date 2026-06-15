# Reproducing the WordPress MVP Demo

This document explains how to reproduce the VSC WordPress-style backup demo from a clean clone. All steps use `npm` scripts only.

---

## Prerequisites

- Node.js 18+ (ESM support required)
- Clone of this repository
- Run `npm install` if you have not already

```
npm install
```

---

## Step 1 — Create the demo fixture

The `test-wp/` folder is excluded from git. Generate it:

```
npm run demo:fixture
```

This creates a WordPress-style folder structure under `test-wp/` including:
- `index.php`, `readme.html`, `wp-config.php`
- `database.sql` (small simulated database export)
- `wp-content/plugins/vsc-demo-plugin/vsc-demo-plugin.php`
- `wp-content/uploads/2026/06/vsc-demo-upload.txt`
- `wp-includes/functions.php`
- `wp-content/themes/aikido-class/` (copied from local source, or minimal fallback)

---

## Step 2 — Create the base snapshot

```
npm run encode-folder test-wp
```

This creates a `FOLDER_RECOVERY` token for the current state of `test-wp/`.

**Example output** (your token ID will differ):
```
Token ID: 21A8390BFA3F
Saved: output/vsc-21A8390BFA3F-folder-recovery.json
Saved: output/vsc-21A8390BFA3F-folder-recovery.svg
```

Note the token ID — you will use it in later commands.

---

## Step 3 — Simulate change 1: modify database.sql

Edit `test-wp/database.sql`. For example, add a row:

```sql
INSERT INTO wp_options VALUES (3, 'admin_email', 'demo@vsc.local');
```

---

## Step 4 — Create delta 1

```
npm run encode-folder-delta output\vsc-<BASE_TOKEN>-folder-recovery.json test-wp
```

Replace `<BASE_TOKEN>` with the token ID from Step 2.

**Example output:**
```
Token ID: F3876A4BCFE1
Delta: 1 modified file (database.sql), 376 B
Saved: output/vsc-<BASE>-to-F3876A4BCFE1-folder-delta.json
```

---

## Step 5 — Simulate change 2: modify the plugin file

Edit `test-wp/wp-content/plugins/vsc-demo-plugin/vsc-demo-plugin.php`. For example, bump the version comment:

```php
 * Version:     1.1
```

---

## Step 6 — Create delta 2

```
npm run encode-folder-delta output\vsc-<DELTA1_TOKEN>-folder-delta.json test-wp
```

Replace `<DELTA1_TOKEN>` with the token ID from Step 4.

**Example output:**
```
Token ID: 954BEB0FF3AA
Delta: 1 modified file (vsc-demo-plugin.php), 265 B
Saved: output/vsc-<D1>-to-954BEB0FF3AA-folder-delta.json
```

---

## Step 7 — Build the delta chain

```
npm run create-chain output\vsc-<BASE>-folder-recovery.json output\vsc-<BASE>-to-<D1>-folder-delta.json output\vsc-<D1>-to-<D2>-folder-delta.json
```

**Example output:**
```
Chain ID: DDE0844718A5
Steps: 2
Saved: output/vsc-chain-<BASE>-to-<D2>.json
Saved: output/vsc-chain-<BASE>-to-<D2>.svg
```

---

## Step 8 — Report chain storage metrics

```
npm run report-chain output\vsc-chain-<BASE>-to-<D2>.json
```

**Example output:**
```
Base:              1.58 MB
Delta total:       641 B
Full-copy (3×):    4.75 MB
VSC storage:       1.58 MB
Saved:             3.17 MB  (66.65%)
Delta-only reduction: 99.96%
```

---

## Step 9 — Restore latest state

```
npm run restore-chain output\vsc-chain-<BASE>-to-<D2>.json
```

The restored folder is written to `output/chain-<BASE>-to-<D2>/restored-<folder>/`.

---

## Step 10 — Verify restored state

```
npm run verify-chain output\vsc-chain-<BASE>-to-<D2>.json output\chain-<BASE>-to-<D2>\restored-test-wp
```

Expected result: **PASS** — reconstructed root hash matches expected latest root hash.

---

## Step 11 — Verify all tokens

```
npm run verify-all
```

Expected: `FAIL: 0`

---

## Step 12 — Open gallery

```
start output\gallery.html
```

---

## Known demo result (original run)

The following token IDs and metrics are from the original demo run and are provided as reference only. Your token IDs will differ because they are derived from your file content hashes.

| Item | Value |
|------|-------|
| Base token | `21A8390BFA3F` |
| Delta 1 token | `F3876A4BCFE1` |
| Delta 2 token | `954BEB0FF3AA` |
| Chain token | `DDE0844718A5` |
| Base size | 1.58 MB |
| Delta 1 | 376 B |
| Delta 2 | 265 B |
| Total delta | 641 B |
| Full-copy baseline | 4.75 MB |
| VSC storage | 1.58 MB |
| Saved | 3.17 MB (66.65%) |
| verify-all | PASS: 3 / PROOF-ONLY: 12 / FAIL: 0 |
