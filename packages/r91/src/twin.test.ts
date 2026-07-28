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
import { RadarSpeedMeter } from './instrument.js'
import { getR91Scenario } from './scenarios.js'
import { R91_CONTRACT } from './twin-contract.js'

function boot(scenario = 'good-radar') {
  const clock = new VirtualClock()
  const meter = new RadarSpeedMeter(getR91Scenario(scenario), clock, mulberry32(7))
  const io: TwinIo = {
    get instrument() { return meter },
    clock,
    operations: { run_self_test: () => meter.selfTest() },
  }
  const schema = generateTwinSchema(R91_CONTRACT, io)
  const yoga = createYoga({ schema, graphqlEndpoint: '/twin' })
  return { clock, meter, schema, yoga }
}

async function gql(yoga: ReturnType<typeof createYoga>, query: string): Promise<unknown> {
  const res = await yoga.fetch('http://localhost/twin', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  })
  const body = await res.json() as { data?: unknown; errors?: unknown }
  if (body.errors) throw new Error(JSON.stringify(body.errors))
  return body.data
}

describe('the radar /twin (generated from the serve contract — law 2)', () => {
  it('the generated schema is conformant with the contract (schema ≡ serves)', () => {
    const { schema } = boot()
    expect(checkTwinConformance(schema, R91_CONTRACT)).toEqual([])
  })

  it('the speed indication serves km/h with freshness metadata', async () => {
    const { clock, yoga } = boot()
    clock.advance(200)
    const d = await gql(yoga, `{ indication { value unit kind servedAt } }`) as { indication: { value: number; unit: string; kind: string; servedAt: number } }
    expect(d.indication.unit).toBe('km/h')
    expect(d.indication.kind).toBe('speed')
    expect(Math.abs(d.indication.value - 50)).toBeLessThanOrEqual(1)
    expect(d.indication.servedAt).toBe(200)
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
    expect(queries.sort()).toEqual(['environmentalContext', 'indication', 'state'])
    expect(mutations.sort()).toEqual(['runSelfTest'])
    // no target, no groundTruth, no setTarget — the world is unreachable
    for (const f of [...queries, ...mutations]) expect(f).not.toMatch(/target|ground|world|rain/i)
  })

  it('op_state and the instrument-legal operations answer the legal view', async () => {
    const { clock, meter, yoga } = boot()
    clock.advance(200)
    const s0 = await gql(yoga, `{ state }`) as { state: string }
    expect(s0.state).toBe('ready')
    const st = await gql(yoga, `mutation { runSelfTest { state } }`) as { runSelfTest: { state: string } }
    expect(st.runSelfTest.state).toBe('ready')
    meter.injectFault()
    // the package declares no fault-report operation: the fault report
    // IS the state answer (R 91-1, 6.18.4), served by state / watch_state
    const s1 = await gql(yoga, `{ state }`) as { state: string }
    expect(s1.state).toBe('fault')
  })

  it('run_self_test invokes the real diagnostics: an out-of-lock oscillator trips the fault latch', async () => {
    const { clock, meter, yoga } = boot()
    clock.advance(200)
    const ok = await gql(yoga, `mutation { runSelfTest { state } }`) as { runSelfTest: { state: string } }
    expect(ok.runSelfTest.state).toBe('ready') // the good meter's oscillator is in lock
    meter.setOscillatorDrift({ biasPpm: 8000 }) // 8000 ppm ≫ the 1000 ppm lock bound
    const bad = await gql(yoga, `mutation { runSelfTest { state } }`) as { runSelfTest: { state: string } }
    expect(bad.runSelfTest.state).toBe('fault') // the invoke DID something — realized from the physics
    expect(meter.faultLatched).toBe(true)
  })

  it('the indication cannot be steered from /twin: it is the chain\'s output, with noise, never a set value', async () => {
    const { clock, meter, yoga } = boot()
    clock.advance(200)
    meter.setTarget({ speedKmh: 15, rangeM: 300 }) // below the interval — a real meter shows nothing new
    const d = await gql(yoga, `{ indication { value } }`) as { indication: { value: number } }
    expect(d.indication.value).not.toBe(15) // held — never an override
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
        if (states.length === 1) clock.advance(200) // cross the warm-up boundary
      }
    } finally {
      await reader.cancel()
    }
    expect(states).toEqual(['warming', 'ready'])
  }, 10000)

  it('the baked artifact rides the real product package, byte-fresh', async () => {
    const raw = JSON.parse(await readFile(join(dirname(fileURLToPath(import.meta.url)), '..', 'twin', 'r91.twin.json'), 'utf-8')) as BakedContract
    expect(raw.source).toMatch(/acme-rs180/)
    expect(raw.contract).toEqual(R91_CONTRACT)
    expect(await loadBakedContract(join(dirname(fileURLToPath(import.meta.url)), '..', 'twin', 'r91.twin.json'))).toEqual(R91_CONTRACT)
  })
})
