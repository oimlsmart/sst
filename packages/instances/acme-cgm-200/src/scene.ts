// ACME CGM-200 — 3D interactivity binding.
// The gas bench has: a sample line (drag to introduce a leak), a span-gas
// bottle (click to start span calibration), a zero-gas bottle (click to
// start zero calibration), a flow-meter dial (drag to set flow rate).

import type { R144Scene, R144Instrument } from '../../../kinds/sst-r144/interface.d.ts'
import type { SceneContext } from '../../../runtime/sst-runtime/src/scene/context.js'

interface R144WorldMutations {
  setGasConcentration(component: string, ppm: number): Promise<unknown>
  setSampleFlow(lMin: number): Promise<unknown>
  setOpticsContamination(fraction: number): Promise<unknown>
  setSampleLineLeak(fraction: number): Promise<unknown>
  zeroCalibration(): Promise<unknown>
  spanCalibration(spanGasPpm: number): Promise<unknown>
  runSelfCheck(): Promise<unknown>
}

const SPAN_GAS_PPM = 40

export const scene: R144Scene = {
  bind(gltf, ctx: SceneContext<R144Instrument>) {
    const world = ctx.world as unknown as R144WorldMutations & typeof ctx.world

    // Drag the flow-meter dial to set the sample flow rate.
    const offFlowDrag = gltf.onDrag('flow-meter', (e) => {
      const next = Math.max(0.5, Math.min(3.0, 1.5 + (e.deltaY ?? 0) * 0.05))
      void world.setSampleFlow(next)
    })

    // Drag the sample-line coupling to introduce a leak.
    const offLineDrag = gltf.onDrag('sample-line', (e) => {
      const leakFraction = Math.max(0, Math.min(0.5, (e.deltaX ?? 0) * 0.01))
      void world.setSampleLineLeak(leakFraction)
    })

    // Click the zero-gas bottle to start zero calibration.
    const offZeroClick = gltf.onClick('zero-bottle', () => {
      void world.zeroCalibration()
    })

    // Click the span-gas bottle to start span calibration.
    const offSpanClick = gltf.onClick('span-bottle', () => {
      void world.spanCalibration(SPAN_GAS_PPM)
    })

    // Click the display to run the self-check.
    const offDisplayClick = gltf.onClick('display', () => {
      void world.runSelfCheck()
    })

    return () => { offFlowDrag(); offLineDrag(); offZeroClick(); offSpanClick(); offDisplayClick() }
  },
}

export default scene
