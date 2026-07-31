# TODO 16 — Certification verdict layer (MPE enforcement)

**Priority:** P0   **Status:** ✅ done

## Goal

The kind's `mpe.yaml` declares the per-class MPE envelope. Nobody checks it. This TODO builds a **certification verdict layer** — a third-actor component that samples `/twin` and `/world` at scheduled probe points, computes the error, compares against the MPE, and emits pass/fail verdicts.

This is the platform's value proposition: the sim demonstrates both a passing instrument and a failing one, and a certification engine can be tested against both.

## Deliverables

- `packages/runtime/sst-runtime/src/certification/verdict.ts` — `CertificationEngine` class
- `packages/runtime/sst-runtime/src/certification/probe-scheduler.ts` — schedules probe points per R 60-2
- `packages/runtime/sst-runtime/src/certification/report.ts` — emits a structured test report (JSON)
- GraphQL endpoint: `/certification` — exposes verdicts in real time

## Acceptance criteria

- Running `good-cell` → verdict: PASS (all probes conforming)
- Running `creep-cell` → verdict: FAIL (creep test probe exceeds MPE at 28 min)
- Running `lying-twin` → verdict: FAIL (served vs reference exceeds MPE)
- The report identifies which specific probe failed and by how much
