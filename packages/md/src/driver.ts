// driver.ts — the object-feed helper: script the parcel flow over
// virtual time. Keyframed like the D 11 ProfilePlayer idiom: at each
// keyframe the object feeds — unless the frame is still occupied, in
// which case the feed DEFERS to a later clock advance (a paced
// conveyor gate, never an override and never a lost parcel).
// Deterministic (driven only by VirtualClock advance notifications).
import type { VirtualClock } from '@sim/core/time'
import { validateObjectSpec, type ConveyorObjectSpec } from './physics/geometry.js'

export interface FeedKeyframe { atS: number; object: ConveyorObjectSpec }

/** Validate an authored feed program: ≥ 1 keyframe, non-negative
 *  non-decreasing timestamps, every object spec valid. Throws with the
 *  first precise error. */
export function validateFeedKeyframes(keyframes: FeedKeyframe[]): void {
  if (keyframes.length === 0) throw new Error('driveFeed requires at least one keyframe')
  let prev = -Infinity
  for (const [i, k] of keyframes.entries()) {
    if (!(k.atS >= 0)) throw new Error(`driveFeed keyframe ${i}: atS must be ≥ 0, got ${k.atS}`)
    if (k.atS < prev) throw new Error(`driveFeed keyframe ${i}: atS must be non-decreasing`)
    validateObjectSpec(k.object)
    prev = k.atS
  }
}

/** Plays a feed program onto a feed sink as the clock advances. The
 *  sink answers acceptance: refused feeds stay pending and retry on
 *  every subsequent advance (the defer-while-occupied gate). */
export class ObjectFeedPlayer {
  #keyframes: FeedKeyframe[]
  #off: (() => void) | undefined

  constructor(keyframes: FeedKeyframe[]) {
    validateFeedKeyframes(keyframes)
    this.#keyframes = keyframes.map(k => ({ atS: k.atS, object: { ...k.object } }))
  }

  start(clock: VirtualClock, feed: (spec: ConveyorObjectSpec) => boolean): void {
    let programT = 0
    let next = 0
    const pump = () => {
      while (next < this.#keyframes.length && programT >= this.#keyframes[next]!.atS) {
        if (!feed(this.#keyframes[next]!.object)) return // deferred — retry later
        next++
      }
    }
    pump() // keyframes at t = 0 fire immediately
    this.#off = clock.onAdvance(dt => {
      programT += dt
      pump()
    })
  }

  stop(): void { this.#off?.(); this.#off = undefined }
}
