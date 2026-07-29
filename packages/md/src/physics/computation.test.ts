import { describe, it, expect } from 'vitest'
import { roundToScale, computeMeasurement, type ComputationParams } from './computation.js'
import type { RawMeasurement } from './scanning.js'

// The dimension-computation stage (stage c): rounding to d, the
// limits-of-indication gate, the calculated quantities.
const P: ComputationParams = {
  scaleIntervalCm: 0.5, minDimCm: 5, maxLCm: 250, maxWCm: 120, maxHCm: 180,
  convFactorCm3PerKg: 5000,
}
const raw = (l: number, w: number, h: number): RawMeasurement => ({
  lengthCm: l, widthCm: w, heightCm: h,
  protrusionMissed: false, quantizationCm: 0,
  sigmas: { edgeCm: 0, widthCm: 0, heightCm: 0 },
})

describe('the dimension computation (stage c)', () => {
  it('rounds each axis to the scale interval (nearest, ties away from zero)', () => {
    expect(roundToScale(60.24, 0.5)).toBe(60)
    expect(roundToScale(60.26, 0.5)).toBe(60.5)
    expect(roundToScale(60.25, 0.5)).toBe(60.5)
    expect(roundToScale(-60.25, 0.5)).toBe(-60.5)
  })

  it('the calculated quantities derive from the INDICATED dimensions (R 129-1, 4.1.6)', () => {
    const m = computeMeasurement(raw(60, 40, 30), P)
    expect(m.valid).toBe(true)
    expect(m.reason).toBe('ok')
    expect(m.dimVolumeCm3).toBe(72000)
    expect(m.dimWeightKg).toBeCloseTo(14.4, 10) // DV / F = 72000 / 5000
  })

  it('the limits-of-indication gate: below Min is inhibited (R 129-1, 5.2.6)', () => {
    const m = computeMeasurement(raw(4.9, 40, 30), P) // rounds to 5.0 — at Min, valid
    expect(m.valid).toBe(true)
    const low = computeMeasurement(raw(4.4, 40, 30), P) // rounds to 4.5 — below Min
    expect(low.valid).toBe(false)
    expect(low.reason).toBe('below-min')
    expect(low.dimVolumeCm3).toBe(0)
  })

  it('the limits-of-indication gate: beyond Max + 9 d is inhibited, at it is not', () => {
    const atBoundary = computeMeasurement(raw(254.5, 40, 30), P) // Max + 9 d = 250 + 4.5
    expect(atBoundary.valid).toBe(true)
    const beyond = computeMeasurement(raw(255, 40, 30), P)
    expect(beyond.valid).toBe(false)
    expect(beyond.reason).toBe('beyond-max')
  })
})
