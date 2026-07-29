import { describe, it, expect } from 'vitest'
import { VirtualClock } from '@sim/core/time'
import { mulberry32 } from '@sim/core/physics/rng'
import {
  MultiDimensionalInstrument, MD350_GOOD, mpePerAxisCm,
  type ConveyorObjectSpec,
} from './instrument.js'
import { getMdScenario } from './scenarios.js'

// The composition root: the measurement lifecycle on the virtual clock,
// the held-indication discipline, and the fault behaviors — everything
// realized through the physics stages (law 1).
const BOX: ConveyorObjectSpec = {
  lengthCm: 60, widthCm: 40, heightCm: 30,
  shape: 'rectangular', reflectance: 0.9, protrusionCm: 0, orientationDeg: 0,
}

function boot(scenario = 'good-dimensioner') {
  const clock = new VirtualClock()
  const instrument = new MultiDimensionalInstrument(getMdScenario(scenario), clock, mulberry32(7))
  return { clock, instrument }
}

describe('the multi-dimensional instrument (the composition root)', () => {
  it('warms up, then feeds: the measurement completes at traversal end and the indication holds', () => {
    const { clock, instrument } = boot()
    expect(instrument.operationalState()).toBe('warming')
    expect(() => instrument.feedObject(BOX)).toThrow(/warming/)
    clock.advance(300) // 5τ warm-up
    expect(instrument.operationalState()).toBe('ready')
    instrument.feedObject(BOX)
    expect(instrument.operationalState()).toBe('measuring')
    clock.advance(0.3) // mid-traversal (0.6 s at 1 m/s for a 60 cm box)
    expect(instrument.operationalState()).toBe('measuring')
    expect(instrument.dimensionsCm()).toEqual({ lengthCm: 0, widthCm: 0, heightCm: 0 }) // nothing served yet
    clock.advance(0.3) // traversal completes
    expect(instrument.operationalState()).toBe('ready')
    const dims = instrument.dimensionsCm()
    expect(Math.abs(dims.lengthCm - 60)).toBeLessThanOrEqual(mpePerAxisCm(MD350_GOOD.parameters))
    expect(Math.abs(dims.widthCm - 40)).toBeLessThanOrEqual(mpePerAxisCm(MD350_GOOD.parameters))
    expect(Math.abs(dims.heightCm - 30)).toBeLessThanOrEqual(mpePerAxisCm(MD350_GOOD.parameters))
    expect(instrument.volumeCm3()).toBeCloseTo(dims.lengthCm * dims.widthCm * dims.heightCm, 6)
    expect(instrument.dimWeightKg()).toBeCloseTo(instrument.volumeCm3() / 5000, 6)
  })

  it('an out-of-limits object is no fault: the indication is inhibited and the last valid reading holds (5.2.6)', () => {
    const { clock, instrument } = boot()
    clock.advance(300)
    instrument.feedObject(BOX)
    clock.advance(1)
    const before = instrument.dimensionsCm()
    instrument.feedObject({ ...BOX, lengthCm: 4.4 }) // below Min after rounding
    clock.advance(1)
    const gt = instrument.groundTruth()
    expect(gt.lastReading?.valid).toBe(false)
    expect(gt.lastReading?.reason).toBe('below-min')
    expect(instrument.dimensionsCm()).toEqual(before) // held
    expect(instrument.operationalState()).toBe('ready') // NOT faulted
  })

  it('an occluded light curtain mid-traversal trips the checking facility — made inoperative automatically', () => {
    const { clock, instrument } = boot()
    clock.advance(300)
    instrument.feedObject(BOX)
    clock.advance(0.2)
    instrument.setBeamOccluded(true)
    clock.advance(1) // completes disturbed
    expect(instrument.faultLatched).toBe(true)
    expect(instrument.operationalState()).toBe('fault')
    const gt = instrument.groundTruth()
    expect(gt.lastReading?.valid).toBe(false)
    expect(gt.lastReading?.reason).toBe('occluded')
    instrument.setBeamOccluded(false)
    instrument.clearFault()
    expect(instrument.operationalState()).toBe('ready')
  })

  it('a severe EMI disturbance during the traversal is a significant fault (R 129-1, 4.3.1)', () => {
    const { clock, instrument } = boot()
    clock.advance(300)
    instrument.setEmi(4) // ≥ the fault severity
    instrument.feedObject(BOX)
    clock.advance(1)
    expect(instrument.faultLatched).toBe(true)
    expect(instrument.groundTruth().lastReading?.reason).toBe('disturbance')
  })

  it('the post-temperature-cycle residual scales the span — and the self-test catches it (the checking facility)', () => {
    const { clock, instrument } = boot()
    clock.advance(300)
    instrument.setThermalResidual(0.015) // the configurable post-cycle difference
    instrument.feedObject(BOX)
    clock.advance(1)
    const gt = instrument.groundTruth()
    expect(gt.thermalSpanFrac).toBeCloseTo(0.015, 10)
    expect(gt.lastReading?.measuredLengthCm).toBeCloseTo(60 * 1.015, 0) // ≈ 60.9 cm
    instrument.selfTest() // the reference gauge: 50 × 1.015 = 50.75 — 0.75 cm > the 0.4 cm bound
    expect(instrument.faultLatched).toBe(true)
    expect(instrument.operationalState()).toBe('fault')
  })

  it('the good instrument passes its own self-test; encoder slip trips it', () => {
    const { clock, instrument } = boot()
    clock.advance(300)
    instrument.selfTest()
    expect(instrument.faultLatched).toBe(false)
    instrument.setEncoderSlip(0.02) // 50 cm × 2 % = 1 cm > the 0.4 cm bound
    instrument.selfTest()
    expect(instrument.faultLatched).toBe(true)
  })

  it('the slow-scanner preset jitters hard at V_max and settles at V_min (the Annex A speed-of-movement prey)', () => {
    const { clock, instrument } = boot('slow-scanner')
    clock.advance(300)
    // 50 Hz at V_max: along-track resolution 3 cm — the quantization
    // jitter (sd ≈ 0.87 cm) exceeds 1 d on a substantial share of
    // objects; at 200 Hz-equivalent V_min it is negligible.
    instrument.setConveyorSpeed(1.5)
    let bigAtMax = 0
    for (let i = 0; i < 6; i++) {
      instrument.feedObject(BOX)
      clock.advance(1)
      const r = instrument.groundTruth().lastReading!
      expect(r.valid).toBe(true)
      if (Math.abs(r.quantizationCm) > 0.5) bigAtMax++
    }
    expect(bigAtMax).toBeGreaterThan(0)
    instrument.setConveyorSpeed(0.1) // V_min
    instrument.feedObject(BOX)
    clock.advance(7) // 60 cm at 0.1 m/s
    const slow = instrument.groundTruth().lastReading!
    expect(slow.valid).toBe(true)
    expect(Math.abs(slow.indicatedLengthCm - 60)).toBeLessThanOrEqual(0.5)
  })

  it('reset restores the boot world and clears the held indication', () => {
    const { clock, instrument } = boot()
    clock.advance(300)
    instrument.setThermalResidual(0.015)
    instrument.feedObject(BOX)
    clock.advance(1)
    instrument.reset()
    expect(instrument.operationalState()).toBe('warming')
    expect(instrument.dimensionsCm()).toEqual({ lengthCm: 0, widthCm: 0, heightCm: 0 })
    expect(instrument.groundTruth().thermalResidualFrac).toBe(0)
  })
})
