// ACME RS-180 — radar simulation behavior.
// Implements the R 91 kind's R91Behavior. Delegates to RadarSpeedMeter.

import type { R91Behavior, R91Definition, R91Instrument } from '../../../kinds/sst-r91/interface.d.ts'
import type { VirtualClock } from '@primmel/sst-runtime'
import { RadarSpeedMeter } from '../../../r91/src/instrument.js'
import { getR91Scenario } from '../../../r91/src/scenarios.js'

export const create = (def: R91Definition, clock: VirtualClock, seed: number): R91Instrument => {
  const scenario = getR91Scenario('good-radar')
  const inst = new RadarSpeedMeter(
    { ...scenario, id: def.id } as never,
    clock,
    seedMulberry(seed),
  )
  // Full instrument surface (groundTruth + selfTest for world/twin).
  return inst as unknown as R91Instrument
}

export const handlers: R91Behavior['handlers'] = {
  setTarget:              (ctx, a) => { ctx.instrument.setTarget(a.speedKmh, a.rangeM ?? 100, a.angleDeg ?? 20) },
  clearTarget:            (ctx)   => { ctx.instrument.clearTarget() },
  setRain:                (ctx, a) => { ctx.instrument.setRain(a.rateMmH) },
  setVibration:           (ctx, a) => { ctx.instrument.setVibration(a.severity) },
  setEmi:                 (ctx, a) => { ctx.instrument.setEmi(a.severity) },
  setOscillatorDrift:     (ctx, a) => { ctx.instrument.setOscillatorDrift(a.ppm) },
  setAntennaMisalignment: (ctx, a) => { ctx.instrument.setAntennaMisalignment(a.degrees) },
  setInterferenceSource:  (ctx, a) => { ctx.instrument.setInterferenceSource(a.band, a.powerDbm) },
  clearInterferenceSource:(ctx)   => { ctx.instrument.clearInterferenceSource() },
  driveProfile:           (ctx, a) => { ctx.instrument.driveProfile(a.profileId) },
  stopProfile:            (ctx)   => { ctx.instrument.stopProfile() },
}

export default { create, handlers }

function seedMulberry(seed: number): () => number {
  let a = seed | 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
