# TODO 02 — SST runtime (Phase 3)

**Priority:** P0   **Status:** ✅ done   **Blocks:** TODO 03, 04, 05, 10   **Blocked by:** TODO 09

## Goal

Build `packages/runtime/sst-runtime/` — the kind-agnostic loader that
composes a base + kind + instance package into a running sim. This is
the linchpin of the OCP win: adding a kind or instance requires zero
runtime edits.

The runtime is the renamed-and-extended `@primmel/sst-runtime`. It keeps the
existing surfaces (`createSimServer`, `generateTwinSchema`,
`buildWorldSchemaFor`, `checkTwinConformance`) and adds: package loader,
kind-interface registry, physics-stage registry, behavior.js bundling.

## Deliverables

### New code (in `packages/runtime/sst-runtime/src/`)

- `package-loader.ts` — `loadPackage(pathOrZip): LoadedPackage`
  - Detects ZIP vs directory; for ZIP, extract to a temp dir.
  - Reads `package.sst.yaml`; validates against the schema (TODO 09).
  - Resolves cross-tier references (`base:`, `kind:`) by id.
  - Returns `{ manifest, tier, content: LoadedPackageContent }`.
- `kinds/registry.ts` — `KIND_REGISTRY: Map<KindId, KindInterface>`
  - Each kind package's `interface.d.ts` is compiled to a runtime shape
    descriptor (a JSON Schema or a `zod` schema) used to validate the
    instance's behavior.js default export at load time.
  - Populated by the runtime's `index.ts` importing the known kind
    schemas (R 60, R 91, R 129, R 144) plus any registered at boot.
- `stages/registry.ts` — `STAGE_REGISTRY: Map<StageKey, StageFactory>`
  - Each physics stage (MechanicalStage, TransductionStage,
    ConditioningStage, gas/radar/dim variants) registers itself.
  - The kind's `physics-chain.yaml` references stages by key; the
    instance's behavior.js instantiates them with coefficients.
- `bundler.ts` — esbuild wrapper that bundles an instance's
  `src/behavior.ts` → `behavior.js` (called by the instance's
  `npm run bundle` script).
- `bin.ts` — the `primmel-sst` CLI entry. Usage:
  ```
  primmel-sst run <instance-package> [--port 5290] [--sample fresh]
  primmel-sst validate <package>     # manifest + behavior.js shape check
  primmel-sst bundle <instance>      # rebuild behavior.js
  ```

### Migrated code (from `packages/core/src/`)

- `server.ts` — unchanged (already kind-agnostic)
- `twin-schema.ts` — unchanged
- `conformance.ts` — unchanged
- `twin-contract.ts`, `twin-bake.ts` — unchanged
- `world-schema.ts` — extended to compose base + kind mutations
- `time.ts`, `physics/quantity.ts`, `physics/rng.ts` — unchanged
- `environment/conditions.ts`, `environment/profiles.ts` — replaced by
  the base package loader (the in-memory shape stays; data source
  changes from TS-embedded to YAML-loaded).

### Tests

- `tests/loader.test.ts` — load each of the 7 known packages (1 base +
  4 kinds + 2 instances once Phase 8 lands; for now: 1 base + 1 kind +
  1 instance); verify the LoadedPackage shape.
- `tests/registry.test.ts` — verify a kind package without an
  `interface.d.ts` is rejected; verify an instance behavior.js missing
  a declared handler fails loudly.
- `tests/boot.test.ts` — boot each family end-to-end via the generic
  bin; assert `/twin`, `/world`, `/` all respond.

## Steps

1. Rename `packages/core/` → `packages/runtime/sst-runtime/`; update
   imports across all dependents.
2. Author `package-loader.ts` (ZIP via `yauzl`, YAML via `yaml`).
3. Define `LoadedPackage`, `KindInterface`, `StageFactory` types.
4. Author `kinds/registry.ts` — load kind interface schemas from disk
   at boot.
5. Author `stages/registry.ts` — move existing stages under
   `stages/` and register.
6. Author `bundler.ts` — esbuild wrapper (single-file ESM, target=node18).
7. Author `bin.ts` — parseArgs + the run/validate/bundle subcommands.
8. Wire the legacy family `bin.ts` files to delegate to the new generic
   bin during the migration window.
9. Author the test suite.
10. Update the workspaces glob to include `packages/runtime/*`.

## Acceptance criteria

- `primmel-sst run acme-lc500 --port 5290` boots; both channels + the
  bench respond.
- `primmel-sst validate packages/instances/acme-lc500` passes.
- Adding a new instance package on disk (no code edits elsewhere) and
  running `primmel-sst run <new-id>` boots successfully.
- All existing tests still pass.
- `npm run typecheck` green.

## Design notes

- **OCP seam = the two registries.** New kind = new entry in
  `kinds/registry.ts` + new `interface.d.ts` on disk; new active domain
  = new entry in `stages/registry.ts` (or a new `effects/*.ts` file
  once we add effect handlers per kind). Zero edits to existing entries.
- **Behavior.js shape validation** uses the kind's `interface.d.ts`
  compiled to a runtime schema. Don't ship `tsc` in the runtime;
  pre-compile the interface to JSON Schema at kind-package build time.
- **Bundling pipeline.** `behavior.ts` → esbuild → `behavior.js`
  (single-file ESM, no externals, target node18+browser). The
  distributed ZIP contains `behavior.js`, not the source.
- **Backward compatibility during the migration.** The legacy
  `@sim/lc500/bin.ts` keeps working as a thin wrapper that calls
  `primmel-sst run acme-lc500` under the hood. Deleted in Phase 9.
- **Performance.** Behavior.js is loaded once per session (not per
  request). Physics ticks are O(1) per stage. Polling cadence stays at
  500 ms (configurable per kind if a fast phenomenon needs higher
  resolution).

## Dependencies

- Requires TODO 09 (specs) for the manifest schema.
- Blocks TODO 03 (shell needs the runtime to boot sessions), TODO 04
  (glTF loader integrates via runtime's bench composition), TODO 05
  (bench reads `bench.yaml` via the runtime's loaded-package shape),
  TODO 10 (tests need the runtime to exist).
