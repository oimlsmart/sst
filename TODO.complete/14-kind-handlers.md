# TODO 14 — Kind-level handlers (DRY)

**Priority:** P1   **Status:** ✅ done   **Blocks:** nothing   **Blocked by:** TODO 13

## Goal

Move the `handlers` object from the instance to the kind. Every instance of R 60 provides identical handlers (`applyMass: (ctx, a) => ctx.instrument.placeMass(a.massKg)`). These are kind-level — they forward to `ctx.instrument` which is always the right type. Having each instance ship identical handler code is a DRY violation.

## Deliverables

- Each kind package gains a `handlers.ts` that exports the default handler set
- Each instance's `behavior.ts` drops the `handlers` export (only `create` + `scene` remain)
- The runtime's session boot loads the kind's handlers (not the instance's)
- `world-kind.yaml` is the binding contract: mutation name → handler method

## Acceptance criteria

- A new instance of R 60 has NO handlers code (just `create` + `scene`)
- Adding a new instance requires zero handler code
- The existing mutations still work (placeLoad → applyMass → ctx.instrument.placeMass)
