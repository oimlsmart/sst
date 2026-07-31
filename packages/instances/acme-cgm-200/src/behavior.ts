// ACME CGM-200 — gas analyzer behavior.
// Implements the R 144 kind's R144Behavior. Delegates to SimulatedGasAnalyzer.

import type { R144Behavior, R144Definition, R144Instrument, GasComponent } from '../../../kinds/sst-r144/interface.d.ts'
import type { VirtualClock } from '@primmel/sst-runtime'
import { SimulatedGasAnalyzer, getGasScenario } from '@primmel/sst-runtime'

export const create = (def: R144Definition, clock: VirtualClock, seed: number): R144Instrument => {
  const scenario = getGasScenario('good-analyzer')
  const inst = new SimulatedGasAnalyzer(
    { ...scenario, id: def.id } as never,
    clock,
    seed,
  )
  // Full instrument so twin-io-builder resolves indication_co/nox via
  // indication(component), and zero/span calibration operations.
  return inst as unknown as R144Instrument
}

export const handlers: R144Behavior['handlers'] = {
  setGasConcentration:    (ctx, a) => { ctx.instrument.setGasConcentration(a.component as GasComponent, a.ppm) },
  setNo2Fraction:         (ctx, a) => { ctx.instrument.setNo2Fraction(a.fraction) },
  setInterferents:        (ctx, a) => { ctx.instrument.setInterferents(a.interferent, a.ppm) },
  setSampleFlow:          (ctx, a) => { ctx.instrument.setSampleFlow(a.lMin) },
  setOpticsContamination: (ctx, a) => { ctx.instrument.setOpticsContamination(a.fraction) },
  setSourceAgingRate:     (ctx, a) => { ctx.instrument.setSourceAgingRate(a.perDay) },
  setSampleLineLeak:      (ctx, a) => { ctx.instrument.setSampleLineLeak(a.fraction) },
  zeroCalibration:        (ctx)   => { ctx.instrument.zeroCalibration() },
  spanCalibration:        (ctx, a) => { ctx.instrument.spanCalibration(a.spanGasPpm) },
  runSelfCheck:           (ctx)   => { ctx.instrument.runSelfCheck() },
}

export default { create, handlers }
