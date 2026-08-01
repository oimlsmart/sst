// ACME CGM-200 sampling-line behavior.
// Implements the sst-sampling-line kind's SamplingLineBehavior interface.
//
// The physics is a transport-delay queue + leak dilution + stagnation fault:
//
//   inlet composition (set by the user or runtime coupling)
//     → queued for transportDelayS = lineVolume / flow
//     → popped when its timestamp ages past transportDelayS
//     → blended toward ambient by leakFraction (dilution)
//     → if faulted: decayed toward ambient at stagnationRate per second
//     → outlet composition (read by the analyzer in a composite)
//
// When flow drops below minimumFlowLPerMin, the line FAULTS — the outlet
// stops following the inlet and decays toward ambient. The composite
// state rule (any_fault_else_analyzer) reads this fault.

import type {
  SamplingLineBehavior,
  SamplingLineDefinition,
  SamplingLineInstrument,
  GasComposition,
  ServedGasComposition,
} from '../../../kinds/sst-sampling-line/interface.d.ts'
import type { VirtualClock, Environment, Qty, WorldContext } from '@primmel/sst-runtime/world'

const DEFAULT_AMBIENT: ServedGasComposition = {
  coPpm: 0.4,
  noxPpm: 0.02,
  no2Fraction: 0.05,
  co2PercentVol: 0.04,
  h2oPercentVol: 1.2,
}

interface QueueEntry {
  t: number
  comp: ServedGasComposition
}

