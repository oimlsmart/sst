import { describe, it, expect } from 'vitest'
import { oscillatorErrorPpm, actualCarrierHz, conditionReading, type ConditioningParams } from './conditioning.js'

const P: ConditioningParams = {
  intervalMinKmh: 20, intervalMaxKmh: 180,
  calibrationFactor: 1.0,
  oscillatorTcPpmPerDegC: 0.05, oscillatorBiasPpm: 0, oscillatorDriftPpmPerDay: 0,
  referenceTempDegC: 20,
}

describe('stage (c): conditioning', () => {
  it('the oscillator error composes temperature drift + bias + ageing', () => {
    expect(oscillatorErrorPpm(P, 20, 0)).toBe(0)
    expect(oscillatorErrorPpm(P, 60, 0)).toBeCloseTo(2, 9) // 0.05 × 40 °C
    expect(oscillatorErrorPpm({ ...P, oscillatorBiasPpm: 5 }, 20, 0)).toBe(5)
    expect(oscillatorErrorPpm({ ...P, oscillatorDriftPpmPerDay: 0.1 }, 20, 30)).toBeCloseTo(3, 9)
    expect(actualCarrierHz(24.15e9, 8000)).toBeCloseTo(24.15e9 * 1.008, 0)
  })

  it('the interval gate: no indication outside the declared 20–180 km/h (R 91-1, 6.1)', () => {
    expect(conditionReading(15, P).inInterval).toBe(false)
    expect(conditionReading(20, P).inInterval).toBe(true)
    expect(conditionReading(180, P).inInterval).toBe(true)
    expect(conditionReading(200, P).inInterval).toBe(false)
  })

  it('the legal indication is integer km/h (R 91-1, 6.2), calibration applied first', () => {
    expect(conditionReading(87.4, P).indicatedKmh).toBe(87)
    expect(conditionReading(87.5, P).indicatedKmh).toBe(88)
    expect(conditionReading(100, { ...P, calibrationFactor: 1.02 }).indicatedKmh).toBe(102)
  })
})
