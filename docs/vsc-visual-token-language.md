# VSC Visual Token Language

## Purpose

Every VSC token exists in two forms: a **machine-readable JSON payload** (hashes, chunks, delta operations) and a **human-readable SVG seal** that summarises the token's role and state at a glance. The seal is not decorative — it encodes the token type, the relationship between states, and the verification identity of the token.

---

## Core Visual Grammar

| Symbol | Meaning |
|--------|---------|
| `⊞` | Base snapshot — stable, complete folder state |
| `Δ` | Changed files — nucleus of the delta operation |
| `○` | Base snapshot node on a chain timeline |
| `●` | Delta step node on a chain timeline |
| `■` | Latest verified state — dominant end node |
| `▣` | Recoverable payload — dense chunked binary object |
| `◌` | Sparse proof — lightweight deterministic proof token |

The outer ring is the boundary of the seal. The hash band just outside the ring encodes the payload hash as filled/open dots. The core circle encodes token type.

---

## FOLDER Seal

**Intent:** Foundation / base snapshot.

The outer ring is a single solid circle. The core shows `⊞ BASE SNAPSHOT`. Six quiet orientation markers provide compass points. The sparse delta field inside the rings represents the file chunk structure of the base. The hash band encodes the folder root hash.

Reading: *"This is a stable, complete state. Verify by root hash. No changes encoded."*

---

## DELTA Seal

**Intent:** Changed subset relative to a base.

The outer ring is **split into two arcs**:
- Left arc (dashed, grey) = **BASE** — the previous state
- Right arc (solid, black) = **TARGET** — the new state

The core shows `Δ CHANGED FILES`. A prominent dashed delta ring at ~70% radius carries the operation nodes. Each node is role-coded:
- `●` filled = MODIFY
- `○+` open with cross = ADD
- `○×` hatched = DELETE

A small direction arrow at the top of the ring points BASE → TARGET.

Reading: *"These specific files changed from base to target. Verify by target root hash."*

---

## CHAIN Seal

**Intent:** Ordered progression from base through deltas to latest verified state.

A **left-rail spine** runs vertically inside the seal. Nodes sit on the spine:
- `○ BASE` — open, smallest — base snapshot
- `● Δn` — grey fill, medium — each delta step
- `■ LATEST` — solid black, largest — latest verified state

The right side of the seal carries step annotations: `STEP n`, change counts, delta size, and token ID. A filled black band next to the latest node reads `LATEST VERIFIED STATE`.

The core circle shows the **step count** (`N DELTA STEPS`).

Reading: *"N ordered deltas were applied from base to latest. The latest state has been verified."*

---

## RECOVERY Seal

**Intent:** Recoverable chunked object.

The core shows `▣ RECOVERABLE`. The delta field is denser than a FOLDER seal, reflecting the binary chunk structure. The hash band encodes the payload hash for chunk-by-chunk recovery verification.

Reading: *"This payload is chunked and recoverable. Verify each chunk by hash."*

---

## PROOF Seals (TEXT / MELODY / ETHIC)

**Intent:** Sparse, deterministic proof of a small payload.

The core shows `◌ SPARSE PROOF`. The delta field is visibly sparse — few points, widely distributed — reflecting a small or structured payload. These tokens are lighter than recovery seals.

Reading: *"A small or structured payload was committed. Verify by payload hash."*

---

## Design Principle

> The seal should support understanding without replacing the machine proof.

The SVG seal conveys type, role, and state identity at a glance and at thumbnail size. It does not replace the JSON token. The authoritative verification is always the root hash or payload hash stored in the `proof` field of the token JSON.

The visual grammar is intentionally minimal and technical: monochrome, geometric, no colour coding that would break in print or grayscale.
