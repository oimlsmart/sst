import { describe, it, expect } from 'vitest'
import { createYoga } from 'graphql-yoga'
import { VirtualClock } from '@primmel/sst-runtime/time'
import { mulberry32 } from '@primmel/sst-runtime/physics/rng'
import { RadarSpeedMeter } from './instrument.js'
import { getR91Scenario } from './scenarios.js'
import { buildR91WorldSchema, type R91WorldContext } from './world.js'

function boot(scenario = 'good-radar') {
  const clock = new VirtualClock()
  const host: R91WorldContext = {
    instrument: new RadarSpeedMeter(getR91Scenario(scenario), clock, mulberry32(7)),
    clock,
    swap(def) { this.instrument = new RadarSpeedMeter(def, clock, mulberry32(7)) },
  }
  const yoga = createYoga({ schema: buildR91WorldSchema(host), graphqlEndpoint: '/world' })
  return { clock, host, yoga }
}

async function gql(yoga: ReturnType<typeof createYoga>, query: string): Promise<unknown> {
  const res = await yoga.fetch('http://localhost/world', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  })
  const body = await res.json() as { data?: unknown; errors?: unknown }
  if (body.errors) throw new Error(JSON.stringify(body.errors))
  return body.data
}

describe('the radar /world family (registered through the seam)', () => {
  it('setTarget/rain/vibration/EMI mutate the world; ground truth shows reality', async () => {
    const { yoga, clock } = boot()
    clock.advance(200)
    const d = await gql(yoga, `mutation {
      setTarget(speedKmh: 87, rangeM: 150, angleDeg: 12, rcsM2: 5) {
        groundTruth { target { speedKmh rangeM angleDeg rcsM2 } }
      }
    }`) as { setTarget: { groundTruth: { target: { speedKmh: number; rangeM: number } } } }
    expect(d.setTarget.groundTruth.target.speedKmh).toBe(87)
    expect(d.setTarget.groundTruth.target.rangeM).toBe(150)
    await gql(yoga, `mutation { setRain(rateMmH: 25) { groundTruth { rainRateMmH } } }`)
    await gql(yoga, `mutation { setVibration(severity: 1) { groundTruth { vibrationSeverity } } }`)
    const q = await gql(yoga, `mutation { setEmi(severity: 1) { groundTruth { emiSeverity rainRateMmH vibrationSeverity } } }`) as { setEmi: { groundTruth: { emiSeverity: number; rainRateMmH: number; vibrationSeverity: number } } }
    expect(q.setEmi.groundTruth).toMatchObject({ emiSeverity: 1, rainRateMmH: 25, vibrationSeverity: 1 })
  })

  it('the family schema carries NO load-cell vocabulary (families compose, never fork)', async () => {
    const { yoga } = boot()
    const res = await yoga.fetch('http://localhost/world', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: `mutation { placeLoad(massKg: 40) { clock } }` }),
    })
    const body = await res.json() as { errors?: unknown }
    expect(body.errors).toBeDefined() // placeLoad does not exist on the road
  })

  it('the fault knobs realize through physics: oscillator drift and misalignment move the reading, not the indication register', async () => {
    const { yoga, clock } = boot()
    clock.advance(200)
    await gql(yoga, `mutation { setTarget(speedKmh: 100, rangeM: 120) { clock } }`)
    const d = await gql(yoga, `mutation { setOscillatorDrift(biasPpm: 8000) { groundTruth { oscillatorErrorPpm carrierActualHz } } }`) as { setOscillatorDrift: { groundTruth: { oscillatorErrorPpm: number; carrierActualHz: number } } }
    expect(d.setOscillatorDrift.groundTruth.oscillatorErrorPpm).toBeCloseTo(8000, 6)
    expect(d.setOscillatorDrift.groundTruth.carrierActualHz).toBeCloseTo(24.15e9 * 1.008, 0)
    await gql(yoga, `mutation { setAntennaMisalignment(angleDeg: 10) { clock } }`)
    await expect(gql(yoga, `mutation { setRain(rateMmH: -1) { clock } }`)).rejects.toThrow()
  })

  it('the interference source comes and goes through /world', async () => {
    const { yoga, clock } = boot()
    clock.advance(200)
    const d = await gql(yoga, `mutation {
      setInterferenceSource(apparentSpeedKmh: 45, rcsM2: 12, rangeM: 80) { groundTruth { interference { apparentSpeedKmh } } }
    }`) as { setInterferenceSource: { groundTruth: { interference: { apparentSpeedKmh: number } } } }
    expect(d.setInterferenceSource.groundTruth.interference.apparentSpeedKmh).toBe(45)
    const c = await gql(yoga, `mutation { clearInterferenceSource { groundTruth { interference { apparentSpeedKmh } } } }`) as { clearInterferenceSource: { groundTruth: { interference: null } } }
    expect(c.clearInterferenceSource.groundTruth.interference).toBeNull()
  })

  it('driveProfile scripts the vehicle over the virtual clock; stopProfile holds', async () => {
    const { yoga, clock } = boot()
    clock.advance(200)
    await gql(yoga, `mutation { setTarget(speedKmh: 30, rangeM: 150) { clock } }`)
    await gql(yoga, `mutation { driveProfile(keyframes: [{ atS: 0, speedKmh: 30 }, { atS: 60, speedKmh: 90 }]) { clock } }`)
    await gql(yoga, `mutation { advanceTime(seconds: 30) { clock } }`)
    let q = await gql(yoga, `{ groundTruth { target { speedKmh } } }`) as { groundTruth: { target: { speedKmh: number } } }
    expect(q.groundTruth.target.speedKmh).toBe(60)
    await gql(yoga, `mutation { advanceTime(seconds: 30) { clock } }`)
    q = await gql(yoga, `{ groundTruth { target { speedKmh } } }`) as { groundTruth: { target: { speedKmh: number } } }
    expect(q.groundTruth.target.speedKmh).toBe(90)
    await gql(yoga, `mutation { stopProfile { clock } }`)
    await expect(gql(yoga, `mutation { driveProfile(keyframes: []) { clock } }`)).rejects.toThrow()
  })

  it('scenario swaps the instrument into the named preset (the scenarios registry is the family\'s)', async () => {
    const { yoga, clock } = boot()
    clock.advance(200)
    const d = await gql(yoga, `mutation { scenario(name: "interference-present") { groundTruth { interference { apparentSpeedKmh } } } }`) as { scenario: { groundTruth: { interference: { apparentSpeedKmh: number } } } }
    expect(d.scenario.groundTruth.interference.apparentSpeedKmh).toBe(45)
    const q = await gql(yoga, `{ scenarios { name } }`) as { scenarios: Array<{ name: string }> }
    expect(q.scenarios.map(s => s.name).sort()).toEqual(['angle-misaligned', 'good-radar', 'interference-present', 'temperature-drifting'])
    await expect(gql(yoga, `mutation { scenario(name: "good-cell") { clock } }`)).rejects.toThrow()
  })

  it('the base world still works: D 11 environment, profiles, fault latch, reset', async () => {
    const { yoga, clock } = boot()
    clock.advance(200)
    await gql(yoga, `mutation { setEnvironment(conditions: { temperatureDegC: 60 }) { groundTruth { environment { temperatureDegC } } } }`)
    await gql(yoga, `mutation { playProfile(profile: "cold-aa1") { clock } }`)
    await gql(yoga, `mutation { advanceTime(seconds: 7200) { clock } }`)
    const q = await gql(yoga, `{ groundTruth { environment { temperatureDegC } oscillatorErrorPpm } }`) as { groundTruth: { environment: { temperatureDegC: number }; oscillatorErrorPpm: number } }
    expect(q.groundTruth.environment.temperatureDegC).toBe(-10)
    expect(q.groundTruth.oscillatorErrorPpm).toBeLessThan(0) // the oscillator felt the cold — through physics
    await gql(yoga, `mutation { injectFault { clock } }`)
    const r = await gql(yoga, `mutation { reset { groundTruth { environment { temperatureDegC } rainRateMmH } } }`) as { reset: { groundTruth: { environment: { temperatureDegC: number }; rainRateMmH: number } } }
    expect(r.reset.groundTruth.environment.temperatureDegC).toBe(20)
  })
})
