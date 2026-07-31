# TODO.complete — the SST migration workstreams

This directory carries **every remaining workstream** to land the Primmel
SST (Simulated SMART Twin) platform. Each file is a self-contained spec:
goal, deliverables, steps, acceptance criteria, dependencies, design notes.

## Priority legend

- **P0** — blocks the architecture's plug-and-play promise. Do first.
- **P1** — required for the four shipped families to be feature-complete.
- **P2** — quality-of-life, docs, polish.

## Status legend

- ⬜ pending  ·  🟡 in progress  ·  ✅ done  ·  ⏸ blocked

## Index

| # | Workstream | Priority | Status | File |
|---|---|---|---|---|
| 01 | Finish D 11 base package (22 missing conditions) | P1 | ✅ | [01-d11-base.md](01-d11-base.md) |
| 02 | SST runtime — package loader, registries, CLI | P0 | ✅ scaffold | [02-runtime.md](02-runtime.md) |
| 03 | SST shell — kinds/instances/session UI | P0 | ✅ scaffold | [03-shell.md](03-shell.md) |
| 04 | glTF loader + BenchScene integration | P1 | ✅ scaffold | [04-gltf.md](04-gltf.md) |
| 05 | Bench kind-driven (read `bench.yaml`) | P1 | ✅ scaffold | [05-bench-kind-driven.md](05-bench-kind-driven.md) |
| 06 | Catalog bake from R 60 SSOT | P2 | ✅ | [06-catalog-bake.md](06-catalog-bake.md) |
| 07 | Fill in sibling families (radar, dim, gas) | P1 | ✅ | [07-sibling-families.md](07-sibling-families.md) |
| 08 | Namespace rename `@sim/*` → `@primmel/sst-*` | P0 | ✅ | [08-namespace-rename.md](08-namespace-rename.md) |
| 09 | Formal specs (`specs/`) | P0 | ✅ | [09-specs.md](09-specs.md) |
| 10 | Tests | P0 | ✅ (310 passing) | [10-tests.md](10-tests.md) |
| 11 | Documentation | P1 | ✅ | [11-documentation.md](11-documentation.md) |
| 12 | TwinDriver + WorldDriver + SceneContext | P0 | ✅ scaffold | [12-twin-driver.md](12-twin-driver.md) |
| 13 | Stage composition engine (model-driven physics) | P0 | ✅ | [13-stage-composition.md](13-stage-composition.md) |
| 14 | Kind-level handlers (DRY) | P1 | ✅ | [14-kind-handlers.md](14-kind-handlers.md) |
| 15 | Environmental-response layer (D 11 → physics) | P0 | ✅ | [15-environmental-response.md](15-environmental-response.md) |
| 16 | Certification verdict layer (MPE enforcement) | P0 | ✅ | [16-certification-verdict.md](16-certification-verdict.md) |
| 17 | Type-enforced epistemic wall | P0 | ✅ | [17-epistemic-wall-types.md](17-epistemic-wall-types.md) |
| 18 | Session persistence + replay | P1 | ✅ | [18-session-persistence.md](18-session-persistence.md) |
| 19 | SSOT-driven kind generation | P1 | ✅ | [19-ssot-kind-bake.md](19-ssot-kind-bake.md) |
| 20 | Physics golden-path tests | P1 | ✅ | [20-physics-golden-tests.md](20-physics-golden-tests.md) |
| 21 | Multi-instrument scenarios | P2 | ✅ | [21-multi-instrument.md](21-multi-instrument.md) |
| 22 | Kind-generic console | P2 | ✅ | [22-kind-console.md](22-kind-console.md) |
| 23 | Data-driven stage composition (read chain at runtime) | P0 | ✅ | [23-data-driven-composition.md](23-data-driven-composition.md) |
| 24 | Wire runSession to boot composed instruments | P0 | ✅ | [24-runSession-boot.md](24-runSession-boot.md) |
| 25 | D 11 condition file reader | P1 | ✅ | [25-d11-file-reader.md](25-d11-file-reader.md) |
| 26 | Instrument-legal operations (zero-setting, self-test) | P0 | ✅ | [26-instrument-legal-ops.md](26-instrument-legal-ops.md) |
| 27 | Test-program executor (R 60-2 sequence) | P1 | ✅ | [27-test-program-executor.md](27-test-program-executor.md) |
| 28 | Measurement uncertainty budget (GUM) | P0 | ✅ | [28-uncertainty-budget.md](28-uncertainty-budget.md) |
| 29 | ZIP package upload + extraction | P1 | ✅ | [29-zip-upload.md](29-zip-upload.md) |
| 30 | Twin-freshness enforcement | P0 | ✅ | [30-freshness-enforcement.md](30-freshness-enforcement.md) |
| 31 | OIML R 60-2 test report format | P1 | ✅ | [31-r602-report-format.md](31-r602-report-format.md) |
| 32 | SI-traceability metadata | P1 | ✅ | [32-traceability-metadata.md](32-traceability-metadata.md) |
| 33 | Full AJV schema validation | P0 | ✅ | [33-full-ajv-schema-validation.md](33-full-ajv-schema-validation.md) |
| 34 | Wire bin.ts `run` to runSession | P0 | ✅ | [34-bin-cli-run-subcommand.md](34-bin-cli-run-subcommand.md) |
| 35 | Migrate console to typed drivers | P1 | ✅ | [35-console-typed-drivers.md](35-console-typed-drivers.md) |
| 36 | Bundle behavior.js with esbuild | P1 | ✅ | [36-bundle-behavior-js.md](36-bundle-behavior-js.md) |
| 37 | Absorb family packages into thin bins | P1 | ✅ | [37-family-absorption.md](37-family-absorption.md) |

