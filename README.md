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

Boot an instance with the npm scripts (the runtime CLI resolves the
library from the instance's own tree — no checkout layout assumed):

```bash
npm start                 # the ACME LC-500 load cell on :5290
npm start -- creep-fail   # a physics variant is a boot-time sample
npm start -- --console    # the IOS-style console (enable, lad apply 400 at 50, show lad)

npm run start:rs180       # the R 91 radar speed meter on :5291
npm run start:md3xx       # the R 129 dimensional instrument on :5292
npm run start:cgm200      # the R 144 gas analyzer on :5293
npm run start:cgm-system  # the composite (analyzer + sampling line) on :5294

npm run validate          # validate every package (12)
```

Once booted: `POST :<port>/twin` is the instrument's legal view (what
certification software reads); `POST :<port>/world` is simulated reality
(GraphiQL in a browser) — `ladApply`, `setEnvironment`, `advanceTime`,
`groundTruth { lad { … } }`. For library-wide operations (the test
suites, `list-kinds`) declare the position: `SST_LIBRARY_PATH` points at
this repo's checkout.

### The signed-serve posture (opt-in)

A boot can serve **device-signed** values (the framework's specs/12
§3.9; the OIML SMART platform's TODO.v3/10 signed-serve consumption):
every served quantity carries a signature envelope (ES256 over the
deep-sorted canonical JSON of `{endpoint, register, servedAt, value,
unit?}`) and `servedAt` as canonical ISO. The `acme-cgm-200` and
`acme-cgm-sampling-line` packages declare their device identity +
simulation-custody pair in their manifests' `signing:` blocks — **inert
by default**: the posture activates only when the boot opts in
(`SST_SIGNED_SERVE=1 npm run start:cgm-system`, or a programmatic
`SessionOptions.signing` / `.componentSigning`). A default boot is
byte-identical with or without the blocks committed.

`npm install` in this repo links the runtime through the declared
`file:` dependency (`@primmel/sst-runtime` in `package.json`) — the
framework checkout sits at the position the dependency names
(`../../primmel/sst` from this repo's root, matching the CI checkout
positions); the npm tag follows at release.

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
