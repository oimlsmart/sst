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
  /** The load application device (R 60-2, 2.7.2 — the force-generating
   *  system): ramp toward the nominal setpoint; the cell feels the
   *  machine's realized load. */
  ladApply(args: { loadKg: number; rateKgPerS?: number }): Promise<WorldState>
  ladRelease(args?: { rateKgPerS?: number }): Promise<WorldState>
  ladConfigure(args: { capacityKg?: number; classFraction?: number; repeatabilityFraction?: number; defaultRateKgPerS?: number }): Promise<WorldState>
  /** The climatic chamber (R 60-3, 4.10.3/4.10.4): ramp/soak/hold; the
   *  cell soaks after the air per its own thermal constants. */
  chamberSet(args: { temperatureDegC: number; humidityPercentRh?: number }): Promise<WorldState>
  chamberOff(): Promise<WorldState>
  chamberConfigure(args: { tempRampDegCPerMin?: number; tempStabilityDegC?: number; tempOvershootDegC?: number; humidityControl?: boolean; humidityRampPercentRhPerMin?: number; humidityStabilityPercentRh?: number }): Promise<WorldState>
  /** The bench's indicating instrument (analogue-passive pairings only). */
  indicatorConfigure(args: { gainErrorFraction?: number; offsetKg?: number; scaleIntervalKg?: number; noiseSigmaKg?: number }): Promise<WorldState>
  setFidelity(args: { servedOffsetKg?: number; servedLagS?: number }): Promise<WorldState>
  fidelityReset(): Promise<WorldState>
  setThermalHysteresis(args: { perDegC: number; tauS?: number }): Promise<WorldState>
}
