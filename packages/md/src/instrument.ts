// instrument.ts — the multi-dimensional measuring instrument composition
// root (the family stage set: object + transport → optical scanning →
// dimension computation). The epistemic wall (law 1) is here:
// dimensionsCm()/volumeCm3()/dimWeightKg()/servedAt()/operationalState()/
// environment() are the instrument's legal view (the TwinInstrumentView
// seam); groundTruth() is reality, exposed to /world only. Every fault
// and environment effect realizes THROUGH the physics stages — there is
// no indication override path.
import type { VirtualClock } from '@primmel/sst-runtime/time'
import { qty, type Qty } from '@primmel/sst-runtime/physics/quantity'
import { normal } from '@primmel/sst-runtime/physics/rng'
import { REFERENCE_ENVIRONMENT, type Environment } from '@primmel/sst-runtime/instrument'
import {
  beginTraversal, advanceTraversal, traversalComplete, validateObjectSpec,
  type ConveyorObjectSpec, type Traversal,
} from './physics/geometry.js'
import {
  scanObject, thermalSpanFrac, type ScanningParams, type RawMeasurement,
} from './physics/scanning.js'
import { computeMeasurement, type ComputationParams, type ComputedMeasurement } from './physics/computation.js'
import { ObjectFeedPlayer, type FeedKeyframe } from './driver.js'

export type { ConveyorObjectSpec }

export interface MdParameters extends ScanningParams, ComputationParams {
  /** warm-up time constant (s); ready after 5τ (the load-cell idiom). */
  warmUpTauS: number
  /** the declared measuring-speed range (m/s) — V_min…V_max (R 129-1,
   *  2.1.10/2.1.11); the speed-of-movement test exercises both bounds. */
  vMinMS: number
  vMaxMS: number
  /** EMI severity at which the fault detector trips (the disturbance
   *  reaction — an automatic instrument is made inoperative
   *  automatically, R 129-1, 4.3.1/5.6.1). */
  emiFaultSeverity: number
  /** the checking facility's internal-reference bound (cm): beyond it
   *  the diagnostics report a fault (the self_test behavior's legal
   *  outcome). */
  selfTestBoundCm: number
  /** the internal reference gauge the self-test measures (cm). */
  refGaugeCm: number
  /** belt-encoder slip (fraction) — an instrument fault: the length
   *  scales with it (the /world fault knob retunes it live). */
  encoderSlipFrac: number
  /** scan-head tilt (deg) — an instrument fault: width/height bias
   *  with the object height. */
  scannerTiltDeg: number
  /** the post-temperature-cycle residual span error (fraction) — the
   *  configurable post-cycle difference (the standing sim doctrine). */
  thermalResidualFrac: number
}

/** The dimensioner's physical world (reality — /world only). */
export interface MdWorldState {
  /** true belt speed (m/s). */
  conveyorSpeedMS: number
  /** ambient light on the measuring area (lx). */
  ambientLx: number
  /** electromagnetic disturbance severity (D 11; 0 = none). */
  emiSeverity: number
  /** the light curtain is blocked (a disturbance event). */
  beamOccluded: boolean
}

export interface MdDefinition {
  id: string
  parameters: MdParameters
  /** the initial world the instrument boots into (a scenario's bench
   *  setup — e.g. high-ambient-light carries the lux level). */
  world?: Partial<MdWorldState>
}

/** The reference optical automatic conveyor dimensioner — the
 *  MD-350-class instrument: light-section scanning over the conveyor,
 *  d = 0.5 cm, per-axis 5–250 × 5–120 × 5–180 cm, V_min…V_max
 *  0.1–1.5 m/s, −10…+40 °C (per the acme-md3xx product package). All
 *  coefficients inside R 129 limits. */
export const MD350_GOOD: MdDefinition = {
  id: 'md350-ref-good',
  parameters: {
    scaleIntervalCm: 0.5, minDimCm: 5, maxLCm: 250, maxWCm: 120, maxHCm: 180,
    convFactorCm3PerKg: 5000, vMinMS: 0.1, vMaxMS: 1.5,
    scanRateHz: 200,
    edgeSigmaRefCm: 0.03, widthSigmaRefCm: 0.03, heightSigmaRefCm: 0.03,
    reflectanceRef: 0.9, ambientLxRef: 100, ambientNoiseGain: 0.5,
    frameAlphaFracPerDegC: 0.000023, referenceTempDegC: 20,
    warmUpTauS: 60,
    emiFaultSeverity: 3, selfTestBoundCm: 0.4, refGaugeCm: 50,
    encoderSlipFrac: 0, scannerTiltDeg: 0, thermalResidualFrac: 0,
  },
  world: { conveyorSpeedMS: 1.0 },
}

