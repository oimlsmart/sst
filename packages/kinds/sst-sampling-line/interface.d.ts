// sst-sampling-line — the contract every sampling-line instance's behavior.js
// must satisfy.
//
// The sampling line is the physical chain that transports a gas sample from
// the source to the analyzer (R 144-1 §2.1 extractive systems). It is a
// COMPONENT of a composite gas-analytical system, not a standalone measuring
// instrument — though it boots standalone (spec §13) for unit testing.
//
// The physics is a transport-delay queue + leak dilution: gas entering the
// line at time t exits at time t + transportDelayS, blended toward ambient
// by the leak fraction. When the flow drops below the declared minimum, the
// interlock faults the line — the runtime's composite state rule reads this
// fault to drive the composite's operationalState.
//
// COUPLING PORTS (read by the composite runtime):
//   inlet_composition  — INPUT.  What the line receives from upstream
//                        (the gas source).
//   outlet_composition — OUTPUT. What the line delivers downstream
//                        (the analyzer's inlet). Decays toward ambient
//                        when the line is faulted (no fresh sample).

import type { VirtualClock, Qty, Environment, WorldContext } from '@primmel/sst-runtime/world'

/** The gas mixture at a port (inlet or outlet). Units: ppm for trace gases
 *  (CO, NO, NOx), percent-vol for interferents (CO2, H2O). Optional fields
 *  let callers set only what's changing; the line preserves the rest. */
export interface GasComposition {
  coPpm?: number
  noxPpm?: number
  no2Fraction?: number
  co2PercentVol?: number
  h2oPercentVol?: number
}

/** The served snapshot of the gas mixture at the outlet (the analyzer-facing
 *  registers). Mirrors GasComposition but every field is present — the twin
 *  serves a complete composition, not a partial update. */
export interface ServedGasComposition {
  coPpm: number
  noxPpm: number
  no2Fraction: number
  co2PercentVol: number
  h2oPercentVol: number
}

/** The line's view of its own state — /world only. */
export interface SamplingLineGroundTruth {
  clockS: number
  environment: Environment
  flowLPerMin: number
  lineTemperatureDegC: number
  leakFraction: number
  transportDelayS: number
  faulted: boolean
  inletComposition: ServedGasComposition
  outletComposition: ServedGasComposition
}

export interface SamplingLineInstrument {
  // ── TwinInstrumentView (the legal view — what /twin serves) ──────────
  sampleFlow(): Qty
  linePressure(): Qty
  gasTemperature(): Qty
  transportDelay(): Qty
  outletComposition(): ServedGasComposition
  servedAt(): number
  operationalState(): 'ok' | 'fault'
  environment(): Environment

  // ── Coupling ports (read by the composite runtime) ──────────────────
  /** Replace the inlet composition (the source). Called by the runtime
   *  each tick when wired into a composite; called directly by the line's
   *  own setInletComposition world mutation when booted standalone. */
  setInletComposition(c: GasComposition): void
  /** The current inlet (what's at the line's input). */
  inletComposition(): ServedGasComposition

  // ── WorldInstrument (the physical world — /world only) ──────────────
  setFlowRate(lPerMin: number): void
  setLineTemperature(degC: number): void
  introduceLeak(fraction: number): void
  setEnvironment(e: Partial<Environment>): void
  injectFault(): void
  clearFault(): void
  reset(): void
  groundTruth(): SamplingLineGroundTruth
}

export interface SamplingLineDefinition {
  id: string
  designParameters: {
    lineVolumeL: number
    nominalFlowLPerMin: number
    minimumFlowLPerMin: number
    ambientComposition: ServedGasComposition
  }
  coefficients: SamplingLineCoefficients
}

export interface SamplingLineCoefficients {
  /** Transport delay at nominal flow (s). The line's transportDelayS =
   *  lineVolumeL / flowLPerMin, but capped at this value when flow is
   *  below minimum (no fresh sample to displace). */
  nominalTransportDelayS: number
  /** Rate at which the line's outlet decays toward ambient when the line
   *  is faulted (per second). 1.0 = instant; 0.01 = slow diffusion. */
  stagnationRatePerS: number
  /** Rate at which the outlet follows the inlet under steady flow
   *  (per second). The transport delay is a queue; this is the smoothing
   *  coefficient applied at the outlet face. */
  responseTauS: number
}

export interface SamplingLineBehavior {
  create(def: SamplingLineDefinition, clock: VirtualClock, seed: number): SamplingLineInstrument
  handlers: {
    setFlowRate:       (ctx: WorldContext<SamplingLineInstrument>, args: { lPerMin: number }) => void
    setLineTemperature:(ctx: WorldContext<SamplingLineInstrument>, args: { degC: number }) => void
    introduceLeak:     (ctx: WorldContext<SamplingLineInstrument>, args: { fraction: number }) => void
    setInletComposition: (ctx: WorldContext<SamplingLineInstrument>, args: GasComposition) => void
  }
}
