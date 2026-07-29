import { describe, it, expect } from 'vitest'
import { createYoga } from 'graphql-yoga'
import { VirtualClock } from '@sim/core/time'
import { mulberry32 } from '@sim/core/physics/rng'
import { MultiDimensionalInstrument } from './instrument.js'
import { getMdScenario } from './scenarios.js'
import { buildMdWorldSchema, type MdWorldContext } from './world.js'

function boot(scenario = 'good-dimensioner') {
  const clock = new VirtualClock()
  const host: MdWorldContext = {
    instrument: new MultiDimensionalInstrument(getMdScenario(scenario), clock, mulberry32(7)),
    clock,
    swap(def) { this.instrument = new MultiDimensionalInstrument(def, clock, mulberry32(7)) },
  }
  const yoga = createYoga({ schema: buildMdWorldSchema(host), graphqlEndpoint: '/world' })
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

describe('the dimensioner /world family (registered through the seam)', () => {
  it('feed/speed/light/EMI mutate the world; ground truth shows reality', async () => {
    const { yoga, clock } = boot()
    clock.advance(400)
    await gql(yoga, `mutation { setConveyorSpeed(speedMS: 1.2) { groundTruth { conveyorSpeedMS } } }`)
    const d = await gql(yoga, `mutation {
      feedObject(lengthCm: 60, widthCm: 40, heightCm: 30) {
        groundTruth { conveyorSpeedMS object { lengthCm shape reflectance positionM } }
      }
    }`) as { feedObject: { groundTruth: { conveyorSpeedMS: number; object: { lengthCm: number; shape: string; reflectance: number } } } }
    expect(d.feedObject.groundTruth.conveyorSpeedMS).toBe(1.2)
    expect(d.feedObject.groundTruth.object.shape).toBe('rectangular') // the defaults apply
    expect(d.feedObject.groundTruth.object.reflectance).toBe(0.9)
    await gql(yoga, `mutation { setAmbientLight(lx: 900) { groundTruth { ambientLx } } }`)
    const q = await gql(yoga, `mutation { setEmi(severity: 1) { groundTruth { ambientLx emiSeverity } } }`) as { setEmi: { groundTruth: { ambientLx: number; emiSeverity: number } } }
    expect(q.setEmi.groundTruth).toMatchObject({ ambientLx: 900, emiSeverity: 1 })
  })

  it('the family schema carries NO load-cell vocabulary (families compose, never fork)', async () => {
    const { yoga } = boot()
    const res = await yoga.fetch('http://localhost/world', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: `mutation { placeLoad(massKg: 40) { clock } }` }),
    })
    const body = await res.json() as { errors?: unknown }
    expect(body.errors).toBeDefined() // placeLoad does not exist on the conveyor
  })

  it('the fault knobs realize through physics: encoder slip scales the measured length, never the indication register', async () => {
    const { yoga, clock } = boot()
    clock.advance(400)
    await gql(yoga, `mutation { feedObject(lengthCm: 60, widthCm: 40, heightCm: 30) { clock } }`)
    await gql(yoga, `mutation { setEncoderSlip(frac: 0.02) { groundTruth { encoderSlipFrac } } }`)
    await gql(yoga, `mutation { advanceTime(seconds: 1) { clock } }`)
    const q = await gql(yoga, `{ groundTruth { lastReading { valid measuredLengthCm } } }`) as { groundTruth: { lastReading: { valid: boolean; measuredLengthCm: number } } }
    expect(q.groundTruth.lastReading.valid).toBe(true)
    expect(q.groundTruth.lastReading.measuredLengthCm).toBeCloseTo(61.2, 0) // 60 × 1.02, through the chain
    await expect(gql(yoga, `mutation { setEncoderSlip(frac: 0.2) { clock } }`)).rejects.toThrow()
  })

  it('the feed driver scripts the parcel flow over the virtual clock; stopFeed holds', async () => {
    const { yoga, clock } = boot()
    clock.advance(400)
    await gql(yoga, `mutation {
      driveFeed(keyframes: [
        { atS: 0, object: { lengthCm: 30, widthCm: 20, heightCm: 10 } },
        { atS: 5, object: { lengthCm: 50, widthCm: 40, heightCm: 30 } },
      ]) { clock }
    }`)
    await gql(yoga, `mutation { advanceTime(seconds: 1) { clock } }`) // the 30 cm box completes (0.3 s)
    const q1 = await gql(yoga, `{ groundTruth { lastReading { valid indicatedLengthCm } object { lengthCm } } }`) as { groundTruth: { lastReading: { valid: boolean; indicatedLengthCm: number }; object: { lengthCm: number } | null } }
    expect(q1.groundTruth.lastReading.valid).toBe(true)
    expect(Math.abs(q1.groundTruth.lastReading.indicatedLengthCm - 30)).toBeLessThanOrEqual(0.5)
    await gql(yoga, `mutation { advanceTime(seconds: 5) { clock } }`) // the 50 cm box feeds at t=5 (tick boundary)
    await gql(yoga, `mutation { advanceTime(seconds: 1) { clock } }`) // …and traverses on the next advance
    const q2 = await gql(yoga, `{ groundTruth { lastReading { valid indicatedLengthCm } } }`) as { groundTruth: { lastReading: { valid: boolean; indicatedLengthCm: number } } }
    expect(q2.groundTruth.lastReading.valid).toBe(true)
    expect(Math.abs(q2.groundTruth.lastReading.indicatedLengthCm - 50)).toBeLessThanOrEqual(0.5)
    await gql(yoga, `mutation { stopFeed { clock } }`)
    await expect(gql(yoga, `mutation { driveFeed(keyframes: []) { clock } }`)).rejects.toThrow()
  })

  it('scenario swaps the instrument into the named preset (the scenarios registry is the family\'s)', async () => {
    const { yoga, clock } = boot()
    clock.advance(400)
    const d = await gql(yoga, `mutation { scenario(name: "high-ambient-light") { groundTruth { ambientLx } } }`) as { scenario: { groundTruth: { ambientLx: number } } }
    expect(d.scenario.groundTruth.ambientLx).toBe(1500)
    const q = await gql(yoga, `{ scenarios { name } }`) as { scenarios: Array<{ name: string }> }
    expect(q.scenarios.map(s => s.name).sort()).toEqual(['dark-objects', 'good-dimensioner', 'high-ambient-light', 'slow-scanner', 'thermally-cycled'])
    await expect(gql(yoga, `mutation { scenario(name: "good-cell") { clock } }`)).rejects.toThrow()
  })

  it('the base world still works: D 11 environment, profiles, fault latch, reset', async () => {
    const { yoga, clock } = boot()
    clock.advance(400)
    await gql(yoga, `mutation { setEnvironment(conditions: { temperatureDegC: 40 }) { groundTruth { environment { temperatureDegC } } } }`)
    let q = await gql(yoga, `{ groundTruth { thermalSpanFrac } }`) as { groundTruth: { thermalSpanFrac: number } }
    expect(q.groundTruth.thermalSpanFrac).toBeCloseTo(0.00046, 8) // the frame felt +20 °C — through physics
    await gql(yoga, `mutation { playProfile(profile: "cold-aa1") { clock } }`)
    await gql(yoga, `mutation { advanceTime(seconds: 7200) { clock } }`)
    const q2 = await gql(yoga, `{ groundTruth { environment { temperatureDegC } thermalSpanFrac } }`) as { groundTruth: { environment: { temperatureDegC: number }; thermalSpanFrac: number } }
    expect(q2.groundTruth.environment.temperatureDegC).toBe(-10)
    expect(q2.groundTruth.thermalSpanFrac).toBeLessThan(0) // the frame contracted — through physics
    await gql(yoga, `mutation { injectFault { clock } }`)
    const r = await gql(yoga, `mutation { reset { groundTruth { environment { temperatureDegC } ambientLx } } }`) as { reset: { groundTruth: { environment: { temperatureDegC: number }; ambientLx: number } } }
    expect(r.reset.groundTruth.environment.temperatureDegC).toBe(20)
    expect(r.reset.groundTruth.ambientLx).toBe(100)
  })
})
