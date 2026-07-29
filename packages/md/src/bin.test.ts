import { describe, it, expect } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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
      const dims = await gql(url, '/twin', `{ indicationLength { value unit } indicationWidth { value } indicationHeight { value } }`) as {
        indicationLength: { value: number; unit: string }
        indicationWidth: { value: number }
        indicationHeight: { value: number }
      }
      expect(dims.indicationLength.unit).toBe('cm')
      expect(Math.abs(dims.indicationLength.value - 60)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(dims.indicationWidth.value - 40)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(dims.indicationHeight.value - 30)).toBeLessThanOrEqual(0.5)
      const vol = await gql(url, '/twin', `{ dimVolume { value unit } dimWeight { value unit } }`) as {
        dimVolume: { value: number; unit: string }
        dimWeight: { value: number; unit: string }
      }
      expect(vol.dimVolume.unit).toBe('cm3')
      expect(vol.dimVolume.value).toBeCloseTo(
        dims.indicationLength.value * dims.indicationWidth.value * dims.indicationHeight.value, 6,
      )
      expect(vol.dimWeight.value).toBeCloseTo(vol.dimVolume.value / 5000, 6)
      const st = await gql(url, '/twin', `{ state }`) as { state: string }
      expect(st.state).toBe('ready')
    } finally {
      child.kill('SIGTERM')
    }
  }, 40000)

  it('--scenario thermally-cycled serves the residual through /twin (the preset realizes through physics)', async () => {
    const { url, child } = await boot(['--scenario', 'thermally-cycled'])
    try {
      await gql(url, '/world', `mutation { advanceTime(seconds: 400) { clock } }`)
      // a 100 cm box at a 1.5 % residual span error: +1.5 cm = 3 d —
      // robustly past the ±1 d MPE whatever the noise draws.
      await gql(url, '/world', `mutation { feedObject(lengthCm: 100, widthCm: 40, heightCm: 30) { clock } }`)
      await gql(url, '/world', `mutation { advanceTime(seconds: 2) { clock } }`)
      const dims = await gql(url, '/twin', `{ indicationLength { value } }`) as { indicationLength: { value: number } }
      expect(dims.indicationLength.value - 100).toBeGreaterThanOrEqual(1.0)
      const st = await gql(url, '/twin', `mutation { runSelfTest { state } }`) as { runSelfTest: { state: string } }
      expect(st.runSelfTest.state).toBe('fault') // the checking facility catches the residual
    } finally {
      child.kill('SIGTERM')
    }
  }, 40000)
})
