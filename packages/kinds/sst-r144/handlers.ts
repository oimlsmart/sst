// handlers.ts — the R 144 kind's default mutation handlers.
// Arg shapes match world-kind.sdl.graphql and SimulatedGasAnalyzer.
import type { R144Behavior, R144Instrument, GasComponent } from './interface.d.ts'
import type { WorldContext } from '@primmel/sst-runtime'

export const handlers: R144Behavior['handlers'] = {
  setGasConcentration:    (ctx: WorldContext<R144Instrument>, a) => { ctx.instrument.setGasConcentration(a.component as GasComponent, a.ppm) },
  setNo2Fraction:         (ctx: WorldContext<R144Instrument>, a) => { ctx.instrument.setNo2Fraction(a.fraction) },
  setInterferents:        (ctx: WorldContext<R144Instrument>, a) => {
    // Prefer the object form used by SimulatedGasAnalyzer.
    const args = a as { co2PercentVol?: number; h2oPercentVol?: number; interferent?: string; ppm?: number }
    if (args.co2PercentVol != null || args.h2oPercentVol != null) {
      (ctx.instrument as unknown as { setInterferents(i: { co2PercentVol?: number; h2oPercentVol?: number }): void })
        .setInterferents({ co2PercentVol: args.co2PercentVol, h2oPercentVol: args.h2oPercentVol })
    } else if (args.interferent != null && args.ppm != null) {
      ctx.instrument.setInterferents(args.interferent, args.ppm)
    }
  },
  setSampleFlow:          (ctx: WorldContext<R144Instrument>, a) => {
    const lMin = (a as { lMin?: number; lPerMin?: number }).lMin
      ?? (a as { lPerMin?: number }).lPerMin
      ?? 0
    ctx.instrument.setSampleFlow(lMin)
  },
  setOpticsContamination: (ctx: WorldContext<R144Instrument>, a) => { ctx.instrument.setOpticsContamination(a.fraction) },
  setSourceAgingRate:     (ctx: WorldContext<R144Instrument>, a) => { ctx.instrument.setSourceAgingRate(a.perDay) },
  setSampleLineLeak:      (ctx: WorldContext<R144Instrument>, a) => { ctx.instrument.setSampleLineLeak(a.fraction) },
  zeroCalibration:        (ctx: WorldContext<R144Instrument>) => { ctx.instrument.zeroCalibration() },
  spanCalibration:        (ctx: WorldContext<R144Instrument>, a) => { ctx.instrument.spanCalibration(a.spanGasPpm) },
  runSelfCheck:           (ctx: WorldContext<R144Instrument>) => { ctx.instrument.runSelfCheck() },
}
