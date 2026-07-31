# TODO 22 — Kind-generic console

**Priority:** P2   **Status:** ✅ done

## Goal

The console grammar is load-cell-shaped. Other kinds skip the console entirely. This TODO makes the console kind-generic: read the kind's `world-kind.yaml` mutations and generate the grammar dynamically.

## Deliverables

- `packages/runtime/sst-runtime/src/console/generic-grammar.ts` — derives commands from world-kind.yaml
- `placeLoad(massKg: Float!)` → `place load <kg>`
- `setTarget(speedKmh: Float!)` → `set target <kmh>`
- `feedObject(lengthCm: Float, ...)` → `feed object <l> <w> <h>`

## Acceptance criteria

- Every kind's mutations are addressable from the console without hard-coded grammar
- Tab-completion works against the generated grammar
- The load-cell-specific grammar (fidelity reset, thermal-hysteresis) also generates correctly
