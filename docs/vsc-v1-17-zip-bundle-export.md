# VSC v1.17 — ZIP Bundle Export

**Release Date:** v1.17  
**Status:** Research prototype / proof-of-concept

---

## Overview

VSC v1.17 adds **ZIP Bundle Export** — a command to package an existing evidence bundle directory into a shareable ZIP archive without modifying the source bundle.

This feature completes the bundle lifecycle:
- **v1.14** — Export evidence bundles
- **v1.15** — Export JSON event evidence bundles
- **v1.16** — Verify exported bundles
- **v1.17** — Package bundles into ZIP archives (this release)

---

## Command

```bash
npm run vsc -- zip-bundle <bundle-folder>
```

### Examples

```bash
# ZIP a generic evidence bundle
npm run vsc -- zip-bundle output\bundles\vsc-bundle-21A8390BFA3F-to-954BEB0FF3AA

# ZIP a JSON event evidence bundle
npm run vsc -- zip-bundle output\json-event-bundles\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13

# ZIP with relative path
npm run vsc -- zip-bundle .\output\bundles\vsc-bundle-21A8390BFA3F-to-954BEB0FF3AA
```

---

## What It Does

1. **Validates input** — Checks the bundle folder exists and is a directory
2. **Counts files** — Calculates the number of files to be included
3. **Creates output directory** — Ensures `output/zips/` exists
4. **Creates ZIP archive** — Uses `archiver` package with maximum compression
5. **Preserves structure** — The bundle directory becomes the root inside the ZIP
6. **Reports results** — Prints ZIP path, file count, and size

---

## Expected Output

### Successful Export

```
╔════════════════════════════════════════════════════════════╗
║   VSC v1.17 — ZIP Bundle Export                            ║
╚════════════════════════════════════════════════════════════╝

Bundle path: C:\Users\...\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13
Files to include: 108

╔════════════════════════════════════════════════════════════╗
║   ZIP EXPORT COMPLETE                                      ║
╚════════════════════════════════════════════════════════════╝

  ZIP path:        output\zips\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13.zip
  Files included:  108
  ZIP size:        245.6 KB
  Source bundle:   C:\Users\...\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13

  Result:          PASS

✓ ZIP bundle created successfully.

Next steps:
  1. Inspect:      cd output\zips\
  2. Extract:      unzip vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13.zip
  3. Share:        Distribute the ZIP file
```

### Failed Export

```
✗ Bundle not found: output\does-not-exist
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | ZIP export successful |
| `1` | Export failed — bundle not found, not a directory, or archive error |

---

## Output Location

ZIP files are created in:
```
output/zips/<bundle-name>.zip
```

For example:
- Bundle: `output/bundles/vsc-bundle-ABC-to-XYZ/`
- ZIP: `output/zips/vsc-bundle-ABC-to-XYZ.zip`

---

## ZIP Structure

The ZIP archive contains the bundle directory as its root:

```
vsc-bundle-21A8390BFA3F-to-954BEB0FF3AA.zip
└── vsc-bundle-21A8390BFA3F-to-954BEB0FF3AA/
    ├── README.md
    ├── manifest.json
    ├── chain-token.json
    ├── base-token.json
    ├── verification-summary.json
    ├── checksums.sha256
    ├── delta-tokens/
    │   ├── delta-1.json
    │   └── delta-2.json
    ├── reports/
    │   └── chain-report.md
    └── seals/
        ├── base.svg
        ├── chain.svg
        └── delta-1.svg
```

---

## Use Cases

### Email Distribution

Share bundles as single-file attachments:

```bash
npm run vsc -- bundle:json
npm run vsc -- zip-bundle output\json-event-bundles\vsc-json-event-bundle-*
# Attach output\zips\vsc-json-event-bundle-*.zip to email
```

### Archive Storage

Compress bundles for long-term storage:

```bash
# Create dated archive
npm run vsc -- zip-bundle output\bundles\vsc-bundle-ABC-to-XYZ
mv output\zips\vsc-bundle-ABC-to-XYZ.zip archives\vsc-bundle-$(date +%Y%m%d).zip
```

### Distribution Packaging

Prepare bundles for download/release:

```bash
# CI/CD pipeline
npm run vsc -- bundle:json
npm run vsc -- verify-bundle output\json-event-bundles\vsc-json-event-bundle-* || exit 1
npm run vsc -- zip-bundle output\json-event-bundles\vsc-json-event-bundle-*
# Upload output/zips/*.zip as release artifact
```

---

## No Mutation Guarantee

The `zip-bundle` command does **not** modify the source bundle:

- ✅ Reads files from the bundle directory
- ✅ Creates new ZIP file in `output/zips/`
- ✅ Leaves source bundle unchanged

It does **not**:
- ❌ Modify any files in the source bundle
- ❌ Update `manifest.json`
- ❌ Rewrite `checksums.sha256`
- ❌ Change any token files

---

## Dependencies

This feature uses the `archiver` npm package:

```json
"archiver": "^7.0.0"
```

Archiver is a popular, well-maintained library for creating ZIP archives in Node.js.

---

## Git Safety

ZIP files in `output/zips/` are excluded from Git by default (via `.gitignore`).

Do not commit generated ZIP files — they can be regenerated from the source bundles.

---

## Verification Checklist

When reviewing this feature:

- [ ] Run `npm run vsc -- bundle:json` to create a bundle
- [ ] Run `npm run vsc -- zip-bundle <path>` on the exported bundle
- [ ] Confirm output shows `Result: PASS`
- [ ] Confirm ZIP file exists in `output/zips/`
- [ ] Extract the ZIP and verify bundle structure is preserved
- [ ] Run `npm run vsc -- verify-bundle <extracted-path>` and confirm `Result: PASS`
- [ ] Confirm the source bundle was not modified (checksums still valid)
- [ ] Run `npm run vsc -- verify-all` and confirm `FAIL: 0`
- [ ] Confirm no generated ZIP files were committed

---

## Limitations

- **Single bundle per ZIP** — Each ZIP contains one bundle directory
- **Maximum compression** — Uses zlib level 9 (slower but smaller)
- **Windows paths** — Primary testing on Windows; Unix paths should work
- **No encryption** — ZIP files are not password-protected
- **No streaming** — Entire archive created in memory before writing
- **Research prototype** — Not enterprise-hardened archival software

---

## Relationship to Other Commands

| Command | Purpose | Creates ZIP? | Mutates source? |
|---------|---------|------------|-----------------|
| `bundle` | Export generic evidence bundle | ❌ No | ❌ No |
| `bundle:json` | Export JSON event evidence bundle | ❌ No | ❌ No |
| `verify-bundle` | Verify exported bundle | ❌ No | ❌ No |
| `zip-bundle` | Package bundle into ZIP | ✅ Yes | ❌ No |

---

## See Also

- [VSC v1.16 — Evidence Bundle Verification](vsc-v1-16-verify-evidence-bundle.md)
- [VSC v1.15 — JSON Event Evidence Bundle](vsc-v1-15-json-event-evidence-bundle.md)
- [VSC v1.14 — Evidence Bundle Export](vsc-v1-14-evidence-bundle-export.md)

---

*VSC v1.17 — ZIP Bundle Export*
