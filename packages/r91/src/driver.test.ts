import { describe, it, expect } from 'vitest'
import { VirtualClock } from '@sim/core/time'
import { speedAt, validateSpeedKeyframes, SpeedProfilePlayer } from './driver.js'

const PROFILE = [
  { atS: 0, speedKmh: 30 },
  { atS: 60, speedKmh: 90 },
  { atS: 120, speedKmh: 90 },
]

describe('the target-driving helper (vehicle speed profiles)', () => {
  it('interpolates linearly between keyframes and holds the ends', () => {
    expect(speedAt(PROFILE, 0)).toBe(30)
    expect(speedAt(PROFILE, 30)).toBe(60)
    expect(speedAt(PROFILE, 60)).toBe(90)
    expect(speedAt(PROFILE, 90)).toBe(90)
    expect(speedAt(PROFILE, 500)).toBe(90) // hold last
  })

  it('validates: non-empty, non-decreasing atS, non-negative speeds', () => {
    expect(() => validateSpeedKeyframes([])).toThrow(/at least one keyframe/)
    expect(() => validateSpeedKeyframes([{ atS: 60, speedKmh: 50 }, { atS: 30, speedKmh: 50 }])).toThrow(/non-decreasing/)
    expect(() => validateSpeedKeyframes([{ atS: 0, speedKmh: -5 }])).toThrow(/≥ 0/)
  })

  it('drives the sink on the virtual clock, deterministically', () => {
    const clock = new VirtualClock()
    const seen: number[] = []
    const player = new SpeedProfilePlayer(PROFILE)
    player.start(clock, kmh => seen.push(kmh))
    expect(seen).toEqual([30]) // applied immediately
    clock.advance(30)
    expect(seen[seen.length - 1]).toBe(60)
    clock.advance(60)
    expect(seen[seen.length - 1]).toBe(90)
    clock.advance(600)
    expect(seen[seen.length - 1]).toBe(90)
    player.stop()
    clock.advance(10)
    expect(seen[seen.length - 1]).toBe(90) // stopped: no further applies
  })
})
