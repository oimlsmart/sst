import { describe, it, expect } from 'vitest'
import { createYoga } from 'graphql-yoga'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { VirtualClock } from '@sim/core/time'
import { mulberry32 } from '@sim/core/physics/rng'
import { generateTwinSchema, type TwinIo } from '@sim/core/twin-schema'
import { checkTwinConformance } from '@sim/core/conformance'
import { loadBakedContract, type BakedContract } from '@sim/core/twin-bake'
import { MultiDimensionalInstrument, type ConveyorObjectSpec } from './instrument.js'
import { getMdScenario } from './scenarios.js'
import { MD350_CONTRACT } from './twin-contract.js'

const BOX: ConveyorObjectSpec = {
  lengthCm: 60, widthCm: 40, heightCm: 30,
  shape: 'rectangular', reflectance: 0.9, protrusionCm: 0, orientationDeg: 0,
}

function boot(scenario = 'good-dimensioner') {
  const clock = new VirtualClock()
  const instrument = new MultiDimensionalInstrument(getMdScenario(scenario), clock, mulberry32(7))
  const io: TwinIo = {
    get instrument() { return instrument },
    clock,
    registers: {
      indication_length: () => ({ value: instrument.dimensionsCm().lengthCm, unit: 'cm', kind: 'length', servedAt: instrument.servedAt() }),
      indication_width: () => ({ value: instrument.dimensionsCm().widthCm, unit: 'cm', kind: 'length', servedAt: instrument.servedAt() }),
      indication_height: () => ({ value: instrument.dimensionsCm().heightCm, unit: 'cm', kind: 'length', servedAt: instrument.servedAt() }),
      dim_volume: () => ({ value: instrument.volumeCm3(), unit: 'cm3', kind: 'volume', servedAt: instrument.servedAt() }),
      dim_weight: () => ({ value: instrument.dimWeightKg(), unit: 'kg', kind: 'mass', servedAt: instrument.servedAt() }),
    },
    operations: { run_self_test: () => instrument.selfTest() },
  }
  const schema = generateTwinSchema(MD350_CONTRACT, io)
  const yoga = createYoga({ schema, graphqlEndpoint: '/twin' })
  return { clock, instrument, schema, yoga }
}

async function gql(yoga: ReturnType<typeof createYoga>, query: string): Promise<unknown> {
  const res = await yoga.fetch('http://localhost/twin', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  })
  const body = await res.json() as { data?: unknown; errors?: unknown }
  if (body.errors) throw new Error(JSON.stringify(body.errors))
  return body.data
}

