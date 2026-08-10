// handlers.ts — the R 60 kind's default mutation handlers.
//
// Every R 60 instance provides the SAME handler implementations because
// they all forward to ctx.instrument.<method>() — the instrument IS the
// per-instance variation. Putting handlers in the kind eliminates the
// DRY violation of each instance shipping identical code.
//
// The instance only provides:
//   - create(def, clock, seed) → the instrument factory
//   - scene.bind(gltf, ctx)    → the 3D interactivity
//
// The kind provides the handlers — they're generic across instances.

import type { R60Instrument } from './interface.d.ts'
import type { WorldContext } from '@primmel/sst-runtime'
import type { R60Behavior } from './interface.d.ts'

export const handlers: R60Behavior['handlers'] = {
  applyMass:            (ctx: WorldContext<R60Instrument>, args: { massKg: number }) => { ctx.instrument.placeMass(args.massKg) },
  removeMass:           (ctx: WorldContext<R60Instrument>) => { ctx.instrument.removeMass() },
  ladApplyLoad:         (ctx: WorldContext<R60Instrument>, args: { loadKg: number; rateKgPerS?: number }) => { ctx.instrument.ladApply(args.loadKg, args.rateKgPerS) },
  ladReleaseLoad:       (ctx: WorldContext<R60Instrument>, args: { rateKgPerS?: number }) => { ctx.instrument.ladRelease(args.rateKgPerS) },
  ladConfigureDevice:   (ctx: WorldContext<R60Instrument>, args: { capacityKg?: number; classFraction?: number; repeatabilityFraction?: number; defaultRateKgPerS?: number }) => { ctx.instrument.configureLad(args) },
  setTwinFidelity:      (ctx: WorldContext<R60Instrument>, args: { servedOffsetKg?: number; servedLagS?: number }) => { ctx.instrument.setFidelity(args) },
  resetTwinFidelity:    (ctx: WorldContext<R60Instrument>) => { ctx.instrument.resetFidelity() },
  setThermalHysteresis: (ctx: WorldContext<R60Instrument>, args: { perDegC: number; tauS?: number }) => { ctx.instrument.setThermalHysteresis(args.perDegC, args.tauS) },
}
