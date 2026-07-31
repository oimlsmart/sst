# TODO 10 — Tests

**Priority:** P0   **Status:** ✅ done   **Blocks:** nothing   **Blocked by:** TODO 02, 09

## Goal

Comprehensive test coverage across the SST platform. Per the global
rule: real model instances, never doubles; test behavior, not
interactions. Tests are the executable form of the specs (TODO 09).

## Deliverables

### `packages/runtime/sst-runtime/tests/`

- `loader.test.ts` — load each known package (base + 4 kinds + 4
  instances once Phase 8 lands); assert the LoadedPackage shape.
- `manifest-schema.test.ts` — every package's manifest validates
  against `specs/schemas/package-manifest.schema.json`.
- `kind-interface.test.ts` — each kind's `interface.d.ts` compiles; the
  shape descriptor is registered.
- `behavior-shape.test.ts` — each instance's `behavior.js` default
  export satisfies its kind's interface; missing handlers fail loudly.
- `boot.test.ts` — boot each family via `primmel-sst run <instance>`;
  assert `/twin`, `/world`, `/` all respond.
- `effects-registry.test.ts` — adding a new effect handler is purely
  additive (regression: existing handlers still work after a new one
  registers).

### `packages/base/sst-oiml-base/tests/`

- `conditions.test.ts` — every condition file validates against
  `condition.schema.json`; severity tables are well-formed.
- `profiles.test.ts` — every profile file validates against
  `profile.schema.json`; keyframe times are monotonic.
- `coverage.test.ts` — all 35 D 11 condition classes have a file (after
  TODO 01).

### `packages/kinds/sst-r60/tests/`

- `mpe.test.ts` — MPE formulas produce the right values at known loads
  (e.g. C6 at 500 intervals → 0.5 v_min; at 2000 intervals → 1.0
  v_min).
- `classification.test.ts` — every declared classification axis is a
  closed enum; values are R 60-canonical.
- `interface.test.ts` — the interface.d.ts type-checks cleanly; the
  shape descriptor matches.

### Per-instance tests

- `packages/instances/acme-lc500/tests/behavior.test.ts` — the
  behavior.js default export creates an instrument; placeMass(40) →
  groundTruth.appliedLoadKg === 40; indication responds within filter
  settling time.
- Each instance gets a parallel test file.

### Bench tests

- `packages/shell/sst-bench/tests/ssr.test.ts` — the SSR HTML contains
  required element IDs (terminal-input, pane-dial) per the existing
  smoke test.
- `packages/shell/sst-bench/tests/kind-meta.test.ts` — the bench
  reads `bench.yaml` and renders the configured HUD cells.

### Shell tests

- `packages/shell/sst-shell/tests/upload.test.ts` — uploading a valid
  ZIP succeeds; uploading a malformed ZIP produces a precise error.
- `packages/shell/sst-shell/tests/routes.test.ts` — `/`, `/kind/<id>`,
  `/session/<id>` all respond.

### End-to-end tests

- `e2e/full-flow.test.ts` — boot the runtime; open a session via the
  shell's HTTP API; poll both channels; assert responses.

### CI

- Existing jobs preserved (typecheck, test on node 22/24, bench-build,
  standalone-boot, console-session, bake-freshness).
- New jobs: `manifest-validation` (every package validates against its
  schema), `behavior-shape` (every instance behavior.js satisfies its
  kind's interface), `loader-test`.

## Steps

1. Author the schema-validation tests first (they're cheap and catch
   most errors).
2. Author the runtime loader + behavior-shape tests (TODO 02 lands
   first; tests follow).
3. Author the per-instance behavior tests.
4. Author the bench + shell tests.
5. Add the new CI jobs.

## Acceptance criteria

- `npm test` green across all packages.
- Coverage: ≥ 80% for runtime, ≥ 90% for loader + registries.
- Every package's manifest validates against its schema.
- Every instance's behavior.js satisfies its kind's interface.
- The OCP test: temporarily adding a new (fake) kind package on disk
  boots successfully without any code edits to the runtime.

## Design notes

- **No doubles.** Per the global rule, use real model instances. If a
  model is hard to instantiate, build a test factory — don't reach
  for `double()`.
- **Behavior over interactions.** Assert on output and state, not on
  "this method was called N times".
- **The OCP test is the most important.** It's the executable form of
  the architecture's central promise.

## Dependencies

- Requires TODO 02 (runtime) for the loader/registries to test.
- Requires TODO 09 (specs) for the JSON Schemas to validate against.
