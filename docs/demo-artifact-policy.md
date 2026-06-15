# Demo Artifact Policy

This document explains which generated artifacts belong in the repository and which should remain local-only.

---

## Always commit

| Path | Reason |
|------|--------|
| `src/` | Source code |
| `docs/` | Documentation |
| `scripts/` | Demo fixture and utility scripts |
| `README.md` | Project overview |
| `package.json` | Dependency and script manifest |
| `.gitignore` | Repository hygiene |

---

## Optionally commit (lightweight demo artifacts)

These are small enough to be useful as reference outputs. Commit them if they help reviewers understand the system without running it locally.

| Path | Size approx. | Reason to commit |
|------|-------------|-----------------|
| `output/manifest.json` | ~9 KB | Describes all registered tokens |
| `output/gallery.html` | ~48 KB | Static visual gallery of all tokens |
| `output/vsc-chain-21A8390BFA3F-to-954BEB0FF3AA.json` | ~2 KB | WordPress demo chain token |
| `output/vsc-chain-21A8390BFA3F-to-954BEB0FF3AA.svg` | ~13 KB | Chain seal SVG |
| `output/vsc-21A8390BFA3F-to-F3876A4BCFE1-folder-delta.json` | ~2 KB | Delta 1 token |
| `output/vsc-F3876A4BCFE1-to-954BEB0FF3AA-folder-delta.json` | ~2 KB | Delta 2 token |
| `output/vsc-*.svg` (small seals) | ~10–35 KB each | Seal previews for gallery |

> Exclude `output/vsc-D26E503DB51F-pdf*.json` and `output/vsc-D26E503DB51F-pdf*.svg` — these are large (400+ KB) and not needed for the WordPress demo.

---

## Never commit

| Pattern | Reason |
|---------|--------|
| `output/recovery-*/` | Recovery chunk folders — can be hundreds of MB |
| `output/delta-*/` | Restored delta working directories |
| `output/chain-*/` | Restored chain working directories |
| `output/manifest.backup-*.json` | Auto-generated backups from clean-manifest |
| `output/*.tmp` / `output/*.bak` | Temporary files |
| `test-wp/` | Local demo fixture — reproducible via `npm run demo:fixture` |
| `node_modules/` | Standard dependency exclusion |
| `*.pdf` | Source PDF files used during development (large, not public) |
| `aikido-class/**/node_modules/` | Theme build dependencies |

---

## Rationale

The recovery chunk folders (`output/recovery-*/`) are the largest risk. A single base snapshot of a 1.58 MB folder produces ~447 chunks. These are generated locally and are always reproducible from the source folder. Committing them would bloat the repository without adding value.

The `test-wp/` fixture is intentionally excluded because it contains a local WordPress-style state that varies by machine. Use `npm run demo:fixture` to regenerate it deterministically from the script.

Token JSON files and SVG seals are lightweight and useful as reference, but the PDF-derived tokens (`D26E503DB51F`) are too large for a clean public repository.

---

## Reproducing the full demo from scratch

See [reproduce-wordpress-demo.md](reproduce-wordpress-demo.md).
