// ACME MD-300 — 3D interactivity binding.
// The conveyor has: a belt (drag to set speed), an object feeder
// (click to drop a parcel), a scanner head (tilt it), a lamp (adjust
// ambient light).

import type { R129Scene, R129Instrument } from '../../../kinds/sst-r129/interface.d.ts'
import type { SceneContext } from '../../../runtime/sst-runtime/src/scene/context.js'

interface R129WorldMutations {
  setConveyorSpeed(speedMS: number): Promise<unknown>
  feedObject(lengthCm?: number, widthCm?: number, heightCm?: number): Promise<unknown>
  clearObject(): Promise<unknown>
  setAmbientLight(lux: number): Promise<unknown>
  setScannerTilt(degrees: number): Promise<unknown>
  setBeamOccluded(occluded: boolean): Promise<unknown>
}

export const scene: R129Scene = {
  bind(gltf, ctx: SceneContext<R129Instrument>) {
    const world = ctx.world as unknown as R129WorldMutations & typeof ctx.world

    // Drag the belt forward/backward to set speed.
    const offBeltDrag = gltf.onDrag('belt', (e) => {
      const next = Math.max(0.1, Math.min(1.5, 0.5 + (e.deltaX ?? 0) * 0.05))
      void world.setConveyorSpeed(next)
    })

    // Click the feeder to drop a parcel on the belt.
    const offFeederClick = gltf.onClick('feeder', () => {
      void world.feedObject(60, 40, 30)
    })

    // Drag the scanner head to tilt it.
    const offScannerDrag = gltf.onDrag('scanner', (e) => {
      void world.setScannerTilt((e.deltaY ?? 0) * 0.3)
    })

    // Drag the lamp to adjust ambient light.
    const offLampDrag = gltf.onDrag('lamp', (e) => {
      const next = Math.max(0, Math.min(2000, 500 + (e.deltaY ?? 0) * 20))
      void world.setAmbientLight(next)
    })

    return () => { offBeltDrag(); offFeederClick(); offScannerDrag(); offLampDrag() }
  },
}

export default scene
