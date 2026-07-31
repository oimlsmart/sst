# TODO 17 — Type-enforced epistemic wall

**Priority:** P0   **Status:** ✅ done

## Goal

The first law: "Nothing from /world may leak into /twin." Today enforced by topology (two endpoints) but not by types. The `SimulatedInstrument` has both `groundTruth()` and `indication()` on the same object; the `/twin` resolvers receive the full instrument.

This TODO enforces the wall at the TypeScript level: the `/twin` schema's resolvers receive a **projected view** (`TwinView<I>`) that has NO path to ground truth.

## Deliverables

- `packages/runtime/sst-runtime/src/twin/projection.ts` — `type TwinView<I> = Pick<I, 'indication' | 'servedAt' | 'operationalState' | 'environment'>`
- The twin schema generator accepts `TwinView<I>` not `I`
- A compile-time check: any attempt to access `groundTruth()` through a `TwinView` is a type error

## Acceptance criteria

- `tsc --noEmit` passes with the projection in place
- Deliberately trying to call `groundTruth()` on a `TwinView` parameter produces a compile-time error
- No runtime behavior change (the projection is type-only)
