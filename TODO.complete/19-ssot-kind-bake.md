# TODO 19 — SSOT-driven kind generation

**Priority:** P1   **Status:** ✅ done

## Goal

The kind packages are hand-authored YAML. When the OIML SSOT changes, they must be manually updated. This TODO adds a bake step that reads `smart/data/r60/` and generates the kind's `classification.yaml`, `mpe.yaml`, `parameters.yaml` from the authoritative source.

## Deliverables

- `packages/kinds/sst-r60/scripts/bake-from-ssot.ts` — reads the R 60 SSOT, generates the kind's data files
- CI `bake-kind-freshness` job (skip-guarded like the existing twin-contract bake)
- The generated files are committed (decoupled at runtime; authoritative at build)

## Acceptance criteria

- `npx tsx scripts/bake-from-ssot.ts` regenerates the kind's YAML from the SSOT
- `git diff` after a re-bake is empty (no drift)
- The MPE formulas in `mpe.yaml` match the SSOT's `specification/formulas.yaml`
