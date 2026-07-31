import { describe, it, expect } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createTwinDriver } from '@primmel/sst-runtime/twin/driver'
import { RS180_CONTRACT } from '@primmel/sst-runtime/twin-contract'

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

describe('sim-r91 (standalone boot, spec §9)', () => {
  it('boots zero-SMART (baked contract) and serves both channels + landing', async () => {
    const { url, child } = await boot()
    try {
      const landing = await fetch(`${url}/`)
      expect(await landing.text()).toContain('/twin')
      await gql(url, '/world', `mutation { advanceTime(seconds: 200) { clock } }`) // warm-up
      await gql(url, '/world', `mutation { setTarget(speedKmh: 87, rangeM: 150) { groundTruth { target { speedKmh } } } }`)
      const gt = await gql(url, '/world', `{ groundTruth { target { speedKmh } } }`) as { groundTruth: { target: { speedKmh: number } } }
      expect(gt.groundTruth.target.speedKmh).toBe(87)
      // Typed TwinDriver — methods derived from RS180_CONTRACT.
      const driver = createTwinDriver(RS180_CONTRACT, `${url}/twin`)
      const ind = await driver.indication()
      expect(ind.unit).toBe('km/h')
      expect(Math.abs(ind.value - 87)).toBeLessThanOrEqual(1)
      const st = await driver.state()
      expect(st).toBe('ready')
    } finally {
      child.kill('SIGTERM')
    }
  }, 40000)

  it('--scenario interference-present serves the ghost through /twin (the preset realizes through physics)', async () => {
    const { url, child } = await boot(['--scenario', 'interference-present'])
    try {
      const driver = createTwinDriver(RS180_CONTRACT, `${url}/twin`)
      await gql(url, '/world', `mutation { advanceTime(seconds: 200) { clock } }`)
      const ind = await driver.indication()
      expect(ind.value).toBe(45) // captured by the 45 km/h ghost
      await gql(url, '/world', `mutation { clearInterferenceSource { clock } }`)
      const clean = await driver.indication()
      expect(Math.abs(clean.value - 50)).toBeLessThanOrEqual(1)
    } finally {
      child.kill('SIGTERM')
    }
  }, 40000)
})
