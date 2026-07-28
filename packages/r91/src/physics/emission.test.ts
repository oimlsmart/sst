import { describe, it, expect } from 'vitest'
import { reflect, C0_M_PER_S, type EmissionParams, type RadarTarget } from './emission.js'

const P: EmissionParams = {
  carrierHz: 24.15e9,
  referenceRangeM: 100, referenceRcsM2: 5, referenceSnrDb: 40,
  rainAttenuationDbPerKmPerMmH: 0.2, maxRangeM: 400,
}
const TARGET: RadarTarget = { speedKmh: 50, rangeM: 120, angleDeg: 12, rcsM2: 5 }

describe('stage (a): emission + reflection', () => {
  it('the Doppler relation: f_d = 2·v·f_0·cos(θ)/c (the K-band ~44.7 Hz per km/h)', () => {
    const head = reflect({ ...TARGET, angleDeg: 0 }, P.carrierHz, 0, P)
    // per-km/h constant at θ=0: 2·(1/3.6)·f_0/c
    const perKmh = (2 * (1 / 3.6) * P.carrierHz) / C0_M_PER_S
    expect(head.dopplerHz).toBeCloseTo(50 * perKmh, 6)
    expect(perKmh).toBeCloseTo(44.74, 1) // the known K-band constant
    const angled = reflect(TARGET, P.carrierHz, 0, P)
    expect(angled.dopplerHz).toBeCloseTo(head.dopplerHz * Math.cos((12 * Math.PI) / 180), 6)
  })

  it('the two-way radar equation: SNR falls 40 dB/decade of range, rises with RCS', () => {
    const near = reflect({ ...TARGET, rangeM: 100 }, P.carrierHz, 0, P)
    expect(near.snrDb).toBeCloseTo(40, 6) // the reference geometry
    const far = reflect({ ...TARGET, rangeM: 1000 }, P.carrierHz, 0, P)
    expect(far.snrDb).toBeCloseTo(0, 6) // 10× range → −40 dB
    const bigger = reflect({ ...TARGET, rangeM: 100, rcsM2: 50 }, P.carrierHz, 0, P)
    expect(bigger.snrDb).toBeCloseTo(50, 6) // 10× RCS → +10 dB
  })

  it('rain attenuates the echo two-way — it fades, never bends (the Doppler is untouched)', () => {
    const dry = reflect(TARGET, P.carrierHz, 0, P)
    const wet = reflect(TARGET, P.carrierHz, 50, P)
    expect(wet.snrDb).toBeCloseTo(dry.snrDb - 2 * 0.2 * 50 * 0.12, 6) // 2·k·R·rangeKm
    expect(wet.dopplerHz).toBe(dry.dopplerHz)
  })

  it('beyond the beam limit the echo is out of range (a miss channel)', () => {
    expect(reflect({ ...TARGET, rangeM: 401 }, P.carrierHz, 0, P).inRange).toBe(false)
    expect(reflect({ ...TARGET, rangeM: 400 }, P.carrierHz, 0, P).inRange).toBe(true)
  })

  it('the oscillator frequency enters here: drift scales f_d at the source', () => {
    const nominal = reflect(TARGET, P.carrierHz, 0, P)
    const drifted = reflect(TARGET, P.carrierHz * 1.008, 0, P)
    expect(drifted.dopplerHz).toBeCloseTo(nominal.dopplerHz * 1.008, 6)
  })
})
