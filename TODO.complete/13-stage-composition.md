# TODO 13 — Stage composition engine

**Priority:** P0   **Status:** ✅ done   **Blocks:** nothing   **Blocked by:** nothing

## Goal

Make `physics-chain.yaml` real. Today the runtime's `runSession()` skips physics composition entirely — every instance's `behavior.ts` hand-instantiates the legacy `SimulatedInstrument` monolith. This TODO builds a **stage composition engine** that reads the kind's `physics-chain.yaml`, looks up each named stage in `STAGE_REGISTRY`, instantiates them with the instance's coefficients, and pipes them into a composed signal chain.

This is the single highest-impact improvement: it transforms the platform from "well-structured skeleton with data" into "fully model-driven physics."

## Deliverables

- `packages/runtime/sst-runtime/src/stages/composer.ts` — `composeStages(chain, coefficients): ComposedInstrument`
- `packages/runtime/sst-runtime/src/stages/{r60-mechanical,r60-transduction,r60-conditioning}.ts` — register the R 60 stages from the existing legacy code
- A `ComposedInstrument` class that satisfies `TwinInstrumentView` + `WorldInstrument`
- Integration: `runSession()` calls `composeStages()` instead of delegating to the instance's `behavior.ts create()`

## Acceptance criteria

- `primmel-sst run acme-lc500` boots with physics composed from `sst-r60/physics-chain.yaml`
- Removing a stage from `physics-chain.yaml` changes the indication (proves the chain drives the physics, not the legacy class)
- The existing golden-path creep test still passes (no regression)
