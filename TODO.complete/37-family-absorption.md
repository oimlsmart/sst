# TODO 37 — Absorb family packages into thin bin shims

**Priority:** P1   **Status:** ✅ done

## Goal

The family packages (`@sim/lc500`, `@sim/r91`, `@sim/md`,
`@sim/gas-analyzer`) still exist as standalone simulators with
hand-coded boot paths. Fold them into thin bin shims that delegate to
`runSession(loadPackage(...))`. The kind packages (`packages/kinds/`)
and instance packages (`packages/instances/`) carry the data; the
family packages carry only the legacy bin entry points.

## What landed

- Each family package's `src/bin.ts` becomes a 5-line wrapper:
  `runSession(loadPackage(instancePath))`.
- The legacy `instrument.ts`, `twin.ts`, `scenarios.ts` files are
  removed (the instance packages already carry this data).
- The family packages' `twin/<name>.twin.json` baked artifacts stay
  (they're the kind's SSOT twin contract).
- The family packages' `package.json` scripts upgrade to call
  `runSession(...)` instead of the legacy `buildWorldSchema` etc.

## Acceptance

- ✅ All four family `bin.ts` files are < 30 lines.
- ✅ Each family bin delegates to `runSession()`.
- ✅ All family bin tests still pass.
- ✅ 437 tests pass; typecheck 0 errors.