export const MD_META = {
  designation: 'reference optical multi-dimensional measuring instrument (R 129, automatic)',
  manufacturer: 'sim-instruments reference (fictional)',
  measurementPrinciple: 'optical (light-section)',
  instrumentCategory: 'automatic',
  scaleIntervalCm: 0.5,
  speedRangeMS: [0.1, 1.5] as const,
  /** The accuracy declaration: the per-axis MPE ±1.0 d (R 129-1, 4.1.2). */
  mpePerAxis: { inD: 1.0, source: 'R 129-1, 4.1.2' },
  productPackage: 'primmel-packages/acme-md3xx (smart repo, feat/acme-md-package)',
} as const

/** The per-axis MPE in cm (±1.0 d). */
export function mpePerAxisCm(p: MdParameters): number {
  return MD_META.mpePerAxis.inD * p.scaleIntervalCm
}

const DEFAULT_WORLD: MdWorldState = {
  conveyorSpeedMS: 1.0, ambientLx: 100, emiSeverity: 0, beamOccluded: false,
}

function initialWorld(def: MdDefinition): MdWorldState {
  return { ...DEFAULT_WORLD, ...def.world }
}

export interface MdReading {
  valid: boolean
  /** 'ok' | 'below-min' | 'beyond-max' | 'occluded' | 'disturbance' | 'warming' */
  reason: string
  measuredLengthCm: number
  measuredWidthCm: number
  measuredHeightCm: number
  indicatedLengthCm: number
  indicatedWidthCm: number
  indicatedHeightCm: number
  dimVolumeCm3: number
  dimWeightKg: number
  protrusionMissed: boolean
  quantizationCm: number
}

export interface MdGroundTruth {
  clockS: number
  environment: Environment
  conveyorSpeedMS: number
  object: (ConveyorObjectSpec & { positionM: number }) | null
  ambientLx: number
  emiSeverity: number
  beamOccluded: boolean
  encoderSlipFrac: number
  scannerTiltDeg: number
  thermalResidualFrac: number
  /** the current total fractional span error (frame expansion + the
   *  post-cycle residual) — reality, /world only. */
  thermalSpanFrac: number
  lastReading: MdReading | null
}

interface Held {
  l: number; w: number; h: number; dv: number; dw: number
}

export class MultiDimensionalInstrument {
  #def: MdDefinition
  #params: MdParameters // own copy — world retunes must never mutate the shared definition record
  #clock: VirtualClock
  #normal: () => number
  #env: Environment = { ...REFERENCE_ENVIRONMENT }
  #world: MdWorldState
  #poweredAt = 0
  #state: 'warming' | 'ready' | 'measuring' = 'warming'
  #faultLatched = false
  #traversal: Traversal | undefined
  #disturbed = false // occlusion/EMI seen mid-traversal (the checking facility's input)
  #held: Held = { l: 0, w: 0, h: 0, dv: 0, dw: 0 }
  #lastReading: MdReading | null = null
  #feed: ObjectFeedPlayer | undefined

