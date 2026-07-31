# ACME LC-500 instance package — `acme-lc500`

A Primmel SST instance package for the **ACME LC-500 class C6 load cell**,
referencing the [`primmel-sst-r60`](../sst-r60/) kind package.

## Layout

```
package.sst.yaml        manifest (manufacturer, classification, design parameters)
coefficients.yaml       physics coefficients (sim-owned)
samples/
  fresh.yaml
  creep-fail.yaml
  temp-fail.yaml
  drift-fail.yaml
  lying-twin.yaml
  stale-twin.yaml
  aged-2024.yaml
  dropped-2023.yaml
src/behavior.ts         behavior source — bundled to behavior.js
behavior.js             bundled artifact (produced by `npm run bundle`)
model.glb               3D dynamic artifact (placeholder for now)
```

## Behavior

The `src/behavior.ts` source implements the kind's `interface.d.ts` contract.
Phase 3 of the SST migration will introduce `npm run bundle` (via esbuild)
to produce the bundled `behavior.js` artifact at build time. The runtime
loads the bundled file, validates it against the kind's interface, and
wires its handlers per the kind's `world-kind.yaml`.

## Damage scenarios

Each sample references one of the kind's damage scenarios
(`sst-r60/scenarios.yaml`) and may add per-sample overrides on top.

| Sample | Scenario | Notes |
|---|---|---|
| `fresh` | fresh | baseline |
| `creep-fail` | creep-fail | 30-min creep test fails |
| `temp-fail` | temp-fail | temperature tests fail |
| `drift-fail` | drift-fail | span-stability fails |
| `lying-twin` | lying-twin | honest physics, dishonest twin |
| `stale-twin` | stale-twin | freshness violation |
| `aged-2024` | aged | 5 years in service |
| `dropped-2023` | dropped | mechanical damage from handling |

## Status

Phase 2b of the SST migration. The `model.glb` is a placeholder until
Phase 5 (glTF loader) ships; the runtime falls back to procedural
geometry when no model is present.
