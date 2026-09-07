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
- **The signed-serve posture is opt-in and inert by default**: an
  instance manifest MAY declare a `signing:` block (the device identity
  + a simulation-custody pair — the package IS the device; the
  framework's specs/12 §3.9 is normative). The block activates only
  when the boot opts in (`SST_SIGNED_SERVE=1` or a programmatic
  `SessionOptions` declaration) — committing a block never changes a
  default boot's bytes, and the smart live-sim CI legs consume these
  packages unsigned. The attested `endpoint` / `registers` spellings
  are the deployment's declared ids/aspects (the Primmel composition),
  never invented per package.
- The dependency on the runtime is a sibling `file:` link
  (`package.json` → `@primmel/sst-runtime`); keep it resolving.

## The SSOT guards (CI)

The model is the interface on this surface too (smart/AGENTS.d/16):
nothing here re-authors what the Recommendation models or the product
packages already carry. Two CI legs enforce it
(TODO.model-content/05), both honestly SKIPPED where the smart
checkout is not declared (`SMART_REPO` unset — same doctrine as
`bake-freshness`):

- `kind-bake-freshness` — the R 60 kind's `classification.yaml` is
  GENERATED from the smart repo's data tree
  (`data/r60/model/instrument.yaml`'s `classification_dimensions`; the
  hop off the PRL packages is documented in the script's header).
  Re-bake: `SMART_REPO=<smart checkout> npx tsx
  packages/kinds/sst-r60/scripts/bake-kind-from-ssot.ts`. The bannered
  file is never hand-edited; the leg re-bakes and `git diff
  --exit-code`s it.
- `instance-parameters` — `npm run check:instance-parameters`
  (`scripts/check-instance-parameters.ts`) cross-checks every
  instance's typed `classification:` + `design_parameters:` against the
  Primmel product package its manifest's `maps_to:` names
  (`<smart>/primmel-packages/<id>`), loaded with the real PRL parser
  (`@primmel/primmel`, resolved through the linked runtime). Every
  parameter BOTH sides carry must agree; a disagreement fails loudly.

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
