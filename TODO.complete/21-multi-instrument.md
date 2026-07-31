# TODO 21 — Multi-instrument scenarios (reference + DUT)

**Priority:** P2   **Status:** ✅ done

## Goal

Real test benches compare a device-under-test against a reference instrument. This TODO adds multi-session scenarios where two instances share an environment.

## Deliverables

- `packages/runtime/sst-runtime/src/session/multi-session.ts` — manages paired sessions sharing a clock + environment
- `packages/shell/sst-shell/src/components/ComparisonView.vue` — side-by-side twin readings
- A comparison engine that computes the error between the two instruments

## Acceptance criteria

- Two sessions (good-cell + creep-cell) share the same temperature sweep
- The comparison view shows both indications diverging as creep accrues
- The error between the two is the certification-relevant signal