  constructor(def: MdDefinition, clock: VirtualClock, rng: () => number) {
    this.#def = def
    this.#params = { ...def.parameters }
    this.#clock = clock
    this.#normal = normal(rng)
    this.#world = initialWorld(def)
    this.#poweredAt = clock.now()
    clock.onAdvance(dt => this.#tick(dt))
  }

  #tick(dt: number): void {
    if (this.#state === 'warming' && this.#clock.now() - this.#poweredAt >= 5 * this.#params.warmUpTauS) this.#state = 'ready'
    const t = this.#traversal
    if (!t) return
    advanceTraversal(t, this.#world.conveyorSpeedMS, dt)
    if (this.#world.beamOccluded || this.#world.emiSeverity >= this.#params.emiFaultSeverity) this.#disturbed = true
    if (traversalComplete(t)) this.#complete(t)
  }

  /** The measurement completes: through the whole stage set (reality
   *  side). A disturbed traversal is a significant fault — the checking
   *  facility trips and the automatic instrument is made inoperative
   *  (R 129-1, 4.3.1/5.6.1). An out-of-limits result is NO fault: the
   *  indication is inhibited (5.2.6) and the last valid reading holds. */
  #complete(t: Traversal): void {
    this.#traversal = undefined
    this.#state = 'ready'
    const p = this.#params
    if (this.#disturbed) {
      const reason = this.#world.emiSeverity >= p.emiFaultSeverity ? 'disturbance' : 'occluded'
      this.#lastReading = {
        valid: false, reason,
        measuredLengthCm: 0, measuredWidthCm: 0, measuredHeightCm: 0,
        indicatedLengthCm: this.#held.l, indicatedWidthCm: this.#held.w, indicatedHeightCm: this.#held.h,
        dimVolumeCm3: this.#held.dv, dimWeightKg: this.#held.dw,
        protrusionMissed: false, quantizationCm: 0,
      }
      this.#disturbed = false
      this.#faultLatched = true
      return
    }
    const raw: RawMeasurement = scanObject(t.spec, {
      conveyorSpeedMS: this.#world.conveyorSpeedMS,
      ambientLx: this.#world.ambientLx,
      temperatureDegC: this.#env.temperatureDegC,
      encoderSlipFrac: p.encoderSlipFrac,
      scannerTiltDeg: p.scannerTiltDeg,
      thermalResidualFrac: p.thermalResidualFrac,
    }, p, this.#normal)
    const c: ComputedMeasurement = computeMeasurement(raw, p)
    this.#lastReading = {
      valid: c.valid, reason: c.reason,
      measuredLengthCm: raw.lengthCm, measuredWidthCm: raw.widthCm, measuredHeightCm: raw.heightCm,
      indicatedLengthCm: c.valid ? c.indicatedLengthCm : this.#held.l,
      indicatedWidthCm: c.valid ? c.indicatedWidthCm : this.#held.w,
      indicatedHeightCm: c.valid ? c.indicatedHeightCm : this.#held.h,
      dimVolumeCm3: c.valid ? c.dimVolumeCm3 : this.#held.dv,
      dimWeightKg: c.valid ? c.dimWeightKg : this.#held.dw,
      protrusionMissed: raw.protrusionMissed, quantizationCm: raw.quantizationCm,
    }
    if (c.valid) {
      this.#held = {
        l: c.indicatedLengthCm, w: c.indicatedWidthCm, h: c.indicatedHeightCm,
        dv: c.dimVolumeCm3, dw: c.dimWeightKg,
      }
    }
  }

  // ── the TwinInstrumentView seam (the instrument's legal view) ────

