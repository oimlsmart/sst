# TODO 32 — SI-traceability metadata (BIPM Digital SI Framework + UnitsML)

**Priority:** P1   **Status:** ✅ done

## Goal

Model the SI-traceability chain that every certified measurement must
carry (VIM §2.42 metrological traceability): instrument → reference
standard → national standard → SI base unit. Surface the chain in the
R 60-2 test report. The SI model itself uses the canonical BIPM Digital
SI Framework (units identified by URI) with UnitsML composition — not
ad-hoc string tags.

## What landed

- `packages/runtime/sst-runtime/src/certification/units.ts` — the BIPM
  Digital SI Framework + UnitsML unit model:
  - `SI_BASE_UNITS`: the 7 SI base units, each with its canonical BIPM
    URI (`https://si-digital-framework.org/SI/units/<name>`), its
    UnitsML dimension vector in SI Brochure v9 order
    [L, M, T, I, Θ, N, J], and its BIPM quantity-kind URI.
  - `composeUnit(parts, siUri, quantityKindUri, prefix?)` — UnitsML
    product composition for derived units (newton, pascal, joule, watt,
    or custom). The dimension vector is the linear combination of the
    base units' dimensions weighted by their exponents.
  - `SI_DERIVED_UNITS`: the 4 common derived units used in instrument
    physics (force, pressure, energy, power).
  - `dimensionallyConsistent(a, b)` — the UnitsML dimensional check
    that gates calibration-chain validity.
  - `lookupUnit(uri)` — base + derived unit lookup by BIPM URI.

- `packages/runtime/sst-runtime/src/certification/traceability.ts` —
  the calibration chain:
  - `TraceabilityLink` carries a `unit: UnitsMLUnit` (BIPM URI + dim
    + quantity kind), certificate, laboratory, accreditation, dates,
    uncertainty (k=2), and the next-up pointer.
  - `buildChain(startId, known, today?)` walks nextUp pointers from a
    starting link to an SI base unit, validating: cycles, broken
    references, dimensional consistency between consecutive links
    (BIPM requirement — a kg chain can't link to a K standard),
    expiry, and termination in an actual SI base unit.
  - `SI_UNIT_LINKS`: terminus links for each of the 7 SI base units
    (zero uncertainty, BIPM-calibrated, 2019-05-20 SI redefinition).
  - `buildR60DefaultChain()`: the canonical 4-link LC-500 chain
    (instrument → working → NMI reference → BIPM kilogram).
  - `toReportBlock(chain)`: the wire shape that goes into the R 60-2
    report (BIPM URIs verbatim, no slugs).

- `packages/runtime/sst-runtime/src/certification/r602-report.ts` —
  `formatR602Report()` accepts an optional `TraceabilityReportBlock`.
  Reports carry `traceability: null` when no chain is supplied.

## Why BIPM Digital SI Framework + UnitsML (not naive slugs)

An earlier draft of this TODO used a `SiUnit` string union and made-up
slugs like `'si:kilogram'`. The user corrected this on 2026-07-30: SI
references must use the BIPM Digital SI Framework (canonical unit
identification by URI) and UnitsML (canonical unit composition by
dimension vector + base-unit products). The BIPM framework is the
authoritative machine-readable SI; UnitsML is the standard
unit-composition markup. Anything else is non-canonical and breaks
interop with NMI infrastructure. Saved as
[[si-traceability-uses-bipm-digital-si-framework-and-unitsml]] feedback
memory.

## Acceptance criteria

- ✅ All 7 SI base units carry canonical BIPM Digital SI Framework URIs.
- ✅ Dimension vectors are SI Brochure v9 7-tuples [L, M, T, I, Θ, N, J].
- ✅ Derived units compose via UnitsML product formula (`composeUnit`).
- ✅ `dimensionallyConsistent` detects mismatched dimensions.
- ✅ `buildChain` validates cycles, broken refs, expiry, termination.
- ✅ `buildChain` rejects dimensional inconsistency between consecutive
  links (a kg chain linking to a kelvin standard is rejected).
- ✅ The R 60-2 report carries the BIPM-URI-keyed traceability block.
- ✅ `formatR602Report` without a chain emits `traceability: null`.
- ✅ 19 tests in `tests/traceability.test.ts`; 127/127 runtime.
