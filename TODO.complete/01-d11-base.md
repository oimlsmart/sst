# TODO 01 — Finish D 11 base package (22 missing conditions)

**Priority:** P1   **Status:** ✅ done   **Blocks:** nothing   **Blocked by:** nothing

## Goal

Complete `packages/base/sst-oiml-base/conditions/` to cover all 35 D 11
Edition 13 condition classes (the canonical list in
`package.sst.yaml:condition_classes`). Today 13/35 are authored; the
remaining 22 cover water, sand/dust, salt mist, sinusoidal vibration,
the steady/transient electrical conditions, the signal-line EMC, and the
vehicle-supply variants.

Each condition file is data only — no code. The runtime consumes them
uniformly via the kind-agnostic loader (TODO 02).

## Deliverables

One YAML file per missing condition, under
`packages/base/sst-oiml-base/conditions/`. The 22 to author:

**Climatic** (4):
- `water.yaml` — IEC 60068-2-18, table 10
- `sand-and-dust.yaml` — IEC 60512-11-8, table 13
- `salt-mist.yaml` — IEC 60068-2-11, table 14

**Mechanical** (1):
- `vibration-sinusoidal.yaml` — IEC 60068-2-6, table 16

**Electromagnetic — steady** (4):
- `dc-mains-voltage-variation.yaml` — IEC 60654-2, table 18
- `ripple-on-dc-mains.yaml` — IEC 61000-4-17, table 19
- `ac-mains-voltage-variation.yaml` — IEC 61000-4-1, table 20
- `ac-mains-frequency-variation.yaml` — IEC 61000-4-1, table 21

**Electromagnetic — transients** (6):
- `dc-mains-voltage-dips.yaml` — IEC 61000-4-29, table 22
- `ac-mains-harmonics.yaml` — IEC 61000-4-13, table 24
- `vlf-lf-disturbances.yaml` — IEC 61000-4-19, table 25
- `bursts-on-signal-lines.yaml` — IEC 61000-4-4, table 28
- `surges-on-signal-lines.yaml` — IEC 61000-4-5, table 29
- `mains-power-frequency-em-field.yaml` — IEC 61000-4-8, table 30

**Electromagnetic — RF** (3):
- `conducted-rf-currents.yaml` — IEC 61000-4-6, table 31
- `rf-fields-general-origin.yaml` — IEC 61000-4-3, table 33
- `rf-fields-digital-radio.yaml` — IEC 61000-4-3, table 34

**Vehicle supply** (6):
- `low-battery-voltage.yaml` — table 36
- `vehicle-battery-variation.yaml` — ISO 16750-2, table 37
- `vehicle-supply-transients.yaml` — ISO 7637-2, table 38
- `vehicle-non-supply-transients.yaml` — ISO 7637-3, table 39
- `battery-cranking-variation.yaml` — ISO 16750-2, table 40
- `load-dump.yaml` — ISO 16750-2, table 41

## File shape (mandatory)

```yaml
id: <kebab-case-id>                 # matches the manifest's condition_classes entry
title: <human title>
kind: steady | cyclic | transient
classification: influence | disturbance
iec_standard: [<refs>]
d11_table: <n>
d11_section: "<x.y>"
applicability: [electronic | non-electronic | vehicle-powered]
description: >
  <one paragraph — what the condition is, how it acts on the instrument>
severity_levels:
  - { level: <n>, <parameters>, preferred: true|false }
constraints:
  <key>: <value>
```

Source of truth for severity values: `/Users/mulgogi/src/mn/mn-samples-oiml/sources/d011-e13/sections/08-performance-tests.adoc` (Tables 5-41) and `09-climate-tests.adoc` / `10-mechanical-tests.adoc` / `12-electromagnetic.adoc` / `13-battery-tests.adoc`.

## Steps

1. For each missing condition, open the corresponding D 11 source section.
2. Extract severity table values; mark preferred levels (`preferred: true`).
3. Determine `kind` from the test method (steady = hold; cyclic = repeating program; transient = single event).
4. Determine `classification` from D 11 §2 (within rated → influence; outside → disturbance).
5. Author the YAML; validate schema against the existing files' shape.
6. Append any new `profiles/*.yaml` needed (e.g. `vibration-random-sweep.yaml` if a sweep profile is canonical).

## Acceptance criteria

- All 35 condition files present and validate.
- A grep for `preferred: true` returns at least one entry per condition.
- Every condition has its `iec_standard` populated (even if `[]` for the Annex C ones — those have an explanatory comment).
- A test in TODO 10 (tests) confirms every condition file matches the JSON Schema in TODO 09 (specs).

## Design notes

- **No code in this tier.** Each file is pure data; the runtime interprets.
- **Influence vs disturbance is the load-bearing classification** — the runtime applies influence as continuous coefficients, disturbance as fault-latching events. Mislabeling a transient as `influence` produces wrong behavior.
- **Severity levels are numeric** — no named codes. The instance package picks a level by index.
- **Applicability** filters which conditions apply to which instrument classes. A non-electronic instrument (mechanical balance) skips all EMC; a vehicle-powered instrument gets the vehicle-supply block.
