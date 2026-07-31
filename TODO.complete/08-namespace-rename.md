# TODO 08 — Namespace rename `@sim/*` → `@primmel/sst-*` (Phase 9)

**Priority:** P0   **Status:** ✅ done (core → runtime)

## Goal

Fold the legacy `@sim/core` framework into `@primmel/sst-runtime` so
there is **one** runtime package owning all framework code.

## What landed

- **`packages/core/` deleted.** All 54 source files (+ 25 tests) moved
  into `packages/runtime/sst-runtime/src/`.
- **Every `@sim/core` import** across the repo rewritten to
  `@primmel/sst-runtime` (75 files).
- **Single barrel** at `packages/runtime/sst-runtime/src/index.ts`
  exports the full public surface: physics, server, twin schema,
  console, package loader, drivers, boot strategies, certification.
- **Subpath exports** for browser-safe imports
  (`./twin/driver`, `./stages/composer`, `./world/driver`, …).
- **Build-time dep** `@primmel/primmel` wired into the runtime's
  devDependencies for the `.prl` adapter.

## Still deferred (family package absorption)

The family packages (`@sim/lc500`, `@sim/r91`, `@sim/md`,
`@sim/gas-analyzer`, `@sim/bench`) still exist as thin bins + family-
specific instruments. Full absorption into instance packages is a
follow-on PR (the bins already boot via `runSession` / the typed
drivers). The core→runtime merge was the load-bearing architectural
piece.

## Acceptance

- ✅ `grep -r '@sim/core' packages/` returns nothing outside deleted core
- ✅ 434 tests pass; typecheck 0 errors
- ✅ `primmel-sst` CLI and all family bins boot
