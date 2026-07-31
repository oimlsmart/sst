// handlers.ts — the R 129 kind's default mutation handlers.
import type { R129Behavior, R129Instrument } from './interface.d.ts'
import type { WorldContext } from '@primmel/sst-runtime'

export const handlers: R129Behavior['handlers'] = {
  setConveyorSpeed:   (ctx: WorldContext<R129Instrument>, a) => { ctx.instrument.setConveyorSpeed(a.speedMS) },
  feedObject:         (ctx: WorldContext<R129Instrument>, a) => { ctx.instrument.feedObject(a.lengthCm ?? 60, a.widthCm ?? 40, a.heightCm ?? 30) },
  clearObject:        (ctx: WorldContext<R129Instrument>) => { ctx.instrument.clearObject() },
  setAmbientLight:    (ctx: WorldContext<R129Instrument>, a) => { ctx.instrument.setAmbientLight(a.lux) },
  setEmi:             (ctx: WorldContext<R129Instrument>, a) => { ctx.instrument.setEmi(a.severity) },
  setBeamOccluded:    (ctx: WorldContext<R129Instrument>, a) => { ctx.instrument.setBeamOccluded(a.occluded) },
  setEncoderSlip:     (ctx: WorldContext<R129Instrument>, a) => { ctx.instrument.setEncoderSlip(a.fraction) },
  setScannerTilt:     (ctx: WorldContext<R129Instrument>, a) => { ctx.instrument.setScannerTilt(a.degrees) },
  setThermalResidual: (ctx: WorldContext<R129Instrument>, a) => { ctx.instrument.setThermalResidual(a.fraction) },
  driveFeed:          (ctx: WorldContext<R129Instrument>, a) => { ctx.instrument.driveFeed(a.profileId) },
  stopFeed:           (ctx: WorldContext<R129Instrument>) => { ctx.instrument.stopFeed() },
}
