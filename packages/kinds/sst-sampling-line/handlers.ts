// handlers.ts — the sampling-line kind's default mutation handlers.
// Arg shapes match world-kind.sdl.graphql and the SamplingLineInstrument.
import type { SamplingLineBehavior, SamplingLineInstrument, GasComposition } from './interface.d.ts'
import type { WorldContext } from '@primmel/sst-runtime'

export const handlers: SamplingLineBehavior['handlers'] = {
  setFlowRate:           (ctx: WorldContext<SamplingLineInstrument>, a: { lPerMin: number }) => { ctx.instrument.setFlowRate(a.lPerMin) },
  setLineTemperature:    (ctx: WorldContext<SamplingLineInstrument>, a: { degC: number }) => { ctx.instrument.setLineTemperature(a.degC) },
  introduceLeak:         (ctx: WorldContext<SamplingLineInstrument>, a: { fraction: number }) => { ctx.instrument.introduceLeak(a.fraction) },
  setInletComposition:   (ctx: WorldContext<SamplingLineInstrument>, a: GasComposition) => { ctx.instrument.setInletComposition(a) },
}
