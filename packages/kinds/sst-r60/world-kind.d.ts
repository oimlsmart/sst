// world-kind.d.ts — the R 60 kind's typed /world mutation surface.
//
// Each kind declares its wire-shape mutations here. The runtime's
// WorldDriver<K> uses this type to give callers compile-time-checked
// method calls. The world-kind.yaml is the runtime data; this file is
// the compile-time type — kept in sync by the kind's tests.
//
// The mutation names mirror world-kind.yaml's `mutations:` keys. The
// argument shapes mirror the handlers' args (see interface.d.ts).

import type { WorldState } from '@primmel/sst-runtime/world/types'

/** The R 60 /world mutations — one method per entry in world-kind.yaml. */
export interface R60WorldMutations {
  placeLoad(args: { massKg: number }): Promise<WorldState>
  removeLoad(): Promise<WorldState>
  setFidelity(args: { servedOffsetKg?: number; servedLagS?: number }): Promise<WorldState>
  fidelityReset(): Promise<WorldState>
  setThermalHysteresis(args: { perDegC: number; tauS?: number }): Promise<WorldState>
}
