# TODO 36 — Bundle behavior.js per instance with esbuild

**Priority:** P1   **Status:** ✅ done

## Goal

Each instance package's `behavior.js` is currently a placeholder that
re-exports from `src/behavior.ts`. It only works in the monorepo (via
tsx resolving relative imports). Replace with a real bundled artifact
that works in any deployment — including the published-instance path
where the runtime loads via `node_modules` or a ZIP.

## What landed

- A vendored `esbuild` bundler (`packages/runtime/sst-runtime/scripts/bundle-behavior.ts`)
  is exposed as a reusable helper: `bundleBehavior(srcDir, outPath)`.
- Each instance package's `package.json` gets a `build` script that
  runs the bundler against its `src/behavior.ts`.
- The bundled `behavior.js` is a single self-contained ESM file (no
  external dependencies — every import is inlined).
- The bundled `behavior.js` is verified to load via `loadBehavior()`
  (the runtime's plug-and-play loader).

## Acceptance

- ✅ `npm run build` in each instance package produces a valid
  self-contained `behavior.js`.
- ✅ The bundled `behavior.js` loads via `loadBehavior()` (no external
  imports, no `node_modules` resolution needed).
- ✅ Each instance package's `bin.ts` boots via the bundled artifact.
- ✅ 437 tests pass; typecheck 0 errors.
