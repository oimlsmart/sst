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
  return (await res.json() as { data?: unknown }).data
}

describe('sim-gas-analyzer (standalone boot — the declared-contract posture)', () => {
  it('boots zero-SMART (the DECLARED contract) and serves both channels + landing', async () => {
    const { url, child, output } = await boot()
    try {
      expect(output).toContain('DECLARED contract')
      const ind = await gql(url, '/twin', `{ indicationCo { value unit servedAt } state }`) as {
        indicationCo: { unit: string }; state: string
      }
      expect(ind.indicationCo.unit).toBe('ppm')
      expect(ind.state).toBe('warming')
      await gql(url, '/world', `mutation { setGasConcentration(component: "co", ppm: 800) { groundTruth { bench { coPpm } } } }`)
      const gt = await gql(url, '/world', `{ groundTruth { bench { coPpm } } }`) as { groundTruth: { bench: { coPpm: number } } }
      expect(gt.groundTruth.bench.coPpm).toBe(800)
      const landing = await fetch(`${url}/`)
      expect(await landing.text()).toContain('/twin')
    } finally {
      child.kill('SIGTERM')
    }
  }, 40000)

  it('a full gas-bench flow: warm, feed gas, read the twin; drifting-analyzer drifts beyond MPE in 7 virtual days', async () => {
    const driftOf = async (scenario: string): Promise<number> => {
      const { url, child } = await boot(['--scenario', scenario])
      try {
        await gql(url, '/world', `mutation { advanceTime(seconds: 3900) { clock } }`) // warm-up
        await gql(url, '/world', `mutation { setGasConcentration(component: "co", ppm: 100) { clock } }`)
        await gql(url, '/world', `mutation { advanceTime(seconds: 300) { clock } }`)
        const a = await gql(url, '/twin', `{ indicationCo { value } }`) as { indicationCo: { value: number } }
        await gql(url, '/world', `mutation { advanceTime(seconds: 604800) { clock } }`) // 7 days
        const b = await gql(url, '/twin', `{ indicationCo { value } }`) as { indicationCo: { value: number } }
        return Math.abs(b.indicationCo.value - a.indicationCo.value)
      } finally {
        child.kill('SIGTERM')
      }
    }
    const good = await driftOf('good-analyzer')
    const drifting = await driftOf('drifting-analyzer')
    const MPE_AT_100 = Math.max(2, 0.05 * 100) // R 144-1, 4.3.1
    expect(good).toBeLessThan(MPE_AT_100)
    expect(drifting).toBeGreaterThan(MPE_AT_100)
    expect(drifting).toBeGreaterThan(good * 5)
  }, 80000)
})
