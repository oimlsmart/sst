// world-kind.d.ts — the R 129 kind's typed /world mutation surface.
// See packages/kinds/sst-r60/world-kind.d.ts for the rationale.

import type { WorldState } from '@primmel/sst-runtime/world/types'

/** The R 129 /world mutations — one method per entry in world-kind.yaml. */
export interface R129WorldMutations {
  setConveyorSpeed(args: { mPerS: number }): Promise<WorldState>
  feedObject(args: { lengthCm?: number; widthCm?: number; heightCm?: number; weightKg?: number }): Promise<WorldState>
  clearObject(): Promise<WorldState>
  setAmbientLight(args: { lux: number }): Promise<WorldState>
  setEmi(args: { vPerM: number }): Promise<WorldState>
  setBeamOccluded(args: { fraction: number }): Promise<WorldState>
  setEncoderSlip(args: { fraction: number }): Promise<WorldState>
  setScannerTilt(args: { deg: number }): Promise<WorldState>
  setThermalResidual(args: { perDegC: number }): Promise<WorldState>
  driveFeed(args: { name: string }): Promise<WorldState>
  stopFeed(): Promise<WorldState>
}
