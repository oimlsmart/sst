// handlers.ts — the R 91 kind's default mutation handlers.
import type { R91Behavior, R91Instrument } from './interface.d.ts'
import type { WorldContext } from '@primmel/sst-runtime'

export const handlers: R91Behavior['handlers'] = {
  setTarget:              (ctx: WorldContext<R91Instrument>, a) => { ctx.instrument.setTarget(a.speedKmh, a.rangeM ?? 100, a.angleDeg ?? 20) },
  clearTarget:            (ctx: WorldContext<R91Instrument>) => { ctx.instrument.clearTarget() },
  setRain:                (ctx: WorldContext<R91Instrument>, a) => { ctx.instrument.setRain(a.rateMmH) },
  setVibration:           (ctx: WorldContext<R91Instrument>, a) => { ctx.instrument.setVibration(a.severity) },
  setEmi:                 (ctx: WorldContext<R91Instrument>, a) => { ctx.instrument.setEmi(a.severity) },
  setOscillatorDrift:     (ctx: WorldContext<R91Instrument>, a) => { ctx.instrument.setOscillatorDrift(a.ppm) },
  setAntennaMisalignment: (ctx: WorldContext<R91Instrument>, a) => { ctx.instrument.setAntennaMisalignment(a.degrees) },
  setInterferenceSource:  (ctx: WorldContext<R91Instrument>, a) => { ctx.instrument.setInterferenceSource(a.band, a.powerDbm) },
  clearInterferenceSource:(ctx: WorldContext<R91Instrument>) => { ctx.instrument.clearInterferenceSource() },
  driveProfile:           (ctx: WorldContext<R91Instrument>, a) => { ctx.instrument.driveProfile(a.profileId) },
  stopProfile:            (ctx: WorldContext<R91Instrument>) => { ctx.instrument.stopProfile() },
}
