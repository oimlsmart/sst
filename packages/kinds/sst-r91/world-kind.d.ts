// world-kind.d.ts — the R 91 kind's typed /world mutation surface.
// See packages/kinds/sst-r60/world-kind.d.ts for the rationale.

import type { WorldState } from '@primmel/sst-runtime/world/types'

/** The R 91 /world mutations — one method per entry in world-kind.yaml. */
export interface R91WorldMutations {
  setTarget(args: { speedKmh: number; rangeM?: number; angleDeg?: number }): Promise<WorldState>
  clearTarget(): Promise<WorldState>
  setRain(args: { mmPerH: number }): Promise<WorldState>
  setVibration(args: { g: number }): Promise<WorldState>
  setEmi(args: { vPerM: number }): Promise<WorldState>
  setOscillatorDrift(args: { ppm: number }): Promise<WorldState>
  setAntennaMisalignment(args: { deg: number }): Promise<WorldState>
  setInterferenceSource(args: { freqGhz: number; powerDbm: number }): Promise<WorldState>
  clearInterferenceSource(): Promise<WorldState>
  driveProfile(args: { name: string }): Promise<WorldState>
  stopProfile(): Promise<WorldState>
}
