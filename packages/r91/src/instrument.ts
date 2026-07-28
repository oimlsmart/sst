// instrument.ts — the radar speed meter composition root (the family
// stage set of the brief: emission+reflection → demodulation+estimation
// → conditioning). The epistemic wall (law 1) is here: indication()/
// servedAt()/operationalState()/environment() are the instrument's
// legal view (the TwinInstrument seam); groundTruth() is reality,
// exposed to /world only. Every fault and environment effect realizes
// THROUGH the physics stages — there is no indication override path.
import type { VirtualClock } from '@sim/core/time'
import { qty, type Qty } from '@sim/core/physics/quantity'
import { normal } from '@sim/core/physics/rng'
import { REFERENCE_ENVIRONMENT, type Environment, type OperationalState } from '@sim/core/instrument'
import { reflect, type EmissionParams, type RadarTarget } from './physics/emission.js'
import { estimate, type EstimationParams, type DopplerLine, DISCRIMINATION_MODE, type DiscriminationMode } from './physics/estimation.js'
import { oscillatorErrorPpm, actualCarrierHz, conditionReading, type ConditioningParams } from './physics/conditioning.js'
import { SpeedProfilePlayer, type SpeedKeyframe } from './driver.js'

export type { RadarTarget }

/** An in-beam interference source (a fault/disturbance channel): a
 *  competing return with an apparent speed and an equivalent RCS — it
 *  captures a strongest-in-beam discriminator when it dominates. */
export interface InterferenceSource {
  apparentSpeedKmh: number
  rcsM2: number
  rangeM: number
}

/** The radar's physical world (reality — /world only). */
export interface RadarWorldState {
  target: RadarTarget
  /** rain rate (mm/h) — two-way attenuation in stage (a). */
  rainRateMmH: number
  /** mechanical disturbance severity (D 11; 0 = none). */
  vibrationSeverity: number
  /** electromagnetic disturbance severity (D 11; 0 = none). */
  emiSeverity: number
  interference: InterferenceSource | undefined
}

export interface RadarParameters extends EmissionParams, EstimationParams, ConditioningParams {
  /** warm-up time constant (s); ready after 5τ (the load-cell idiom). */
  warmUpTauS: number
  /** antenna misalignment (deg) — an instrument fault: the true beam
   *  angle is installAngle + misalignment while the firmware keeps
   *  compensating for installAngle alone (the meter UNDER-reads). */
  misalignmentDeg: number
  /** EMI severity at which the fault detector trips (the disturbance
   *  reaction — the meter goes inoperative, R 91-1, 6.18's significant
   *  fault notion via the family fault behavior). */
  emiFaultSeverity: number
  /** the self-test's oscillator-lock bound (|error| ppm): beyond it the
   *  diagnostics report a fault (the self_test behavior's legal
   *  outcome). */
  oscillatorFaultLimitPpm: number
}

export interface RadarDefinition {
  id: string
  parameters: RadarParameters
  /** the initial world the instrument boots into (a scenario's bench
   *  setup — e.g. interference-present carries an active source). */
  world?: Partial<RadarWorldState>
}

/** The declared target-discrimination mode of this family. */
export const R91_DISCRIMINATION: DiscriminationMode = DISCRIMINATION_MODE

/** The reference radar speed meter — a stationary Doppler radar
 *  (R 91-1, 5.1.a/5.3), K-band, the speed interval 20–180 km/h
 *  (R 91-1, 6.1), a 12° declared installation angle. All coefficients
 *  inside R 91 limits. (Moving mode — the ego-speed channel of R 91-1,
 *  6.15.3 — is a second instrument in the R 91 model and is NOT in
 *  this family's v1; see the package README note.) */
