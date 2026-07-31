# OIML SST base package — `primmel-sst-oiml-base`

The environmental conditions foundation for **every** Primmel SST instrument.

Maps to **OIML D 11 Edition 13** (`mn-samples-oiml/sources/d011-e13`). Every
condition class the standard defines — climatic, mechanical, electromagnetic,
vehicle-supply — lives here as one YAML file under `conditions/`. Canonical
chamber programs (the time-dependent profiles) live under `profiles/`.

Instrument kind packages (e.g. `primmel-sst-r60`) reference this base and
declare which conditions apply to their kind; instrument instance packages
declare the per-sample coefficients that translate each condition into a
physical effect on that specific instrument.

## Directory layout

```
conditions/
  dry-heat.yaml                  one file per D 11 condition class
  cold.yaml                      (~35 total when complete)
  damp-heat-cyclic.yaml
  …
profiles/
  damp-heat-cyclic-db.yaml       the canonical time programs
  dry-heat-bb.yaml               (keyframes + ramp constraints)
  cold-aa.yaml
  …
```

## Each condition file declares

- `kind`: `steady` | `cyclic` | `transient`
- `classification`: `influence` | `disturbance` (D 11 §2)
- `iec_standard`: the underlying IEC/ISO method reference
- `d11_table`: the D 11 Ed 13 table number
- `severity_levels`: numeric table mapping level → parameters
- `applicability`: which instrument classes are subjected (e.g. electronic-only)

## Status

Phase 1 of the SST migration. Initial subset of conditions authored; the
remaining ~25 will land incrementally. The runtime loads whatever is
present and warns about referenced-but-missing conditions.
