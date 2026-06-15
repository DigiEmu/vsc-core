# VSC v1.10 — Static Showcase Export

## Purpose

VSC v1.10 adds a static showcase export command. The result is a portable, self-contained folder (`showcase/`) that communicates the VSC proof flow visually and technically without requiring a visitor to run the CLI. It opens in any browser with no server.

---

## Command

```
npm run vsc -- demo:run
npm run vsc -- showcase
```

`demo:run` must run first to generate the token artifacts. `showcase` then exports them into `showcase/`.

---

## What Gets Exported

| File | Content |
|------|---------|
| `showcase/index.html` | Landing page — metrics, seal gallery, verification summary, commands |
| `showcase/assets/seals/base.svg` | Base snapshot (FOLDER_RECOVERY) token seal |
| `showcase/assets/seals/delta1.svg` | Delta 1 (FOLDER_DELTA) token seal |
| `showcase/assets/seals/delta2.svg` | Delta 2 (FOLDER_DELTA) token seal |
| `showcase/assets/seals/chain.svg` | Delta chain (DELTA_CHAIN) token seal |
| `showcase/assets/reports/chain-report.md` | Chain storage metrics report |
| `showcase/assets/gallery/gallery.html` | Full token gallery |
| `showcase/README.md` | Showcase description and publishing guide |

The `index.html` is self-contained: inline CSS, no external scripts, no web fonts loaded remotely. SVG seals are referenced as relative paths.

---

## What Is Excluded

- `output/recovery-*/` — recovery chunk folders (large, not needed for viewing)
- `output/delta-*/` and `output/chain-*/` — restored state folders
- Token JSON payloads (large, contain full chunk indices)
- `test-wp/` — local demo fixture
- PDF-derived token SVGs (448 KB each)
- No node_modules, no .env files

---

## Publishing Options

**GitHub Pages:**
1. Commit `showcase/` to the repository.
2. Enable GitHub Pages from `main` branch, root or `showcase/` folder.
3. The showcase will be available at `https://digiemu.github.io/vsc-core/`.

**Netlify Drop:**
1. Run `npm run vsc -- showcase`.
2. Drag the `showcase/` folder to [netlify.com/drop](https://app.netlify.com/drop).

**Any static host:**
Upload `showcase/` contents. No server configuration needed.

---

## Regeneration

After making changes to token output or docs:

```
npm run vsc -- showcase
```

The export always cleans and rebuilds `showcase/` entirely. It never touches `output/`.

---

## Artifact Fallback

If the known WordPress demo files (21A8390BFA3F chain) are not found in `output/`, the exporter:
1. Scans `output/manifest.json` for the latest matching entries by mode.
2. Falls back to known metric values for the index.html if the chain report is not parseable.
3. Prints a clear error and exits non-zero if essential seals are missing, with instructions to run `demo:run` first.

---

## Current Limits

- The showcase uses the known WordPress demo token IDs in the HTML labels. If you run `demo:run` from a different fixture, the SVG seals will be fresh but the HTML labels will still reference the original IDs. This is cosmetic only.
- No server-side rendering. All content is static.
- No search or interactive filtering — that is the gallery's job.
