# AGENTS.md — OIML SST instruments (the library)

The OIML measuring-instrument package library for the Primmel SST. The
**framework** (runtime, shell, bench, specs, the authoring guidance)
lives in **[primmel/sst](https://github.com/primmel/sst)** — read its
`AGENTS.md` and `specs/00-architecture.md` first; they are the
contract this repo's packages conform to.

## What this repo is

Packages only, no runtime code:

- `packages/base/sst-oiml-base/` — the D 11 environmental base
- `packages/kinds/` — the kind packages (`sst-r60`, `sst-r91`,
  `sst-r129`, `sst-r144`, `sst-sampling-line`)
- `packages/instances/` — the ACME instances (`acme-lc500`,
  `acme-rs180`, `acme-md3xx`, `acme-cgm-200`,
  `acme-cgm-sampling-line`, the `acme-cgm-system` composite)

## The rules

- **Packages are self-contained**: manifest + coefficients + samples +
  the bundled `behavior.js` (ZIP-portable — the physics travels with
  the package; bundle with esbuild, no externals, the createRequire
  banner).
- **Physics variants are boot-time samples**, never runtime scenario
  switches: one boot, one sample, one chain of custody. A *lying*
  twin is a fidelity knob (`setFidelity`), not a sample.
- **Additive only**: a new kind = a new package under `packages/kinds/`;
  a new instance = a new package under `packages/instances/`. Zero
  edits to existing packages (the framework's specs/08 is the cookbook).
- **The twin interface is generated** from the product reference
  package's serve declarations; the startup conformance check fails
  the boot on any diff.
- The dependency on the runtime is a sibling `file:` link
  (`package.json` → `@primmel/sst-runtime`); keep it resolving.

## Proving a change

Boot the touched instance through the framework and drive it:

```bash
cd ../sst
npx tsx packages/runtime/sst-runtime/src/bin.ts run \
  ../sst-instruments/packages/instances/<instance> 5290 [sample]
```

`/twin` answers the legal view; `/world` drives the physics; the bench
renders at `/`. The framework's suite
(`packages/runtime/sst-runtime`, 179 tests) must stay green.