/** Pull a number from the definition with multiple key candidates. */
function pick(def: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = def[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return undefined
}

class SamplingLine implements SamplingLineInstrument {
  readonly #clock: VirtualClock
  readonly #ambient: ServedGasComposition
  readonly #queue: QueueEntry[] = []
  #lineVolumeL: number
  #nominalFlowLPerMin: number
  #minimumFlowLPerMin: number
  #nominalTransportDelayS: number
  #stagnationRatePerS: number
  #responseTauS: number
  #flowLPerMin: number
  #lineTemperatureDegC: number
  #leakFraction: number
  #faulted = false
  #inlet: ServedGasComposition
  #outlet: ServedGasComposition
  #env: Environment = { temperatureDegC: 20, humidityPercentRh: 50, pressureKPa: 101.325 }
  #servedAt = 0

  constructor(def: Record<string, unknown>, clock: VirtualClock) {
    this.#clock = clock
    const dp = (def.designParameters ?? {}) as Record<string, number>
    const coeff = (def.coefficients ?? {}) as Record<string, number>

    this.#lineVolumeL = pick(dp, 'line_volume_l', 'lineVolumeL') ?? 0.05
    this.#nominalFlowLPerMin = pick(dp, 'nominal_flow_l_min', 'nominalFlowLMin', 'nominal_flow_l_per_min', 'nominalFlowLPerMin') ?? 1.5
    this.#minimumFlowLPerMin = pick(dp, 'minimum_flow_l_min', 'minimumFlowLMin', 'minimum_flow_l_per_min', 'minimumFlowLPerMin') ?? 0.5
    this.#nominalTransportDelayS = pick(coeff, 'nominal_transport_delay_s', 'nominalTransportDelayS') ?? 10
    this.#stagnationRatePerS = pick(coeff, 'stagnation_rate_per_s', 'stagnationRatePerS', 'rate_per_s', 'ratePerS') ?? 0.05
    this.#responseTauS = pick(coeff, 'response_tau_s', 'responseTauS') ?? 0.5

    // Construct the ambient composition from the manifest's ambient_* keys
    // (each is optional; defaults fill in).
    this.#ambient = {
      coPpm: pick(dp, 'ambient_co_ppm', 'ambientCoPpm') ?? DEFAULT_AMBIENT.coPpm,
      noxPpm: pick(dp, 'ambient_nox_ppm', 'ambientNoxPpm') ?? DEFAULT_AMBIENT.noxPpm,
      no2Fraction: pick(dp, 'ambient_no2_fraction', 'ambientNo2Fraction') ?? DEFAULT_AMBIENT.no2Fraction,
      co2PercentVol: pick(dp, 'ambient_co2_percent', 'ambientCo2Percent', 'ambient_co2_percent_vol', 'ambientCo2PercentVol') ?? DEFAULT_AMBIENT.co2PercentVol,
      h2oPercentVol: pick(dp, 'ambient_h2o_percent', 'ambientH2oPercent', 'ambient_h2o_percent_vol', 'ambientH2oPercentVol') ?? DEFAULT_AMBIENT.h2oPercentVol,
    }

    this.#flowLPerMin = (coeff.flow_l_per_min as number | undefined) ?? this.#nominalFlowLPerMin
    this.#lineTemperatureDegC = 20
    this.#leakFraction = (coeff.default_leak_fraction as number | undefined) ?? (coeff.leak_fraction as number | undefined) ?? 0
    this.#inlet = { ...this.#ambient }
    this.#outlet = { ...this.#ambient }

    clock.onAdvance(dt => this.#tick(dt))
  }

  // ── TwinInstrumentView (served registers) ─────────────────────────────

  sampleFlow(): Qty { return { value: this.#flowLPerMin, unit: 'L/min', kind: 'volume-flow-rate' } }
  linePressure(): Qty {
    const inletKpa = 101.325
    const dropPerLPerMin = 2.0
    return { value: inletKpa - dropPerLPerMin * this.#flowLPerMin, unit: 'kPa', kind: 'pressure' }
  }
  gasTemperature(): Qty { return { value: this.#lineTemperatureDegC, unit: '°C', kind: 'temperature' } }
  transportDelay(): Qty {
    return { value: this.#computeTransportDelayS(), unit: 's', kind: 'time' }
  }
  outletComposition(): ServedGasComposition { return { ...this.#outlet } }
  servedAt(): number { return this.#servedAt }
  operationalState(): 'ok' | 'fault' { return this.#faulted ? 'fault' : 'ok' }
  environment(): Environment { return { ...this.#env } }

  // ── Coupling ports ───────────────────────────────────────────────────

  setInletComposition(c: GasComposition): void {
    if (c.coPpm != null) this.#inlet.coPpm = c.coPpm
    if (c.noxPpm != null) this.#inlet.noxPpm = c.noxPpm
    if (c.no2Fraction != null) this.#inlet.no2Fraction = c.no2Fraction
    if (c.co2PercentVol != null) this.#inlet.co2PercentVol = c.co2PercentVol
    if (c.h2oPercentVol != null) this.#inlet.h2oPercentVol = c.h2oPercentVol
  }
  inletComposition(): ServedGasComposition { return { ...this.#inlet } }

  // ── WorldInstrument (mutators — /world only) ─────────────────────────

  setFlowRate(lPerMin: number): void {
    if (!(lPerMin >= 0)) throw new Error(`flow rate must be ≥ 0, got ${lPerMin}`)
    this.#flowLPerMin = lPerMin
  }
  setLineTemperature(degC: number): void { this.#lineTemperatureDegC = degC }
  introduceLeak(fraction: number): void {
    if (!(fraction >= 0 && fraction <= 1)) throw new Error(`leak fraction must be in 0..1, got ${fraction}`)
    this.#leakFraction = fraction
  }
  setEnvironment(e: Partial<Environment>): void { this.#env = { ...this.#env, ...e } }
  injectFault(): void { this.#faulted = true }
  clearFault(): void { this.#faulted = false }
  reset(): void {
    this.#queue.length = 0
    this.#inlet = { ...this.#ambient }
    this.#outlet = { ...this.#ambient }
    this.#leakFraction = 0
    this.#faulted = false
  }

  groundTruth() {
    return {
      clockS: this.#clock.now(),
      environment: this.#env,
      line: {
        flowLPerMin: this.#flowLPerMin,
        lineTemperatureDegC: this.#lineTemperatureDegC,
        leakFraction: this.#leakFraction,
        transportDelayS: this.#computeTransportDelayS(),
        faulted: this.#faulted,
      },
      inletComposition: { ...this.#inlet },
      outletComposition: { ...this.#outlet },
    }
  }

  // ── The signal chain (called on each clock advance) ──────────────────

  #tick(dt: number): void {
    const now = this.#clock.now()

    // 1. Update the interlock: flow below the minimum faults the line;
    //    flow restored above the minimum CLEARS the latch (auto-recovery
    //    — the acceptance suite's restore leg expects the composite state
    //    to return to the analyzer's state without an explicit clearFault).
    if (this.#flowLPerMin < this.#minimumFlowLPerMin) {
      this.#faulted = true
    } else if (this.#faulted && this.#flowLPerMin >= this.#minimumFlowLPerMin) {
      this.#faulted = false
    }

    // 2. Compute the target outlet:
    //    - If faulted: target = ambient (no fresh sample).
    //    - Else: target = inlet (the line carries the sample through;
    //      the transport delay is a reported value, not a discrete
    //      queue — the steady-state outlet tracks the inlet directly,
    //      smoothed by response_tau_s).
    let target: ServedGasComposition
    if (this.#faulted) {
      // Decay outlet toward ambient at the stagnation rate.
      const decay = 1 - Math.exp(-this.#stagnationRatePerS * dt)
      target = this.#blend(this.#outlet, this.#ambient, decay)
    } else {
      // Apply leak dilution to the inlet, then smooth toward it.
      const diluted = this.#blend(this.#inlet, this.#ambient, this.#leakFraction)
      if (this.#responseTauS > 0 && dt < this.#responseTauS * 100) {
        const a = 1 - Math.exp(-dt / this.#responseTauS)
        target = this.#blend(this.#outlet, diluted, a)
      } else {
        // dt >> tau: steady state, outlet = diluted inlet.
        target = diluted
      }
    }

    this.#outlet = target
    this.#servedAt = now
  }

  #computeTransportDelayS(): number {
    if (this.#flowLPerMin <= 0) return this.#nominalTransportDelayS
    return Math.min(this.#nominalTransportDelayS, (this.#lineVolumeL / this.#flowLPerMin) * 60)
  }

  #blend(a: ServedGasComposition, b: ServedGasComposition, f: number): ServedGasComposition {
    const g = (x: number, y: number) => x * (1 - f) + y * f
    return {
      coPpm: g(a.coPpm, b.coPpm),
      noxPpm: g(a.noxPpm, b.noxPpm),
      no2Fraction: a.no2Fraction * (1 - f) + b.no2Fraction * f,
      co2PercentVol: g(a.co2PercentVol, b.co2PercentVol),
      h2oPercentVol: g(a.h2oPercentVol, b.h2oPercentVol),
    }
  }
}

export const create = (
  def: Record<string, unknown>,
  clock: VirtualClock,
  _seed: number,
): SamplingLineInstrument => {
  return new SamplingLine(def, clock)
}

export const handlers: SamplingLineBehavior['handlers'] = {
  setFlowRate:           (ctx: WorldContext<SamplingLineInstrument>, a: { lPerMin: number }) => ctx.instrument.setFlowRate(a.lPerMin),
  setLineTemperature:    (ctx: WorldContext<SamplingLineInstrument>, a: { degC: number }) => ctx.instrument.setLineTemperature(a.degC),
  introduceLeak:         (ctx: WorldContext<SamplingLineInstrument>, a: { fraction: number }) => ctx.instrument.introduceLeak(a.fraction),
  setInletComposition:   (ctx: WorldContext<SamplingLineInstrument>, a: GasComposition) => ctx.instrument.setInletComposition(a),
}

export default { create, handlers }
