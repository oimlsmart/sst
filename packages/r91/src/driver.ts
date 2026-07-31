// driver.ts — the target-driving helper: script the vehicle's speed
// profile over virtual time. Keyframed, linearly interpolated, holding
// the last value — the ProfilePlayer idiom of the D 11 environment
// layer, applied to the road. Deterministic (driven only by VirtualClock
// advance notifications).
import type { VirtualClock } from '@primmel/sst-runtime/time'

export interface SpeedKeyframe { atS: number; speedKmh: number }

/** The scripted speed at program time t: linear between keyframes,
 *  the first value before t=0... the first keyframe holds before its
 *  timestamp, the last holds after the program ends. */
export function speedAt(keyframes: SpeedKeyframe[], t: number): number {
  const first = keyframes[0]!
  if (t <= first.atS) return first.speedKmh
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]!, b = keyframes[i + 1]!
    if (t <= b.atS) {
      const span = b.atS - a.atS
      const f = span <= 0 ? 1 : (t - a.atS) / span
      return a.speedKmh + (b.speedKmh - a.speedKmh) * f
    }
  }
  return keyframes[keyframes.length - 1]!.speedKmh
}

/** Validate an authored profile: ≥ 1 keyframe, non-negative timestamps,
 *  non-decreasing, speeds ≥ 0. Throws with the first precise error. */
export function validateSpeedKeyframes(keyframes: SpeedKeyframe[]): void {
  if (keyframes.length === 0) throw new Error('driveProfile requires at least one keyframe')
  let prev = -Infinity
  for (const [i, k] of keyframes.entries()) {
    if (!(k.atS >= 0)) throw new Error(`driveProfile keyframe ${i}: atS must be ≥ 0, got ${k.atS}`)
    if (k.atS < prev) throw new Error(`driveProfile keyframe ${i}: atS must be non-decreasing`)
    if (!(k.speedKmh >= 0)) throw new Error(`driveProfile keyframe ${i}: speedKmh must be ≥ 0, got ${k.speedKmh}`)
    prev = k.atS
  }
}

/** Plays a speed profile onto an apply() sink as the clock advances. */
export class SpeedProfilePlayer {
  #keyframes: SpeedKeyframe[]
  #off: (() => void) | undefined

  constructor(keyframes: SpeedKeyframe[]) {
    validateSpeedKeyframes(keyframes)
    this.#keyframes = keyframes.map(k => ({ ...k }))
  }

  start(clock: VirtualClock, apply: (speedKmh: number) => void): void {
    let programT = 0
    apply(this.#keyframes[0]!.speedKmh)
    this.#off = clock.onAdvance(dt => {
      programT += dt
      apply(speedAt(this.#keyframes, programT))
    })
  }

  stop(): void { this.#off?.(); this.#off = undefined }
}
