# OIML SST instruments — the instrument library for the Primmel SST

The OIML measuring-instrument package library for the
[Primmel SST](https://github.com/primmel/sst) framework: the D 11
environmental base, the per-Recommendation kind packages, and the
manufacturer instances — everything the runtime composes into a
running simulated SMART twin.

> **The split (TODO.integration/24):** this repo is the **library**.
> The runtime, shell, bench, and specs live in
> **[primmel/sst](https://github.com/primmel/sst)**. The pre-split
> repo `oimlsmart/sim-instruments` is archived.
> How the twins fit the certification program: the
> [OIML SMART volumes](https://primmel.github.io/primmel-smart-docs/oiml-rec/).

## The tiers

| Tier | Path | What |
|---|---|---|
| **base** | `packages/base/sst-oiml-base/` | OIML D 11 environmental conditions (temperature, humidity, pressure — the profiles) |
| **kinds** | `packages/kinds/` | one per Recommendation: `sst-r60` (load cells), `sst-r91` (speed meters), `sst-r129` (dimensioners), `sst-r144` (gas analyzers), `sst-sampling-line` |
| **instances** | `packages/instances/` | the ACME family: `acme-lc500` (R 60), `acme-rs180` (R 91), `acme-md3xx` (R 129), `acme-cgm-200` (R 144), `acme-cgm-sampling-line`, and the **`acme-cgm-system` composite** |

Each instance package is self-contained: `package.sst.yaml`, the
coefficients, the samples (custody-bound physics variants — one boot,
one sample, one chain of custody), and a bundled `behavior.js`
(ZIP-portable: the physics travels with the package).

## Using it

The runtime boots packages by path — a `run <instance>` boot resolves
the instrument library from the instance's own tree (an instance lives
IN its library), so no checkout layout is assumed. For library-wide
operations (the test suites, `list-kinds`) declare the position:
`SST_LIBRARY_PATH` points at this repo's checkout.

```bash
# from your primmel/sst checkout — any layout works (the instance
# carries its library with it):
npx tsx packages/runtime/sst-runtime/src/bin.ts run \
  /path/to/this-repo/packages/instances/acme-lc500 5290

# a physics variant is a boot-time sample:
npx tsx packages/runtime/sst-runtime/src/bin.ts run \
  /path/to/this-repo/packages/instances/acme-lc500 5290 creep-fail

# the composite (analyzer + sampling line, one /twin):
npx tsx packages/runtime/sst-runtime/src/bin.ts run \
  /path/to/this-repo/packages/instances/acme-cgm-system 5291
```

`npm install` in this repo links the runtime through the declared
`file:` dependency (`@primmel/sst-runtime` in `package.json`) — the
framework checkout sits at the sibling position the dependency names
(`../primmel/sst`, matching the CI checkout positions); the npm tag
follows at release.

## The samples and the physics

The physics are metrologically real and configurable per sample:
creep develops by the class law (a good cell holds its allowance; the
`creep-fail` sample exceeds it), temperature cycles leave residuals,
warm-up follows the 5τ arc, and fidelity knobs (`setFidelity`) model
the dishonest twin — offset and lag on the served value only, the
ground truth untouched (the epistemic wall).

## Authoring a new kind or instance

Additive by design: a kind is a package under `packages/kinds/`
(interface, physics-chain, twin contract, world SDL); an instance is
a package under `packages/instances/` (coefficients, samples, the
behavior bundle). Zero edits to existing packages or to the runtime.
The cookbook is the runtime repo's
[`specs/08-additive-extension.md`](https://github.com/primmel/sst/blob/v2/specs/08-additive-extension.md).

## License

Proprietary — OIML SMART pilot (see the program site,
[oimlsmart.org](https://www.oimlsmart.org)).
