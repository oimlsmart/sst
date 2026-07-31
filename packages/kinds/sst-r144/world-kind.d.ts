// world-kind.d.ts — the R 144 kind's typed /world mutation surface.
// See packages/kinds/sst-r60/world-kind.d.ts for the rationale.

import type { WorldState } from '@primmel/sst-runtime/world/types'

/** The R 144 /world mutations — one method per entry in world-kind.yaml. */
export interface R144WorldMutations {
  setGasConcentration(args: { component: 'co' | 'nox'; ppm: number }): Promise<WorldState>
  setNo2Fraction(args: { fraction: number }): Promise<WorldState>
  setInterferents(args: { interferent: 'co2' | 'h2o'; ppm: number }): Promise<WorldState>
  setSampleFlow(args: { lMin: number }): Promise<WorldState>
  setOpticsContamination(args: { fraction: number }): Promise<WorldState>
  setSourceAgingRate(args: { perDay: number }): Promise<WorldState>
  setSampleLineLeak(args: { fraction: number }): Promise<WorldState>
  zeroCalibration(): Promise<WorldState>
  spanCalibration(args: { spanGasPpm: number }): Promise<WorldState>
}
