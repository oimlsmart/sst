# TODO 34 — Wire bin.ts `run` subcommand to runSession

**Priority:** P0   **Status:** ✅ done

## Goal

The `primmel-sst` CLI's `run` subcommand currently throws a stub error
that defers to "TODO 02 full". Replace with the real implementation:
`run <instance-package-path>` calls `loadPackage`, then `runSession`,
printing the boot banner + serving the server until SIGINT.

## What landed

- `bin.ts#run` resolves the instance path (ZIP or directory), loads
  the package, dispatches to `runSession()`, and prints the same banner
  as the legacy bin (`sim-lc500`, `sim-r91`, etc.).
- `validate` and `list-kinds` were already functional; tighten error
  messages to match the new loader's precise diagnostics.
- `bin.ts` is now genuinely usable as `npx primmel-sst run
  packages/instances/acme-lc500 --port 0`.

## Acceptance

- ✅ `bin.ts#run` returns a working server (no stub error).
- ✅ The CLI's banner matches the legacy bin's output.
- ✅ `bin.ts#validate` and `bin.ts#list-kinds` are unchanged.
- ✅ 1 new test (`bin-cli.test.ts`) covering the `validate` +
  `list-kinds` paths and the `run` path's stub-free dispatch.
- ✅ 436 → 437 tests pass; typecheck 0 errors.
