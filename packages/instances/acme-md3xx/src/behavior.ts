// ACME MD-300 — multi-dimensional dimensioner behavior.
// Implements the R 129 kind's R129Behavior. Delegates to MultiDimensionalInstrument.

import type { R129Behavior, R129Definition, R129Instrument } from '../../../kinds/sst-r129/interface.d.ts'
import type { VirtualClock } from '@primmel/sst-runtime'
import { MultiDimensionalInstrument } from '../../../md/src/instrument.js'
import { getMdScenario } from '../../../md/src/scenarios.js'

export const create = (def: R129Definition, clock: VirtualClock, seed: number): R129Instrument => {
  const scenario = getMdScenario('good-dimensioner')
  const inst = new MultiDimensionalInstrument(
    { ...scenario, id: def.id } as never,
    clock,
    seedMulberry(seed),
  )
  // Full instrument so twin-io-builder resolves indication_length/width/height,
  // dim_volume, dim_weight, selfTest.
  return inst as unknown as R129Instrument
}

export const handlers: R129Behavior['handlers'] = {
  setConveyorSpeed:   (ctx, a) => { ctx.instrument.setConveyorSpeed(a.speedMS) },
  feedObject:         (ctx, a) => { ctx.instrument.feedObject(a.lengthCm ?? 60, a.widthCm ?? 40, a.heightCm ?? 30) },
  clearObject:        (ctx)   => { ctx.instrument.clearObject() },
  setAmbientLight:    (ctx, a) => { ctx.instrument.setAmbientLight(a.lux) },
  setEmi:             (ctx, a) => { ctx.instrument.setEmi(a.severity) },
  setBeamOccluded:    (ctx, a) => { ctx.instrument.setBeamOccluded(a.occluded) },
  setEncoderSlip:     (ctx, a) => { ctx.instrument.setEncoderSlip(a.fraction) },
  setScannerTilt:     (ctx, a) => { ctx.instrument.setScannerTilt(a.degrees) },
  setThermalResidual: (ctx, a) => { ctx.instrument.setThermalResidual(a.fraction) },
  driveFeed:          (ctx, a) => { ctx.instrument.driveFeed(a.profileId) },
  stopFeed:           (ctx)   => { ctx.instrument.stopFeed() },
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
