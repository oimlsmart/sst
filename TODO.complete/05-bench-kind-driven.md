# TODO 05 — Bench kind-driven (Phase 6)

**Priority:** P1   **Status:** ✅ done   **Blocks:** TODO 04   **Blocked by:** TODO 02

## Goal

Generalize `packages/lc500/bench/` so every load-cell-specific
hard-coding becomes data read from the kind package's `bench.yaml`.
The bench becomes `@primmel/sst-bench` — the running-instrument view
embedded by the shell — and renders any kind, not just the load cell.

After this phase, authoring a new kind (e.g. R 49 water meter) with a
new bench visualization requires only: ship a `bench.yaml` in the kind
package + optional Vue island components for kind-specific panes. Zero
edits to the bench itself.

## Deliverables

### Rename

- `packages/lc500/bench/` → `packages/shell/sst-bench/`
- `@sim/bench` → `@primmel/sst-bench`

### Bench becomes kind-aware

- A new `src/lib/kind-meta.ts` reads the loaded kind's `bench.yaml` at
  session boot.
- `BenchScene.vue` reads `bench.yaml:scene_3d` (model URL, deformations).
- `Graph.vue` reads `bench.yaml:graph` (axes, lines, MPE band source).
- `Console.vue` reads `bench.yaml:console_grammar` for the kind-specific
  command set.
- The HUD (`BenchScene.vue`'s overlay) reads `bench.yaml:hud_cells` —
  each cell declares its key, label, channel, format, source path.
- `DialInset.vue` reads `bench.yaml:dial` — present/absent + spec
  source.
- `InstrumentChooser.vue` reads samples from the loaded instance.

### Component-override mechanism

- A kind can declare `bench.yaml:custom_components` — a map of pane →
  Vue island component path. The bench loads these dynamically
  (`defineAsyncComponent`).
- R 60's dial inset stays in the bench (load-cell-shaped); other kinds
  can override it (e.g. R 49 might have a flow-rate display).

## Steps

1. Rename the bench package; update imports.
2. Author `kind-meta.ts` — reads `bench.yaml`, exposes typed accessors.
3. Refactor each hard-coded component to read its config.
4. Add the custom-component override mechanism.
5. Verify the LC-500 still renders identically (regression test).
6. Author a minimal non-load-cell bench config (e.g. the radar's bench
   shell — just HUD + console; the radar gets its own bench later in
   Phase 8).

## Acceptance criteria

- `primmel-sst run acme-lc500` → bench loads the LC-500's `bench.yaml`
  and renders identically to today (visual regression: identical graph
  axes, identical HUD cells, identical dial inset).
- Changing `bench.yaml:hud_cells[0].label` from "load" to "mass" in
  the kind package → bench shows "mass" on next boot.
- A new kind package without a `bench.yaml:scene_3d` falls back to a
  placeholder scene ("no 3D model for this kind").
- The dial inset is hidden when `bench.yaml:dial.present` is false.
- A custom component override loads and renders in the right pane.

## Design notes

- **The bench stays one app.** It doesn't fork per kind; it adapts.
- **Data over code.** Anything that varies per kind belongs in
  `bench.yaml`. If a kind needs a fundamentally new pane (e.g. R 49's
  flow-rate display), use the custom-component override.
- **Performance.** Reading `bench.yaml` happens once at session boot.
  Hot-reloading the config isn't supported (the user starts a new
  session to pick up changes).
- **Visual consistency.** All kinds share the design tokens (Space
  Grotesk, IBM Plex, dark instrument-panel palette). A kind's
  `bench.yaml` doesn't override colors or typography — only data.

## Dependencies

- Requires TODO 02 (runtime) to expose the loaded package shape.
- TODO 04 (glTF) integrates the 3D model into BenchScene.vue.
