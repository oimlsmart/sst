import { describe, it, expect } from 'vitest'
import { VirtualClock } from '@sim/core/time'
import { mulberry32 } from '@sim/core/physics/rng'
import { RadarSpeedMeter } from './instrument.js'
import { getR91Scenario } from './scenarios.js'

function boot(scenario = 'good-radar', seed = 7) {
  const clock = new VirtualClock()
  const meter = new RadarSpeedMeter(getR91Scenario(scenario), clock, mulberry32(seed))
  return { clock, meter }
}
function ready(clock: VirtualClock) { clock.advance(200) } // past 5τ warm-up (150 s)

describe('the radar speed meter (the family stage set, through physics)', () => {
  it('the epistemic wall: indication is the legal view; groundTruth is reality — and never the same channel', () => {
    const { clock, meter } = boot()
    ready(clock)
    const ind = meter.indication()
    expect(ind.unit).toBe('km/h')
    expect(ind.kind).toBe('speed')
    expect(Math.abs(ind.value - 50)).toBeLessThanOrEqual(1) // the world's 50 km/h target, ±noise/rounding
    const gt = meter.groundTruth()
    expect(gt.target.speedKmh).toBe(50) // reality, exact
    expect(gt.lastReading?.valid).toBe(true)
    // the twin seam exposes no ground truth: the instrument's legal view
    // is exactly indication/servedAt/operationalState/environment
    expect(meter.environment().temperatureDegC).toBe(20)
    expect(meter.operationalState()).toBe('ready')
    expect(meter.servedAt()).toBe(clock.now())
  })

  it('warm-up: no valid readings until ready (the display holds its initial blank)', () => {
    const { clock, meter } = boot()
    expect(meter.operationalState()).toBe('warming')
    expect(meter.indication().value).toBe(0)
    expect(meter.groundTruth().lastReading?.reason).toBe('warming')
    ready(clock)
    expect(meter.operationalState()).toBe('ready')
    expect(Math.abs(meter.indication().value - 50)).toBeLessThanOrEqual(1)
  })

  it('the bench holds its geometry: the set range is a world fact (instantaneous measurement)', () => {
    const { clock, meter } = boot()
    ready(clock)
    meter.setTarget({ speedKmh: 130, rangeM: 150 })
    clock.advance(60)
    expect(meter.groundTruth().target.rangeM).toBe(150)
    expect(Math.abs(meter.indication().value - 130)).toBeLessThanOrEqual(1)
  })

  it('interval limits: a target outside 20–180 km/h produces NO indication (R 91-1, 6.1)', () => {
    const { clock, meter } = boot()
    ready(clock)
    const before = meter.indication().value
    meter.setTarget({ speedKmh: 15, rangeM: 300 })
    expect(meter.indication().value).toBe(before) // held — no new reading
    expect(meter.groundTruth().lastReading).toMatchObject({ valid: false, reason: 'outside-interval' })
    meter.setTarget({ speedKmh: 200, rangeM: 300 }) // detectable echo, not indicatable — the 6.1 pin
    expect(meter.indication().value).toBe(before)
    expect(meter.groundTruth().lastReading?.reason).toBe('outside-interval')
  })

  it('rain fades the echo: a missed reading, NEVER a wrong one (the display holds)', () => {
    const { clock, meter } = boot()
    ready(clock)
    meter.setTarget({ speedKmh: 120, rangeM: 150 })
    const held = meter.indication().value // a clean near reading (SNR ≈ 33 dB)
    expect(Math.abs(held - 120)).toBeLessThanOrEqual(1)
    meter.setRain(50)
    meter.setTarget({ speedKmh: 60, rangeM: 400 }) // faint + faded → below the 10 dB threshold
    expect(meter.indication().value).toBe(held) // the fade is a miss, the display holds
    expect(meter.groundTruth().lastReading).toMatchObject({ valid: false, reason: 'no-detection' })
    meter.setRain(0)
    meter.setTarget({ speedKmh: 60, rangeM: 150 })
    expect(Math.abs(meter.indication().value - 60)).toBeLessThanOrEqual(1) // the echo is back
  })

  it('the angle-misaligned preset under-reads by the cosine factor', () => {
    const { clock, meter } = boot('angle-misaligned')
    ready(clock)
    // 50 km/h, θ = 12 + 8 = 20°, compensation cos(12°): ≈ −4 %
    const ind = meter.indication().value
    expect(Math.abs(ind - Math.round(50 * Math.cos((20 * Math.PI) / 180) / Math.cos((12 * Math.PI) / 180)))).toBeLessThanOrEqual(1)
    expect(ind).toBeLessThan(50)
  })

  it('the temperature-drifting preset scales the speed with temperature — through the oscillator', () => {
    const { clock, meter } = boot('temperature-drifting')
    ready(clock)
    meter.setTarget({ speedKmh: 150, rangeM: 120 })
    const at20 = meter.indication().value
    expect(Math.abs(at20 - 150)).toBeLessThanOrEqual(1)
    meter.setEnvironment({ temperatureDegC: 60 }) // 200 ppm/°C × 40 °C = +0.8 %
    const at60 = meter.indication().value
    expect(at60).toBe(Math.round(150 * 1.008))
    expect(meter.groundTruth().oscillatorErrorPpm).toBeCloseTo(8000, 6)
  })

  it('the interference-present preset: the stronger ghost captures the strongest-in-beam meter', () => {
    const { clock, meter } = boot('interference-present')
    ready(clock)
    expect(meter.indication().value).toBe(45) // the ghost's apparent speed
    expect(meter.groundTruth().lastReading?.source).toBe('interference')
    meter.clearInterferenceSource()
    expect(Math.abs(meter.indication().value - 50)).toBeLessThanOrEqual(1) // the true target is back
  })

  it('EMI at fault severity trips the fault detector — through physics; clearFault resolves after the storm', () => {
    const { clock, meter } = boot()
    ready(clock)
    meter.indication()
    meter.setEmi(3)
    meter.indication() // the disturbance trips the detector on this reading
    expect(meter.operationalState()).toBe('fault')
    expect(meter.groundTruth().lastReading?.reason).toBe('fault')
    const frozen = meter.indication().value
    meter.setTarget({ speedKmh: 99, rangeM: 100 })
    expect(meter.indication().value).toBe(frozen) // inoperative: the served value cannot move
    meter.setEmi(0)
    meter.clearFault()
    expect(meter.operationalState()).toBe('ready')
    expect(Math.abs(meter.indication().value - 99)).toBeLessThanOrEqual(1)
  })

  it('injectFault freezes the served indication until clearFault (the generic fault knob)', () => {
    const { clock, meter } = boot()
    ready(clock)
    const before = meter.indication().value
    meter.injectFault()
    expect(meter.operationalState()).toBe('fault')
    meter.setTarget({ speedKmh: 99, rangeM: 100 })
    clock.advance(5)
    expect(meter.indication().value).toBe(before)
    meter.clearFault()
    expect(Math.abs(meter.indication().value - 99)).toBeLessThanOrEqual(1)
  })

  it('the fault knobs retune physics live: oscillator bias and antenna tilt realize through the chain', () => {
    const { clock, meter } = boot()
    ready(clock)
    meter.setTarget({ speedKmh: 100, rangeM: 120 })
    expect(Math.abs(meter.indication().value - 100)).toBeLessThanOrEqual(1)
    meter.setOscillatorDrift({ biasPpm: 8000 }) // +0.8 %
    expect(meter.indication().value).toBe(Math.round(100 * 1.008))
    meter.setOscillatorDrift({ biasPpm: 0 })
    meter.setAntennaMisalignment(10) // θ = 22° now
    const expected = 100 * Math.cos((22 * Math.PI) / 180) / Math.cos((12 * Math.PI) / 180)
    expect(Math.abs(meter.indication().value - Math.round(expected))).toBeLessThanOrEqual(1)
  })

  it('driveProfile scripts the vehicle speed over virtual time', () => {
    const { clock, meter } = boot()
    ready(clock)
    meter.setTarget({ speedKmh: 30, rangeM: 150 })
    meter.driveProfile([{ atS: 0, speedKmh: 30 }, { atS: 60, speedKmh: 90 }])
    clock.advance(30)
    expect(Math.abs(meter.indication().value - 60)).toBeLessThanOrEqual(1)
    clock.advance(30)
    expect(Math.abs(meter.indication().value - 90)).toBeLessThanOrEqual(1)
    expect(meter.groundTruth().target.speedKmh).toBe(90)
  })

  it('reset restores the scenario world, clears faults and disturbance knobs', () => {
    const { clock, meter } = boot()
    ready(clock)
    meter.setRain(50)
    meter.setEmi(3)
    meter.indication()
    expect(meter.operationalState()).toBe('fault')
    meter.reset()
    expect(meter.operationalState()).toBe('warming')
    const gt = meter.groundTruth()
    expect(gt.rainRateMmH).toBe(0)
    expect(gt.emiSeverity).toBe(0)
    expect(gt.target.speedKmh).toBe(50)
    clock.advance(200)
    expect(Math.abs(meter.indication().value - 50)).toBeLessThanOrEqual(1)
  })
})
