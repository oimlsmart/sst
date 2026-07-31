// ACME RS-180 — 3D interactivity binding.
//
// The radar's 3D model exposes: a target vehicle (drive it through
// the beam), an antenna node (tilt it to misalign), an oscillator
// dial (tune its drift), and a rain/snow intensity slider.

import type { R91Scene, R91Instrument } from '../../../kinds/sst-r91/interface.d.ts'
import type { SceneContext } from '../../../runtime/sst-runtime/src/scene/context.js'

const TARGET_SPEED_STEP_KMH = 5

interface R91WorldMutations {
  setTarget(speedKmh: number, rangeM?: number, angleDeg?: number): Promise<unknown>
  clearTarget(): Promise<unknown>
  setRain(rateMmH: number): Promise<unknown>
  setVibration(severity: number): Promise<unknown>
  setEmi(severity: number): Promise<unknown>
  setOscillatorDrift(ppm: number): Promise<unknown>
  setAntennaMisalignment(degrees: number): Promise<unknown>
  setInterferenceSource(band: string, powerDbm: number): Promise<unknown>
  clearInterferenceSource(): Promise<unknown>
  driveProfile(profileId: string): Promise<unknown>
  stopProfile(): Promise<unknown>
}

export const scene: R91Scene = {
  bind(gltf, ctx: SceneContext<R91Instrument>) {
    const world = ctx.world as unknown as R91WorldMutations & typeof ctx.world

    // Drag the target node forward/backward to set speed.
    const offTargetDrag = gltf.onDrag('target', (e) => {
      const current = ctx.instrument.indication().value
      const next = Math.max(0, Math.min(180, current + (e.deltaZ ?? 0) * TARGET_SPEED_STEP_KMH))
      void world.setTarget(next)
    })

    // Drag the antenna node to tilt it (misalignment).
    const offAntennaDrag = gltf.onDrag('antenna', (e) => {
      void world.setAntennaMisalignment((e.deltaX ?? 0) * 0.5)
    })

    // Drag the oscillator dial to introduce carrier drift.
    const offOscDrag = gltf.onDrag('oscillator', (e) => {
      void world.setOscillatorDrift((e.deltaY ?? 0) * 2)
    })

    // Click the rain button to toggle a moderate rain profile.
    const offRainClick = gltf.onClick('rain-button', () => {
      void world.setRain(5)
    })

    return () => { offTargetDrag(); offAntennaDrag(); offOscDrag(); offRainClick() }
  },
}

export default scene
