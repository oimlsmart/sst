# TODO 23 — data-driven stage composition

**Priority:** P0   **Status:** ✅ done

## Goal

Make the stage composition engine truly data-driven: read the kind's
`physics-chain.yaml` at runtime, select one stage per position by
matching the instance's classification, and pipe data through the chain
by port key. Adding a new physics phenomenon = adding a stage file +
one registry entry + one chain entry — no edits to existing stages or
to the composer.

## What landed

- `packages/runtime/sst-runtime/src/stages/stage-interface.ts` — the
  generic `Stage { process(inputs, ctx): outputs }` port-key interface.
- `packages/runtime/sst-runtime/src/stages/registry.ts` — typed
  `StageFactory` registry (the OCP seam for physics phenomena).
- `packages/runtime/sst-runtime/src/stages/data-driven.ts` —
  `DataDrivenComposer` that resolves a `PhysicsChainDecl` against the
  registry by classification, then pipes port-keyed values between
  stages. Also: `loadPhysicsChain()` reads `physics-chain.yaml` from
  disk; `registerR60Stages()` registers the eight R 60 stage factories
  (mechanical × 3, transduction × 1, conditioning × 4) eagerly on import.
- `packages/runtime/sst-runtime/src/stages/composer.ts` —
  `ComposedInstrument` gains an optional `physicsChain` config field.
  When provided, the composer uses the data-driven path; when omitted,
  the legacy direct-stage path runs (backward compatibility for tests
  and scenarios that haven't migrated yet).

## Acceptance criteria

- ✅ `loadPhysicsChain()` reads `packages/kinds/sst-r60/physics-chain.yaml`.
- ✅ `DataDrivenComposer` resolves the correct 3 stages for a
  `column/strain-gauge/digital` classification and pipes data through.
- ✅ `DataDrivenComposer` selects the shear-beam mechanical stage when
  the classification asks for `shear-beam`.
- ✅ Throws a precise error when no stage at a position matches.
- ✅ `ComposedInstrument({ physicsChain })` produces a finite, non-zero
  indication end-to-end.
- ✅ Data-driven and legacy paths agree to < 1e-6 with noise disabled.
- ✅ 8 tests in `tests/data-driven-composition.test.ts`; 95/95 runtime.
