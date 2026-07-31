# TODO 20 — Physics golden-path tests

**Priority:** P1   **Status:** ✅ done

## Goal

The tests validate manifests and package shapes. They don't test that the physics is correct. This TODO adds golden-path tests: for each kind, place known loads, advance known times, assert the indication matches expected values computed from the coefficients.

## Deliverables

- `packages/runtime/sst-runtime/tests/physics-golden.test.ts` — per-kind golden trajectories
- Each test: place load → advance time → assert indication within expected window
- Creep, drift, temperature, hysteresis, linearity — one golden path per phenomenon

## Acceptance criteria

- A class C6 cell with 40 kg load at 20 °C indicates 40.00 ± 0.05 kg after settling
- Creep-cell drifts > 5× the good-cell drift over 10 min (the existing bin.test.ts pattern)
- Temperature sweep to 60 °C shifts the indication by the expected TC coefficient × ΔT