export const R91_GOOD: RadarDefinition = {
  id: 'r91-ref-good',
  parameters: {
    carrierHz: 24.15e9,
    referenceRangeM: 100, referenceRcsM2: 5, referenceSnrDb: 40,
    rainAttenuationDbPerKmPerMmH: 0.2, maxRangeM: 400,
    installAngleDeg: 12, detectSnrDbMin: 10,
    noiseSigmaKmh: 0.15, vibrationNoiseKmhPerSeverity: 0.4, emiNoiseFloorDbPerSeverity: 8,
    intervalMinKmh: 20, intervalMaxKmh: 180,
    calibrationFactor: 1.0,
    oscillatorTcPpmPerDegC: 0.05, oscillatorBiasPpm: 0, oscillatorDriftPpmPerDay: 0,
    referenceTempDegC: 20,
    warmUpTauS: 30, misalignmentDeg: 0, emiFaultSeverity: 3, oscillatorFaultLimitPpm: 1000,
  },
  world: {
    target: { speedKmh: 50, rangeM: 120, angleDeg: 12, rcsM2: 5 },
  },
}

export const R91_META = {
  designation: 'reference Doppler radar speed meter (R 91, stationary)',
  manufacturer: 'sim-instruments reference (fictional)',
  mode: 'stationary',
  workingPrinciple: 'doppler-radar',
  carrierGHz: 24.15,
  speedIntervalKmh: [20, 180] as const,
  installAngleDeg: 12,
  productPackage: 'SIM-R91-2 (smart repo primmel-packages) — PENDING; twin rides the stand-in contract fixture',
} as const

const DEFAULT_WORLD: RadarWorldState = {
  target: { speedKmh: 50, rangeM: 120, angleDeg: 12, rcsM2: 5 },
  rainRateMmH: 0, vibrationSeverity: 0, emiSeverity: 0,
  interference: undefined,
}

function initialWorld(def: RadarDefinition): RadarWorldState {
  const w = def.world ?? {}
  return {
    target: { ...DEFAULT_WORLD.target, ...w.target },
    rainRateMmH: w.rainRateMmH ?? DEFAULT_WORLD.rainRateMmH,
    vibrationSeverity: w.vibrationSeverity ?? DEFAULT_WORLD.vibrationSeverity,
    emiSeverity: w.emiSeverity ?? DEFAULT_WORLD.emiSeverity,
    interference: w.interference ? { ...w.interference } : undefined,
  }
}

export interface RadarReading {
  valid: boolean
  /** 'ok' | 'warming' | 'no-detection' | 'outside-interval' */
  reason: string
  /** the held indication (km/h, integer). */
  indicatedKmh: number
  /** the unrounded estimate (km/h; 0 when the reading is invalid). */
  highResKmh: number
  /** the winner's SNR (dB; 0 when none). */
  snrDb: number
  /** 'target' | 'interference' | 'none' */
  source: string
}

export interface RadarGroundTruth {
  clockS: number
  environment: Environment
  target: RadarTarget
  rainRateMmH: number
  vibrationSeverity: number
  emiSeverity: number
  interference: InterferenceSource | null
  oscillatorErrorPpm: number
  carrierActualHz: number
  lastReading: RadarReading | null
}

export class RadarSpeedMeter {
  #def: RadarDefinition
  #params: RadarParameters // own copy — world retunes must never mutate the shared definition record
  #clock: VirtualClock
  #normal: () => number
  #env: Environment = { ...REFERENCE_ENVIRONMENT }
  #world: RadarWorldState
  #poweredAt = 0
  #state: OperationalState = 'warming'
  #faultLatched = false
  #held = qty(0, 'km/h')
  #misalignmentDeg: number
  #profile: SpeedProfilePlayer | undefined
  #lastReading: RadarReading | null = null