describe('the dimensioner /twin (generated from the serve contract — law 2)', () => {
  it('the generated schema is conformant with the contract (schema ≡ serves)', () => {
    const { schema } = boot()
    expect(checkTwinConformance(schema, MD350_CONTRACT)).toEqual([])
  })

  it('the per-axis registers serve cm with freshness metadata; volume and weight follow in agreement', async () => {
    const { clock, instrument, yoga } = boot()
    clock.advance(400) // warm-up
    instrument.feedObject(BOX)
    clock.advance(1) // traversal completes
    const d = await gql(yoga, `{
      indicationLength { value unit kind servedAt }
      indicationWidth { value unit }
      indicationHeight { value unit }
      dimVolume { value unit kind }
      dimWeight { value unit kind }
    }`) as {
      indicationLength: { value: number; unit: string; kind: string; servedAt: number }
      indicationWidth: { value: number; unit: string }
      indicationHeight: { value: number; unit: string }
      dimVolume: { value: number; unit: string; kind: string }
      dimWeight: { value: number; unit: string; kind: string }
    }
    expect(d.indicationLength.unit).toBe('cm')
    expect(d.indicationLength.kind).toBe('length')
    expect(Math.abs(d.indicationLength.value - 60)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(d.indicationWidth.value - 40)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(d.indicationHeight.value - 30)).toBeLessThanOrEqual(0.5)
    expect(d.indicationLength.servedAt).toBe(clock.now())
    expect(d.dimVolume.unit).toBe('cm3')
    expect(d.dimVolume.value).toBeCloseTo(
      d.indicationLength.value * d.indicationWidth.value * d.indicationHeight.value, 6,
    )
    expect(d.dimWeight.unit).toBe('kg')
    expect(d.dimWeight.value).toBeCloseTo(d.dimVolume.value / 5000, 6)
  })

  it('the epistemic wall at the schema level: /twin carries no world field', async () => {
    const { yoga } = boot()
    const res = await yoga.fetch('http://localhost/twin', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: `{ __schema { queryType { fields { name } } mutationType { fields { name } } } }` }),
    })
    const body = await res.json() as { data: { __schema: { queryType: { fields: Array<{ name: string }> }; mutationType: { fields: Array<{ name: string }> } } } }
    const queries = body.data.__schema.queryType.fields.map(f => f.name)
    const mutations = body.data.__schema.mutationType.fields.map(f => f.name)
    expect(queries.sort()).toEqual([
      'dimVolume', 'dimWeight', 'environmentalContext',
      'indicationHeight', 'indicationLength', 'indicationWidth', 'state',
    ])
    expect(mutations.sort()).toEqual(['runSelfTest'])
    // no object, no conveyor, no groundTruth — the world is unreachable
    for (const f of [...queries, ...mutations]) expect(f).not.toMatch(/object|conveyor|ground|world|feed|ambient/i)
  })

  it('op_state and the instrument-legal operations answer the legal view', async () => {
    const { clock, yoga } = boot()
    clock.advance(400)
    const s0 = await gql(yoga, `{ state }`) as { state: string }
    expect(s0.state).toBe('ready')
    const st = await gql(yoga, `mutation { runSelfTest { state } }`) as { runSelfTest: { state: string } }
    expect(st.runSelfTest.state).toBe('ready')
  })

  it('run_self_test invokes the real checking facility: an encoder slip beyond the bound trips the fault latch', async () => {
    const { clock, instrument, yoga } = boot()
    clock.advance(400)
    const ok = await gql(yoga, `mutation { runSelfTest { state } }`) as { runSelfTest: { state: string } }
    expect(ok.runSelfTest.state).toBe('ready')
    instrument.setEncoderSlip(0.02) // 50 cm × 2 % = 1 cm ≫ the 0.4 cm bound
    const bad = await gql(yoga, `mutation { runSelfTest { state } }`) as { runSelfTest: { state: string } }
    expect(bad.runSelfTest.state).toBe('fault') // the invoke DID something — realized from the physics
    expect(instrument.faultLatched).toBe(true)
    // the package declares no fault-report operation: the fault report
    // IS the state answer (R 129-1, 5.6.1), served by state / watch_state
    const s = await gql(yoga, `{ state }`) as { state: string }
    expect(s.state).toBe('fault')
  })

  it('watch_state streams: warming → ready on clock advance (SSE)', async () => {
    const { clock, yoga } = boot()
    const res = await yoga.fetch('http://localhost/twin', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: `subscription { state }` }),
    })
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    const states: string[] = []
    let buf = ''
    try {
      while (states.length < 2) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data:'))
          if (dataLine) states.push((JSON.parse(dataLine.slice(5).trim()) as { data: { state: string } }).data.state)
        }
        if (states.length === 1) clock.advance(400) // cross the warm-up boundary
      }
    } finally {
      await reader.cancel()
    }
    expect(states).toEqual(['warming', 'ready'])
  }, 10000)

  it('the baked artifact rides the real product package, byte-fresh', async () => {
    const raw = JSON.parse(await readFile(join(dirname(fileURLToPath(import.meta.url)), '..', 'twin', 'md.twin.json'), 'utf-8')) as BakedContract
    expect(raw.source).toMatch(/acme-md3xx/)
    expect(raw.contract).toEqual(MD350_CONTRACT)
    expect(await loadBakedContract(join(dirname(fileURLToPath(import.meta.url)), '..', 'twin', 'md.twin.json'))).toEqual(MD350_CONTRACT)
  })
})
