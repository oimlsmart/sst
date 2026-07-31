# TODO 35 — Migrate console client.ts to the typed drivers

**Priority:** P1   **Status:** ✅ done

## Goal

Replace the raw GraphQL queries in `packages/core/src/console/client.ts`
with typed `TwinDriver<typeof LC500_CONTRACT>` + `WorldDriver<R60WorldMutations>`
calls. The console's grammar stays load-cell-specific (per the design
doc — other kinds drive via `/world` directly).

## What landed

- `console/client.ts` constructs a typed `TwinDriver` + `WorldDriver`
  for the R 60 contract on first use (cached per `baseUrl`).
- Each `case` in the `execute()` switch becomes a typed driver call
  (e.g. `driver.placeLoad({ massKg: action.massKg })`).
- The `ConsoleIo` interface is @deprecated; the typed driver supersedes
  it. The legacy `io.query('/twin', ...)` path is kept for the
  preset-replay and graph-display paths (raw JSON printing).
- The console's `httpConsoleIo()` factory stays (test surface) but
  defaults to the typed driver.

## Acceptance

- ✅ `console/client.ts` uses typed drivers for mutation commands.
- ✅ `console/client.test.ts` advances — passes.
- ✅ CLI console (bin → console) still works end-to-end.
- ✅ 437 tests pass; typecheck 0 errors.