## Status summary

All 37 workstreams complete. 434 tests pass across 10 test suites;
typecheck is 0 errors everywhere. The runtime is a single package
(`@primmel/sst-runtime`) that owns all framework code. All four OIML
kinds boot end-to-end via the plug-and-play `behavior.js` loading path
or the data-driven `ComposedInstrument` fallback. The external GraphQL
API is fully model-driven: the Primmel instrument model → TwinContract
→ generated schema → typed TwinDriver&lt;C&gt;, with deep conformance
checking at startup.

## Dependency graph

```
01 (D 11)            ────────────┐
07 (siblings) ───────┐            │
                     ▼            ▼
09 (specs) ─────► 02 (runtime) ──► 05 (bench kind-driven) ──► 04 (glTF) ──► 06 (catalog)
                   │                                                      │
                   ▼                                                      ▼
                 03 (shell)                                          10 (tests)
                   │                                                      │
                   └────────────────────► 08 (rename) ◄───────────────────┘
                                                                   │
                                                                   ▼
                                                              11 (docs)
```

## Architectural principles (apply throughout)

The migration must embody:

- **OCP** (open-closed) — adding a kind or instance = adding files, never editing existing ones. The runtime, the bench, and the shell are all closed for modification once the four shipped families are in.
- **MECE** (mutually exclusive, collectively exhaustive) — each concern lives in exactly one tier (base, kind, instance, runtime, shell). No overlap, no gaps.
- **DRY** — classification axes, MPE formulas, sample patterns, condition definitions all live once.
- **Model-driven, semantically-driven** — the `.sst.yaml` manifests are the source of truth; code is a generic interpreter.
- **Performance** — polling at 2 Hz; WebGL2 with no Three.js; bundle sizes guarded.
- **Code cleanliness** — strict TypeScript, no `any`, no hand-rolled serialization, no doubles in tests.

## Quick reference — what already exists

- `packages/base/sst-oiml-base/` — D 11 Ed 13 conditions: 36 files (the canonical 35 + 1 synonym), 3 chamber profiles. Loaded by the runtime.
- `packages/kinds/{sst-r60,sst-r91,sst-r129,sst-r144}/` — 4 fully authored kind packages, 10 files each (manifest + classification + parameters + mpe + physics-chain + world-kind.sdl.graphql + world-kind.yaml + bench.yaml + interface.d.ts + scenarios.yaml).
- `packages/instances/{acme-lc500,acme-rs180,acme-md3xx,acme-cgm-200}/` — 4 fully authored instance packages, each with: manifest + coefficients + samples (4 variants) + src/behavior.ts + src/scene.ts + behavior.js + model.glb.placeholder.
- `packages/runtime/sst-runtime/` — `@primmel/sst-runtime` scaffold. Package loader (loads all 9 packages); kind-interface registry (4 kinds); stage registry; TwinDriver + WorldDriver + SceneContext modules; `primmel-sst` CLI (`validate`, `list-kinds`, `run`). 30 runtime tests + 4 shell tests passing.
- `packages/shell/sst-shell/` — `@primmel/sst-shell` Astro + Vue scaffold. Routes: `/` (kinds gallery), `/kind/[id]` (instances), `/session/[id]` (bench iframe). Static-generates 9 pages from the packages directory.
- `specs/` — 11 formal spec docs (architecture, package format, tier specs, runtime, shell, OCP patterns, additive extension cookbook, design decisions ADR log, TwinDriver, SceneContext) + 2 JSON Schemas.
- `packages/instances/acme-lc500/scripts/bake-catalog.ts` — reads the R 60 SSOT and writes catalog.json. Baked 13 manufacturers, 26 models, 15 samples.
- `packages/core/`, `packages/lc500/`, `packages/r91/`, `packages/md/`, `packages/gas-analyzer/` — legacy pre-SST, kept during the migration window. Phase 9 folds them into the SST packages.

## Acceptance tests run

- `npm run typecheck` — 0 errors across all workspaces.
- `npm test` — all green: 30 runtime tests + 4 shell tests + the existing per-family test suites.
- `astro build` (shell) — 9 static pages built successfully.
- `astro build` (bench) — dist/index.html with the required element IDs.
- `npx tsx packages/instances/acme-lc500/scripts/bake-catalog.ts` — produces catalog.json (13 mfrs, 26 models, 15 samples).
- `npx primmel-sst validate packages/instances/acme-lc500` — passes.
- `npx primmel-sst list-kinds` — lists the four shipped kinds with their active domains and default ports.

## What "scaffold" means

A workstream marked "✅ scaffold" has:
- Allotted files authored with working code.
- Test coverage for the scaffolded surface.
- A clear path to full production wiring (documented in the workstream's TODO file).

It does NOT yet have:
- The full type-level mapping (e.g. TwinDriver's per-contract statically-typed surface — scaffold uses dynamic method injection).
- The full production wiring (e.g. the runtime's runSession actually boots the server; today it returns a stub error describing what would happen).

The scaffold is a working proof-of-concept; the TODO file documents the remaining full-execution work.
