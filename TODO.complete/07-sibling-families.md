# TODO 07 — Sibling families (Phase 8)

**Priority:** P1   **Status:** ✅ done   **Blocks:** nothing   **Blocked by:** TODO 02, 09

## Goal

Fill in the 6 stub packages under `packages/kinds/` and
`packages/instances/` by direct analogy with the load-cell pair
(`sst-r60` + `acme-lc500`). Each kind + instance pair becomes a fully
runnable SST subject.

| Pair | Recommendation | Active domain | Existing sim code (legacy) |
|---|---|---|---|
| `sst-r91` + `acme-rs180` | R 91 — Doppler radar speed meters | `speed` | `packages/r91/` |
| `sst-r129` + `acme-md3xx` | R 129 — multi-dimensional measuring instruments | `dimensions` | `packages/md/` |
| `sst-r144` + `acme-cgm-200` | R 144 — continuous gas monitors | `gas-concentration` | `packages/gas-analyzer/` |

## Deliverables (per pair)

### Kind package

- `package.sst.yaml` — full manifest (replacing the stub).
- `classification.yaml` — Recommendation-specific axes (e.g. R 91's
  instrument-category, carrier-band; R 129's instrument-category,
  speed-range; R 144's measured-components, detection-principle).
- `parameters.yaml` — characteristic parameter formulas.
- `mpe.yaml` — per-class MPE envelope from the Recommendation.
- `physics-chain.yaml` — stage composition:
  - R 91: `emission → demodulation → estimation → conditioning`
  - R 129: `scanning → geometry → computation → conditioning`
  - R 144: `sampling → transduction(NDIR|chemiluminescence) → conditioning`
- `world-kind.sdl.graphql` — the kind's `/world` Mutation surface.
- `world-kind.yaml` — mutation → handler-method binding.
- `bench.yaml` — HUD cells, graph axes, scene_3d deformations.
- `interface.d.ts` — the TypeScript contract every instance must
  satisfy.
- `scenarios.yaml` — damage patterns.

### Instance package

- `package.sst.yaml` — full manifest.
- `coefficients.yaml` — physics coefficients.
- `samples/*.yaml` — 4-8 sample variants per instance.
- `src/behavior.ts` — implements the kind's interface; delegates to
  the legacy code during the migration window (parallel to ACME LC-500).
- `behavior.js` — bundled artifact.
- `model.glb.placeholder` — 3D model stub (real GLB lands with TODO 04).
- `README.md` — instance overview.

### Stage-registry additions

The runtime's stage registry (TODO 02) gets new entries:
- `r91/emission`, `r91/demodulation`, `r91/estimation`, `r91/conditioning-radar`
- `r129/scanning`, `r129/geometry`, `r129/computation`, `r129/conditioning-dim`
- `r144/sampling`, `r144/transduction-ndir`, `r144/transduction-chemilum`, `r144/conditioning-gas`

Migrated from `packages/r91/src/physics/`, `packages/md/src/physics/`,
and the gas-analyzer stages in `packages/core/src/physics/stages/`.

## Steps (per pair)

1. Author the kind package's 10 files (above) from the Recommendation
   source + the existing legacy code's classifications.
2. Author the instance package's files; the behavior.ts delegates to
   the legacy instrument class.
3. Register the new stages in the runtime.
4. Add a kind-interface schema (compiled from interface.d.ts) to the
   runtime's kind registry.
5. Author a placeholder 3D model.
6. Test end-to-end via `primmel-sst run <instance>`.

## Acceptance criteria

- `primmel-sst run acme-rs180` boots and serves the radar.
- `primmel-sst run acme-md3xx` boots and serves the dimensioner.
- `primmel-sst run acme-cgm-200` boots and serves the gas analyzer.
- Each kind's MPE band shows correctly in the bench's Graph.vue (where
  applicable — the radar's MPE is per-axis, the dimensioner's is per-
  dimension, the gas analyzer's is per-component).
- Each instance's samples (fresh / damaged) are selectable in the
  InstrumentChooser.
- The legacy `packages/r91/`, `packages/md/`, `packages/gas-analyzer/`
  still boot during the migration window (delegating to the new
  packages internally).

## Design notes

- **Mirror the load-cell pattern exactly.** Each kind package has the
  same 10 files in the same shape; each instance package has the same
  file set. Deviation requires a documented reason.
- **Legacy code is the source of truth for physics.** The behavior.ts
  files delegate to `RadarSpeedMeter`, `MultiDimensionalInstrument`,
  `SimulatedGasAnalyzer` (the existing classes) during the migration
  window. A later refactor (out of scope here) replaces those with
  composed stages.
- **Active domains grow the runtime's stage registry.** Each new
  domain adds 3-4 stage entries — additive, no edits to existing
  entries.

## Dependencies

- Requires TODO 02 (runtime) for the stage registry + kind-interface
  validation.
- Requires TODO 09 (specs) for the kind-package shape each pair must
  match.
