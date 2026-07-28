import { describe, it, expect } from 'vitest'
import { reflect, C0_M_PER_S } from './emission.js'
import { estimate, type EstimationParams, type DopplerLine } from './estimation.js'

const P: EstimationParams = {
  carrierHz: 24.15e9, installAngleDeg: 12,
  detectSnrDbMin: 10, noiseSigmaKmh: 0.15, referenceSnrDb: 40,
  vibrationNoiseKmhPerSeverity: 0.4, emiNoiseFloorDbPerSeverity: 8,
}
const NO_DISTURBANCE = { vibrationSeverity: 0, emiSeverity: 0 }
const ZERO = () => 0 // zero-noise draws: deterministic estimates

/** the echo line of a v-km/h target at angle θ under carrier f. */
function line(speedKmh: number, angleDeg: number, fHz: number, snrDb = 36, source: 'target' | 'interference' = 'target'): DopplerLine {
  const dopplerHz = (2 * (speedKmh / 3.6) * fHz * Math.cos((angleDeg * Math.PI) / 180)) / C0_M_PER_S
  return { dopplerHz, snrDb, inRange: true, source }
}

describe('stage (b): demodulation + estimation', () => {
  it('converts f_d → speed with the declared installation angle (exact when the beam is aligned)', () => {
    const est = estimate([line(150, 12, P.carrierHz)], P, NO_DISTURBANCE, ZERO)
    expect(est.detected).toBe(true)
    expect(est.speedKmh).toBeCloseTo(150, 9)
  })

  it('the cosine error: a misaligned beam UNDER-reads, by cos(θ)/cos(install)', () => {
    // antenna declared at 12°, truly at 20° (8° misalignment)
    const est = estimate([line(150, 20, P.carrierHz)], P, NO_DISTURBANCE, ZERO)
    const expected = 150 * (Math.cos((20 * Math.PI) / 180) / Math.cos((12 * Math.PI) / 180))
    expect(est.speedKmh).toBeCloseTo(expected, 9)
    expect(est.speedKmh).toBeLessThan(150)
    expect(150 - est.speedKmh).toBeCloseTo(150 - expected, 9) // ≈ 5.9 km/h under
  })

  it('oscillator drift: the estimate converts with NOMINAL f_0, so drift scales the speed', () => {
    const est = estimate([line(150, 12, P.carrierHz * 1.008)], P, NO_DISTURBANCE, ZERO)
    expect(est.speedKmh).toBeCloseTo(150 * 1.008, 9) // +0.8 % over-read
  })

  it('below the detection threshold there is NO reading — a miss, never a wrong value', () => {
    const faded = estimate([line(150, 12, P.carrierHz, 9.9)], P, NO_DISTURBANCE, ZERO)
    expect(faded.detected).toBe(false)
    expect(faded.source).toBe('none')
    const atThreshold = estimate([line(150, 12, P.carrierHz, 10)], P, NO_DISTURBANCE, ZERO)
    expect(atThreshold.detected).toBe(true)
  })

  it('EMI raises the noise floor: enough severity turns a good echo into a miss', () => {
    const quiet = estimate([line(150, 12, P.carrierHz, 36)], P, NO_DISTURBANCE, ZERO)
    expect(quiet.detected).toBe(true)
    const storm = estimate([line(150, 12, P.carrierHz, 36)], P, { vibrationSeverity: 0, emiSeverity: 4 }, ZERO)
    expect(storm.detected).toBe(false) // 36 − 32 dB < 10 dB
  })

  it('strongest-in-beam: a stronger interference line captures the meter (a physically wrong reading)', () => {
    const target = line(150, 12, P.carrierHz, 36, 'target')
    const ghost = line(45, 12, P.carrierHz, 52, 'interference')
    const est = estimate([target, ghost], P, NO_DISTURBANCE, ZERO)
    expect(est.source).toBe('interference')
    expect(est.speedKmh).toBeCloseTo(45, 9)
    // weaker interference is ignored
    const weak = estimate([target, { ...ghost, snrDb: 20 }], P, NO_DISTURBANCE, ZERO)
    expect(weak.source).toBe('target')
    expect(weak.speedKmh).toBeCloseTo(150, 9)
  })

  it('estimation noise grows as SNR falls and with vibration severity', () => {
    const unit = () => 1 // one-σ draw
    const quiet = estimate([line(150, 12, P.carrierHz, 40)], P, NO_DISTURBANCE, unit)
    expect(quiet.speedKmh - 150).toBeCloseTo(0.15, 9)
    const faded = estimate([line(150, 12, P.carrierHz, 20)], P, NO_DISTURBANCE, unit)
    expect(faded.speedKmh - 150).toBeCloseTo(0.15 * 10, 9) // −20 dB → ×10 σ
    const shaking = estimate([line(150, 12, P.carrierHz, 40)], P, { vibrationSeverity: 2, emiSeverity: 0 }, unit)
    expect(shaking.speedKmh - 150).toBeCloseTo(0.15 + 2 * 0.4, 9)
  })

  it('the emission+estimation chain round-trips: reflect() then estimate() recovers the speed', () => {
    const echo = reflect({ speedKmh: 87, rangeM: 120, angleDeg: 12, rcsM2: 5 }, P.carrierHz, 0, {
      carrierHz: P.carrierHz, referenceRangeM: 100, referenceRcsM2: 5, referenceSnrDb: 40,
      rainAttenuationDbPerKmPerMmH: 0.2, maxRangeM: 400,
    })
    const est = estimate([{ ...echo, source: 'target' }], P, NO_DISTURBANCE, ZERO)
    expect(est.speedKmh).toBeCloseTo(87, 9)
  })
})