  /** The core-seam indication: the held length reading, SI (the family
   *  contract serves per-axis registers — never this aggregate). */
  indication(): Qty {
    return qty(this.#held.l / 100, 'm')
  }
  /** The held per-axis indications (cm, rounded to d). */
  dimensionsCm(): { lengthCm: number; widthCm: number; heightCm: number } {
    return { lengthCm: this.#held.l, widthCm: this.#held.w, heightCm: this.#held.h }
  }
  volumeCm3(): number { return this.#held.dv }
  dimWeightKg(): number { return this.#held.dw }
  servedAt(): number { return this.#clock.now() }
  operationalState(): string {
    if (this.#faultLatched) return 'fault'
    return this.#state
  }
  environment(): Environment { return { ...this.#env } }

  // ── the /world actuation (never reachable from /twin) ───────────

  setEnvironment(e: Partial<Environment>): void { this.#env = { ...this.#env, ...e } }

  setConveyorSpeed(speedMS: number): void {
    if (!(speedMS > 0 && speedMS <= 3)) throw new Error(`conveyor speed must be in (0, 3] m/s, got ${speedMS}`)
    this.#world.conveyorSpeedMS = speedMS
  }
  /** Feed one object onto the conveyor (the frame takes one at a time —
   *  the bench idiom). */
  feedObject(spec: ConveyorObjectSpec): void {
    validateObjectSpec(spec)
    if (this.#traversal) throw new Error('an object is already in the measuring frame — wait for the traversal or clearObject')
    if (this.#state === 'warming') throw new Error('the instrument is still warming up — no measurement before ready (R 129-1, 5.1.7)')
    this.#traversal = beginTraversal(spec, this.#clock.now())
    this.#disturbed = this.#world.beamOccluded || this.#world.emiSeverity >= this.#params.emiFaultSeverity
    this.#state = 'measuring'
  }
  clearObject(): void {
    this.#traversal = undefined
    this.#disturbed = false
    if (this.#state === 'measuring') this.#state = 'ready'
  }
  setAmbientLight(lx: number): void {
    if (!(lx >= 0)) throw new Error(`ambient light must be ≥ 0, got ${lx}`)
    this.#world.ambientLx = lx
  }
  setEmi(severity: number): void {
    if (!(severity >= 0)) throw new Error(`EMI severity must be ≥ 0, got ${severity}`)
    this.#world.emiSeverity = severity
  }
  setBeamOccluded(occluded: boolean): void { this.#world.beamOccluded = occluded }
  /** Fault knob: belt-encoder slip (fraction) — the length scales. */
  setEncoderSlip(frac: number): void {
    if (!(Math.abs(frac) <= 0.05)) throw new Error(`encoder slip must be within ±5 %, got ${frac}`)
    this.#params.encoderSlipFrac = frac
  }
  /** Fault knob: tilt the scan head (deg) — width/height bias with the
   *  object height. */
  setScannerTilt(tiltDeg: number): void {
    if (!(Math.abs(tiltDeg) <= 10)) throw new Error(`scanner tilt must be within ±10°, got ${tiltDeg}`)
    this.#params.scannerTiltDeg = tiltDeg
  }
  /** Fault knob: the post-temperature-cycle residual span error
   *  (fraction) — the configurable post-cycle difference (the standing
   *  sim doctrine). */
  setThermalResidual(frac: number): void {
    if (!(Math.abs(frac) <= 0.05)) throw new Error(`thermal residual must be within ±5 %, got ${frac}`)
    this.#params.thermalResidualFrac = frac
  }
  /** The object-feed driver: script the parcel flow over the virtual
   *  clock (a keyframe defers while the frame is occupied). */
  driveFeed(keyframes: FeedKeyframe[]): void {
    this.#feed?.stop()
    this.#feed = new ObjectFeedPlayer(keyframes)
    this.#feed.start(this.#clock, spec => {
      if (this.#traversal || this.#state === 'warming') return false // deferred
      this.feedObject(spec)
      return true
    })
  }
  stopFeed(): void { this.#feed?.stop(); this.#feed = undefined }

  injectFault(): void { this.#faultLatched = true }
  clearFault(): void { this.#faultLatched = false }
  get faultLatched(): boolean { return this.#faultLatched }

  /** The instrument-legal self-test (invoked from /twin only): the
   *  checking facility measures the internal reference gauge through
   *  the CURRENT systematics (encoder slip, scanner tilt, the thermal
   *  span error) — beyond the declared bound the fault latch trips
   *  (R 129-1, 5.6.1: made inoperative automatically). */
  selfTest(): void {
    const p = this.#params
    const span = 1 + thermalSpanFrac(this.#env.temperatureDegC, p.thermalResidualFrac, p)
    const measured = p.refGaugeCm * span * (1 + p.encoderSlipFrac)
    if (Math.abs(measured - p.refGaugeCm) > p.selfTestBoundCm) this.#faultLatched = true
  }

  groundTruth(): MdGroundTruth {
    const t = this.#traversal
    return {
      clockS: this.#clock.now(),
      environment: { ...this.#env },
      conveyorSpeedMS: this.#world.conveyorSpeedMS,
      object: t ? { ...t.spec, positionM: t.positionM } : null,
      ambientLx: this.#world.ambientLx,
      emiSeverity: this.#world.emiSeverity,
      beamOccluded: this.#world.beamOccluded,
      encoderSlipFrac: this.#params.encoderSlipFrac,
      scannerTiltDeg: this.#params.scannerTiltDeg,
      thermalResidualFrac: this.#params.thermalResidualFrac,
      thermalSpanFrac: thermalSpanFrac(this.#env.temperatureDegC, this.#params.thermalResidualFrac, this.#params),
      lastReading: this.#lastReading,
    }
  }

  reset(): void {
    this.#feed?.stop(); this.#feed = undefined
    this.#world = initialWorld(this.#def)
    this.#env = { ...REFERENCE_ENVIRONMENT }
    this.#params = { ...this.#def.parameters }
    this.#traversal = undefined
    this.#disturbed = false
    this.#poweredAt = this.#clock.now()
    this.#state = 'warming'
    this.#faultLatched = false
    this.#held = { l: 0, w: 0, h: 0, dv: 0, dw: 0 }
    this.#lastReading = null
  }
}
