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
        await gql(url, '/world', `mutation { advanceTime(seconds: 400) { clock } }`)
        await gql(url, '/world', `mutation { placeLoad(massKg: 500) { clock } }`)
        await gql(url, '/world', `mutation { advanceTime(seconds: 5) { clock } }`)
        const a = await gql(url, '/twin', `{ indication { value } }`) as { indication: { value: number } }
        await gql(url, '/world', `mutation { advanceTime(seconds: 600) { clock } }`)
        const b = await gql(url, '/twin', `{ indication { value } }`) as { indication: { value: number } }
        return b.indication.value - a.indication.value
      } finally {
        child.kill('SIGTERM')
      }
    }
    const good = await measure('good-cell')
    const creep = await measure('creep-cell')
    expect(creep).toBeGreaterThan(Math.abs(good) * 5)
  }, 80000)
})
