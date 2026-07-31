import { describe, it, expect } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createTwinDriver } from '@primmel/sst-runtime/twin/driver'
import { MD3XX_CONTRACT } from '@primmel/sst-runtime/twin-contract'

const BIN = join(dirname(fileURLToPath(import.meta.url)), 'bin.ts')
const TSX = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'node_modules', '.bin', 'tsx')

interface Boot { url: string; child: ChildProcess; output: string }

async function boot(args: string[] = []): Promise<Boot> {
  const child = spawn(TSX, [BIN, '--port', '0', ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
  let output = ''
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`boot timeout; output so far:\n${output}`)), 25000)
    child.stdout!.on('data', (d: Buffer) => {
      output += d.toString()
      const m = /landing:\s+(http:\/\/localhost:\d+)\//.exec(output)
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
  const body = await res.json() as { data?: unknown; errors?: unknown }
  if (body.errors) throw new Error(JSON.stringify(body.errors))
  return body.data
}

describe('sim-md (standalone boot, spec §9)', () => {
  it('boots zero-SMART (baked contract) and serves both channels + landing', async () => {
    const { url, child } = await boot()
    try {
      const landing = await fetch(`${url}/`)
      expect(await landing.text()).toContain('/twin')
      await gql(url, '/world', `mutation { advanceTime(seconds: 400) { clock } }`) // warm-up
      await gql(url, '/world', `mutation { feedObject(lengthCm: 60, widthCm: 40, heightCm: 30) { groundTruth { object { positionM } } } }`)
      await gql(url, '/world', `mutation { advanceTime(seconds: 1) { groundTruth { lastReading { valid } } } }`)
      // Typed TwinDriver — methods derived from MD3XX_CONTRACT.
      const driver = createTwinDriver(MD3XX_CONTRACT, `${url}/twin`)
      const [len, wid, hgt] = await Promise.all([
        driver.indicationLength(), driver.indicationWidth(), driver.indicationHeight(),
      ])
      expect(len.unit).toBe('cm')
      expect(Math.abs(len.value - 60)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(wid.value - 40)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(hgt.value - 30)).toBeLessThanOrEqual(0.5)
      const [vol, wt] = await Promise.all([driver.dimVolume(), driver.dimWeight()])
      expect(vol.unit).toBe('cm3')
      expect(vol.value).toBeCloseTo(len.value * wid.value * hgt.value, 6)
      expect(wt.value).toBeCloseTo(vol.value / 5000, 6)
      const st = await driver.state()
      expect(st).toBe('ready')
    } finally {
      child.kill('SIGTERM')
    }
  }, 40000)

  it('--scenario thermally-cycled serves the residual through /twin (the preset realizes through physics)', async () => {
    const { url, child } = await boot(['--scenario', 'thermally-cycled'])
    try {
      const driver = createTwinDriver(MD3XX_CONTRACT, `${url}/twin`)
      await gql(url, '/world', `mutation { advanceTime(seconds: 400) { clock } }`)
      await gql(url, '/world', `mutation { feedObject(lengthCm: 100, widthCm: 40, heightCm: 30) { clock } }`)
      await gql(url, '/world', `mutation { advanceTime(seconds: 2) { clock } }`)
      const len = await driver.indicationLength()
      expect(len.value - 100).toBeGreaterThanOrEqual(1.0)
      const result = await driver.runSelfTest()
      expect(result.state).toBe('fault') // the checking facility catches the residual
    } finally {
      child.kill('SIGTERM')
    }
  }, 40000)
})