  constructor(def: RadarDefinition, clock: VirtualClock, rng: () => number) {
    this.#def = def
    this.#params = { ...def.parameters }
    this.#clock = clock
    this.#normal = normal(rng)
    this.#world = initialWorld(def)
    this.#misalignmentDeg = def.parameters.misalignmentDeg
    this.#poweredAt = clock.now()
    clock.onAdvance(dt => this.#tick(dt))
  }

  #tick(_dt: number): void {
    // No range kinematics: the Doppler measurement is virtually
    // instantaneous (R 91-1, 5.3) and the bench holds its geometry —
    // the target stays at the set range until the operator changes it
    // (the load cell's placed-load idiom: a world condition holds).
    if (this.#state === 'warming' && this.#clock.now() - this.#poweredAt >= 5 * this.#params.warmUpTauS) this.#state = 'ready'
  }

  // ── the signal chain ────────────────────────────────────────────

  /** One reading through the full stage set (reality side). */
  #read(): RadarReading {
    if (this.#state !== 'ready') {
      return { valid: false, reason: 'warming', indicatedKmh: this.#held.value, highResKmh: 0, snrDb: 0, source: 'none' }
    }
    const p = this.#params
    const ageDays = (this.#clock.now() - this.#poweredAt) / 86400
    const errPpm = oscillatorErrorPpm(p, this.#env.temperatureDegC, ageDays)
    const fActual = actualCarrierHz(p.carrierHz, errPpm)
    // stage (a): emission + reflection — the misalignment fault enters
    // here: the true beam angle is the world's trajectory angle + the
    // instrument's misalignment.
    const t = this.#world.target
    const lines: DopplerLine[] = []
    const echo = reflect({ ...t, angleDeg: t.angleDeg + this.#misalignmentDeg }, fActual, this.#world.rainRateMmH, p)
    lines.push({ ...echo, source: 'target' })
    const src = this.#world.interference
    if (src) {
      const ghost = reflect(
        { speedKmh: src.apparentSpeedKmh, rangeM: src.rangeM, angleDeg: t.angleDeg + this.#misalignmentDeg, rcsM2: src.rcsM2 },
        fActual, this.#world.rainRateMmH, p,
      )
      lines.push({ ...ghost, source: 'interference' })
    }
    // stage (b): demodulation + estimation (EMI/vibration enter here).
    // A severe disturbance trips the fault detector — through physics:
    // the meter goes inoperative (R 91-1, 6.18's significant fault via
    // the family fault behavior) and the reading is invalid.
    if (this.#world.emiSeverity >= p.emiFaultSeverity) {
      this.#faultLatched = true
      return { valid: false, reason: 'fault', indicatedKmh: this.#held.value, highResKmh: 0, snrDb: 0, source: 'none' }
    }
    const est = estimate(lines, p, this.#world, this.#normal)
    if (!est.detected) {
      return { valid: false, reason: 'no-detection', indicatedKmh: this.#held.value, highResKmh: 0, snrDb: 0, source: 'none' }
    }
    // stage (c): calibration, the interval gate, integer resolution
    const cond = conditionReading(est.speedKmh, p)
    if (!cond.inInterval) {
      return { valid: false, reason: 'outside-interval', indicatedKmh: this.#held.value, highResKmh: est.speedKmh, snrDb: est.snrDb, source: est.source }
    }
    return { valid: true, reason: 'ok', indicatedKmh: cond.indicatedKmh, highResKmh: est.speedKmh, snrDb: est.snrDb, source: est.source }
  }

  // ── the TwinInstrument seam (the instrument's legal view) ───────

  indication(): Qty {
    // Inoperative while faulted: the served indication freezes at the
    // last valid reading until the fault is resolved.
    if (this.#faultLatched) return this.#held
    const r = this.#read()
    this.#lastReading = r
    if (r.valid) this.#held = qty(r.indicatedKmh, 'km/h') // the display holds the last valid reading
    return this.#held
  }

  servedAt(): number { return this.#clock.now() }
  operationalState(): OperationalState {
    if (this.#faultLatched) return 'fault'
    return this.#state
  }
  environment(): Environment { return { ...this.#env } }

  // ── the /world actuation (never reachable from /twin) ───────────

  setEnvironment(e: Partial<Environment>): void { this.#env = { ...this.#env, ...e } }

  setTarget(t: { speedKmh: number; rangeM: number; angleDeg?: number; rcsM2?: number }): void {
    this.#world.target = { ...this.#world.target, ...t }
  }
  setRain(rateMmH: number): void {
    if (!(rateMmH >= 0)) throw new Error(`rain rate must be ≥ 0, got ${rateMmH}`)
    this.#world.rainRateMmH = rateMmH
  }
  setVibration(severity: number): void {
    if (!(severity >= 0)) throw new Error(`vibration severity must be ≥ 0, got ${severity}`)
    this.#world.vibrationSeverity = severity
  }
  setEmi(severity: number): void {
    if (!(severity >= 0)) throw new Error(`EMI severity must be ≥ 0, got ${severity}`)
    this.#world.emiSeverity = severity
  }
  /** Fault knob: retune the oscillator live (temperature coefficient,
   *  bias, ageing) — the drift error realizes through stages (a)→(b). */
  setOscillatorDrift(knobs: { tcPpmPerDegC?: number; biasPpm?: number; driftPpmPerDay?: number }): void {
    if (knobs.tcPpmPerDegC !== undefined) this.#params.oscillatorTcPpmPerDegC = knobs.tcPpmPerDegC
    if (knobs.biasPpm !== undefined) this.#params.oscillatorBiasPpm = knobs.biasPpm
    if (knobs.driftPpmPerDay !== undefined) this.#params.oscillatorDriftPpmPerDay = knobs.driftPpmPerDay
  }
  /** Fault knob: tilt the antenna (deg) — the cosine error realizes
   *  through stages (a)→(b); the meter under-reads. */
  setAntennaMisalignment(angleDeg: number): void { this.#misalignmentDeg = angleDeg }
  /** Fault/disturbance knob: an in-beam interference source. */
  setInterferenceSource(src: InterferenceSource): void { this.#world.interference = { ...src } }
  clearInterferenceSource(): void { this.#world.interference = undefined }
  /** The target-driving helper: script the vehicle's speed profile. */
  driveProfile(keyframes: SpeedKeyframe[]): void {
    this.#profile?.stop()
    this.#profile = new SpeedProfilePlayer(keyframes)
    this.#profile.start(this.#clock, kmh => { this.#world.target.speedKmh = kmh })
  }
  stopProfile(): void { this.#profile?.stop(); this.#profile = undefined }

  injectFault(): void { this.#faultLatched = true }
  clearFault(): void { this.#faultLatched = false }
  get faultLatched(): boolean { return this.#faultLatched }

  /** The instrument-legal self-test (invoked from /twin only): the
   *  diagnostics check the oscillator against its lock bound — a
   *  drifting/biased oscillator beyond the declared limit trips the
   *  fault latch (the self_test behavior's legal outcome, realized
   *  from the physics). */
  selfTest(): void {
    const ageDays = (this.#clock.now() - this.#poweredAt) / 86400
    const errPpm = oscillatorErrorPpm(this.#params, this.#env.temperatureDegC, ageDays)
    if (Math.abs(errPpm) > this.#params.oscillatorFaultLimitPpm) this.#faultLatched = true
  }

  groundTruth(): RadarGroundTruth {
    const p = this.#params
    const ageDays = (this.#clock.now() - this.#poweredAt) / 86400
    const errPpm = oscillatorErrorPpm(p, this.#env.temperatureDegC, ageDays)
    return {
      clockS: this.#clock.now(),
      environment: { ...this.#env },
      target: { ...this.#world.target },
      rainRateMmH: this.#world.rainRateMmH,
      vibrationSeverity: this.#world.vibrationSeverity,
      emiSeverity: this.#world.emiSeverity,
      interference: this.#world.interference ? { ...this.#world.interference } : null,
      oscillatorErrorPpm: errPpm,
      carrierActualHz: actualCarrierHz(p.carrierHz, errPpm),
      lastReading: this.#lastReading,
    }
  }

  reset(): void {
    this.#profile?.stop(); this.#profile = undefined
    this.#world = initialWorld(this.#def)
    this.#env = { ...REFERENCE_ENVIRONMENT }
    this.#misalignmentDeg = this.#def.parameters.misalignmentDeg
    this.#params = { ...this.#def.parameters }
    this.#poweredAt = this.#clock.now()
    this.#state = 'warming'
    this.#faultLatched = false
    this.#held = qty(0, 'km/h')
    this.#lastReading = null
  }
}
