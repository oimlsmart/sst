import { describe, it, expect } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createTwinDriver } from '@primmel/sst-runtime/twin/driver'
import { LC500_CONTRACT } from '@primmel/sst-runtime/twin-contract'

const BIN = join(dirname(fileURLToPath(import.meta.url)), 'bin.ts')
const TSX = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'node_modules', '.bin', 'tsx')

interface Boot { url: string; child: ChildProcess; output: string }

async function boot(args: string[] = [], env: Record<string, string> = {}): Promise<Boot> {
  const child = spawn(TSX, [BIN, '--port', '0', ...args], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...env } })
  let output = ''
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`boot timeout; output so far:\n${output}`)), 25000)
    child.stdout!.on('data', (d: Buffer) => {
      output += d.toString()
      const m = /bench \+ landing:\s+(http:\/\/localhost:\d+)\//.exec(output)
      if (m) { clearTimeout(timer); resolve(m[1]!) }
    })
    child.stderr!.on('data', (d: Buffer) => { output += d.toString() })
    child.on('exit', code => reject(new Error(`exited ${code}; output:\n${output}`)))
  })
  return { url, child, output }
}

async function gql(url: string, channel: string, query: string): Promise<unknown> {
  const res = await fetch(`${url}${channel}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  })
  return (await res.json() as { data?: unknown }).data
}

describe('sim-lc500 (standalone boot, spec §9)', () => {
  it('boots zero-SMART (baked contract) and serves both channels + landing', async () => {
    const { url, child } = await boot()
    try {
      const ind = await gql(url, '/twin', `{ indication { value unit servedAt } }`) as { indication: { unit: string } }
      expect(ind.indication.unit).toBe('kg')
      // The typed TwinDriver gives the same answer — methods derived from
      // LC500_CONTRACT at compile time.
      const driver = createTwinDriver(LC500_CONTRACT, `${url}/twin`)
      const typedInd = await driver.indication()
      expect(typedInd.unit).toBe('kg')
      await gql(url, '/world', `mutation { placeLoad(massKg: 40) { groundTruth { appliedLoadKg } } }`)
      const gt = await gql(url, '/world', `{ groundTruth { appliedLoadKg } }`) as { groundTruth: { appliedLoadKg: number } }
      expect(gt.groundTruth.appliedLoadKg).toBe(40)
      const landing = await fetch(`${url}/`)
      expect(await landing.text()).toContain('/twin')
    } finally {
      child.kill('SIGTERM')
    }
  }, 40000)

  it('--scenario creep-cell creeps beyond good-cell over 10 virtual minutes', async () => {
    const measure = async (scenario: string): Promise<number> => {
      const { url, child } = await boot(['--scenario', scenario])
      try {
        const driver = createTwinDriver(LC500_CONTRACT, `${url}/twin`)
        await gql(url, '/world', `mutation { advanceTime(seconds: 400) { clock } }`)
        await gql(url, '/world', `mutation { placeLoad(massKg: 500) { clock } }`)
        await gql(url, '/world', `mutation { advanceTime(seconds: 5) { clock } }`)
        const a = await driver.indication()
        await gql(url, '/world', `mutation { advanceTime(seconds: 600) { clock } }`)
        const b = await driver.indication()
        return b.value - a.value
      } finally {
        child.kill('SIGTERM')
      }
    }
    const good = await measure('good-cell')
    const creep = await measure('creep-cell')
    expect(creep).toBeGreaterThan(Math.abs(good) * 5)
  }, 80000)

  it('SIM_WORLD_TOKEN guards /world mutations (env → server); queries and /twin stay open', async () => {
    const { url, child, output } = await boot([], { SIM_WORLD_TOKEN: 's3cret-world-token' })
    try {
      expect(output).toMatch(/\/world mutations guarded/)
      const mutate = (token?: string) => fetch(`${url}/world`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token !== undefined ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ query: `mutation { placeLoad(massKg: 40) { groundTruth { appliedLoadKg } } }` }),
      })
      expect((await mutate()).status).toBe(401)
      const ok = await mutate('s3cret-world-token')
      expect(ok.status).toBe(200)
      const body = await ok.json() as { data: { placeLoad: { groundTruth: { appliedLoadKg: number } } } }
      expect(body.data.placeLoad.groundTruth.appliedLoadKg).toBe(40)
      // queries + /twin: no token needed
      const gt = await gql(url, '/world', `{ groundTruth { appliedLoadKg } }`) as { groundTruth: { appliedLoadKg: number } }
      expect(gt.groundTruth.appliedLoadKg).toBe(40)
      const driver = createTwinDriver(LC500_CONTRACT, `${url}/twin`)
      const ind = await driver.indication()
      expect(ind.unit).toBe('kg')
    } finally {
      child.kill('SIGTERM')
    }
  }, 40000)

  it('serves the full instrument model via Query.instrument (the model mirror)', async () => {
    const { url, child } = await boot()
    try {
      const result = await gql(url, '/twin', `{ instrument {
        identification { instrumentId manufacturer kindId oimlRecommendation }
        classification { accuracyClass nLc construction technology }
        designParameters { eMax { value unit } tMin { value unit } }
        metrologicalLimits { mpeBands { lower upper factor } creepAllowance }
        provenance { certificate }
        servedRegisters { target returnType }
      } }`) as { instrument: {
        identification: { instrumentId: string; manufacturer: string; kindId: string; oimlRecommendation: string }
        classification: { accuracyClass: string; nLc: number; construction: string; technology: string }
        designParameters: { eMax: { value: number; unit: string }; tMin: { value: number; unit: string } }
        metrologicalLimits: { mpeBands: Array<{ lower: number; upper: number | null; factor: number }>; creepAllowance: number }
        provenance: { certificate: string }
        servedRegisters: Array<{ target: string; returnType: string }>
      } }
      const i = result.instrument
      expect(i.identification.instrumentId).toBe('acme-lc500')
      expect(i.identification.manufacturer).toBe('ACME Instruments')
      expect(i.identification.kindId).toBe('primmel-sst-r60')
      expect(i.identification.oimlRecommendation).toBe('OIML R 60')
      expect(i.classification.accuracyClass).toBe('C')
      expect(i.classification.nLc).toBe(6000)
      expect(i.designParameters.eMax).toEqual({ value: 500, unit: 'https://si-digital-framework.org/SI/units/kilogram' })
      expect(i.designParameters.tMin.unit).toBe('https://si-digital-framework.org/SI/units/kelvin')
      expect(i.metrologicalLimits.mpeBands.length).toBeGreaterThan(0)
      expect(i.provenance.certificate).toBe('R60/2021-DE-24-071')
      expect(i.servedRegisters.map((s) => s.target).sort()).toEqual(['indication', 'state'])
    } finally {
      child.kill('SIGTERM')
    }
  }, 40000)
})
