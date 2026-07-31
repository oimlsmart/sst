# TODO 06 — Catalog bake from R 60 SSOT (Phase 7)

**Priority:** P2   **Status:** ✅ done   **Blocks:** nothing   **Blocked by:** TODO 02

## Goal

Replace the bench's hand-authored `src/lib/catalog.ts` (a curated list
of manufacturers / models / samples) with a baked artifact derived from
the R 60 SSOT at `smart/data/r60/sample-data.yaml`. The bake runs at
build time; the runtime reads the baked JSON. This makes the
InstrumentChooser's catalog authoritative — SSOT changes propagate on
the next bake, no manual edits.

## Deliverables

### Bake script

- `packages/instances/acme-lc500/scripts/bake-catalog.ts` — reads
  `smart/data/r60/sample-data.yaml`, transforms it into the catalog
  shape, writes `packages/instances/acme-lc500/catalog.json`.
- The bake maps the SSOT hierarchy
  (`manufacturer → family → group → model → sample`) to the bench's
  (`Manufacturer[] → Model[] → Sample[]`) — many-to-one where the SSOT
  is richer than the bench needs.
- Sample characteristics (`fresh`, `aged`, `dropped`, `corroded`) are
  derived from the SSOT's `custody_events` + `test_history` (e.g. a
  sample with a "dropped" custody event gets `damageKind: dropped`).

### Bake-freshness CI job

- New job in `.github/workflows/ci.yml` (alongside the existing
  `bake-freshness` for twin contracts): re-bake from the SSOT, diff
  against the committed `catalog.json`, fail if stale.
- Skip-guarded when the smart checkout isn't present (same pattern as
  the existing `bake-freshness`).

### Runtime loader

- The runtime's package-loader reads `catalog.json` from the instance
  package (if present) and exposes it via `LoadedPackage.catalog`.
- The shell's instance-gallery card uses this for the sample picker.
- The bench's `InstrumentChooser.vue` reads the catalog from the
  session's runtime URL.

## Steps

1. Author the bake script — parse SSOT YAML, project to catalog shape,
   write JSON.
2. Run it for ACME LC-500 → commit `catalog.json`.
3. Update `InstrumentChooser.vue` to read `catalog.json` (via the
   runtime) instead of `src/lib/catalog.ts`.
4. Add the CI job; skip-guard it.
5. Mark `src/lib/catalog.ts` as deprecated; remove once all callers
   migrated.

## Acceptance criteria

- `npm run bake-catalog -w acme-lc500` regenerates `catalog.json`.
- `git diff` after a re-bake is empty (the SSOT didn't change).
- The InstrumentChooser shows the same set of manufacturers / models /
  samples as today (no regression).
- A hypothetical new sample added to the SSOT appears in the chooser
  after a re-bake + reload.
- The CI job catches drift (a forced SSOT edit produces a non-empty
  diff and fails the job).

## Design notes

- **Bake-time coupling is fine.** The smart checkout is a sibling
  directory; the bake script reads from a known path. Runtime stays
  decoupled (reads JSON only).
- **The catalog is per-instance.** Each instance package ships its own
  `catalog.json` covering the samples it actually supports. A future
  instance (e.g. HBK HLCi) has its own catalog.
- **Damage-kind derivation.** The SSOT carries custody events; the bake
  script maps them to damageKind enum values. Document the mapping in
  the bake script's header.

## Dependencies

- Requires TODO 02 (runtime) for the LoadedPackage shape.
- Pairs with TODO 07 (siblings) — each new instance family needs its
  own bake script.
