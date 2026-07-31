# TODO 24 — wire runSession to boot composed instruments

**Priority:** P0   **Status:** ✅ done (R 60 only)

## Goal

Make `runSession(instance)` actually boot a running sim: load the
instance, resolve its kind, build a ComposedInstrument with the kind's
physics-chain, build /world + /twin schemas, boot createSimServer, and
return a working Session handle (URL + close()).

## What landed

- `packages/runtime/sst-runtime/src/session/boot.ts` — the boot flow:
  1. Read the instance's classification + coefficients (flatten the
     nested `mechanical`/`transduction`/`conditioning` sections into the
     flat keys ComposedInstrument expects).
  2. Load the kind's `physics-chain.yaml` from disk.
  3. Build a ComposedInstrument with the data-driven composer.
  4. Wrap it in `adaptR60Instrument()` — an adapter that exposes the
     LC500 family's surface (`setLoad`, `removeLoad`, `setFidelity`,
     `groundTruth()` returning strainMm/spanDriftFraction/etc.) so the
     existing `LOAD_CELL_WORLD_KIND` works unchanged.
  5. Build the /world schema via `buildWorldSchema`.
  6. Build the /twin schema from the LC500 baked contract (the canonical
     R 60 contract — instances of R 60 reuse it).
  7. Boot `createSimServer` and return the session handle.
- `packages/runtime/sst-runtime/src/session.ts` — `runSession()` now
  delegates to `bootSession()` instead of throwing a stub error.

## Out of scope (TODO future)

- R 91 / R 129 / R 144 instance boot — each kind needs its own world-kind
  registration + twin-contract artifact. The runtime throws a precise
  error pointing at boot.ts when an unrecognised kind is requested.
- Sample selection (the `--sample` flag) — the runtime builds the
  instrument from the instance's base coefficients; sample-specific
  overrides are not yet applied.

## Acceptance criteria

- ✅ `runSession()` boots an HTTP server for ACME LC-500.
- ✅ `/world` answers GraphQL queries (`{ clock groundTruth { appliedLoadKg } }`).
- ✅ `/world` mutations work (`placeLoad(massKg: 40)` → `appliedLoadKg: 40`).
- ✅ `/twin` answers indication queries (no conformance diffs).
- ✅ Unknown kind throws a helpful error before any filesystem work.
- ✅ Session handle carries the actually-bound port (ephemeral port 0 works).
- ✅ 5 tests in `tests/run-session-boot.test.ts`; 100/100 runtime.
