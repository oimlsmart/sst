// ACME LC-500 — 3D interactivity binding.
//
// This module is the second half of the instance package (the first
// being behavior.ts). It declares how the LC-500's glTF scene responds
// to user input: drag the calibration mass onto the pan, click the
// zero button, drag the temperature dial.
//
// The scene.bind() function receives a SceneContext carrying the
// TwinDriver (legal reads + commands) and the WorldDriver (mutations +
// ground truth). The instance decides which driver to call per gesture.
//
// See specs/11-scene-context.md for the protocol and rationale.

import type { R60Scene, R60Instrument } from '../../../kinds/sst-r60/interface.d.ts'
import type { SceneContext } from '../../../runtime/sst-runtime/src/scene/context.js'

/** The mass (kg) of the calibration weight in the LC-500 scene. */
const CALIBRATION_MASS_KG = 40

/** Half-pan extent (m) — used by isOverPan. */
const PAN_HALF_EXTENT_M = 0.5

function isOverPan(worldX: number, worldZ: number): boolean {
  return Math.abs(worldX) < PAN_HALF_EXTENT_M && Math.abs(worldZ) < PAN_HALF_EXTENT_M
}

/** The LC-500's kind-specific world mutations (per sst-r60/world-kind.yaml).
 *  TODO 02 full execution types these via the kind descriptor; the scaffold
 *  accesses them by name. */
interface R60WorldMutations {
  placeLoad(massKg: number): Promise<unknown>
  removeLoad(): Promise<unknown>
  setFidelity(args: { servedOffsetKg?: number; servedLagS?: number }): Promise<unknown>
  fidelityReset(): Promise<unknown>
  setThermalHysteresis(args: { perDegC: number; tauS?: number }): Promise<unknown>
}

export const scene: R60Scene = {
  bind(gltf, ctx: SceneContext<R60Instrument>) {
    const world = ctx.world as unknown as R60WorldMutations & typeof ctx.world

    // Drag the calibration mass — drop on the pan to load, drag off to unload.
    const offWeightDrag = gltf.onDrag('weight', (e) => {
      if (isOverPan(e.worldX, e.worldZ)) {
        void world.placeLoad(CALIBRATION_MASS_KG)
      } else {
        void world.removeLoad()
      }
    })

    // Click the zero button on the instrument body — triggers self-test
    // via the legal-view channel (the /twin).
    const offZeroClick = gltf.onClick('zero-button', () => {
      void ctx.twin.runSelfTest()
    })

    // Drag the temperature dial — adjusts the chamber's temperature.
    const offTempDrag = gltf.onDrag('temp-dial', (e) => {
      const current = ctx.instrument.environment().temperatureDegC
      const next = Math.max(-40, Math.min(80, current + (e.deltaY ?? 0) * 0.5))
      void ctx.world.setEnvironment({ temperatureDegC: next })
    })

    return () => { offWeightDrag(); offZeroClick(); offTempDrag() }
  },
}

export default scene
