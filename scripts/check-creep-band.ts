// check-creep-band.ts — the creep-band guard (oimlsmart/sst#17).
//
// R 60-1 §5.5.1 judges the creep test in two windows: the 30-minute
// total (|creep| ≤ 0.7 × |MPE|) and the 20–30-minute band (|creep
// between 20–30 min| ≤ 0.15 × |MPE|). The acme-lc500 creep-fail
// profile once carried a single fast retardation (τ = 120 s) that
// saturated long before t20 — the failing leg's record showed a plateau
// offset but t20 == t30, so the band the evaluation actually judges
// carried no signature. The profile now adds the slow tail
// (creep_slow_coefficient / creep_slow_tau_s, the framework's secondary
// creep component).
//
// This guard boots the three LC-500 creep legs through the linked
// runtime (@primmel/sst-runtime, the declared file: dependency), drives
// the R 60-2 dwell at 500 kg, and asserts:
//
//   fresh          settles and holds — the served band drift stays
//                  within one scale interval, the analytic drift inside
//                  0.15 × |MPE|
//   creep-fail     the served t20→t30 series drifts decisively past
//                  0.15 × |MPE| (and the serial stays LC500-002 — the
//                  custody-refusal beat)
//   creep-fail-001 the same failing physics stamped LC500-001 — the
//                  platform failure-branch demo's failing unit
//
// The physics under test rides the instance's bundled behavior.js —
// the package is self-contained, so this guard runs against any linked
// runtime. A bundle built from a runtime that predates the slow-creep
// component shows no band drift and fails the guard loudly: re-bundle
// behavior.js against the current primmel/sst (the runtime src is the
// bundle's source of truth). The MPE machinery is the runtime's own
// (certification/verdict.ts fed the kind's mpe.yaml + the instance's
// v_min). A failing assert exits 1 and names the leg, the served
// series, and the limit.
//
// Usage: npm run check:creep-band   (CI: the `creep-band` job)

import { readFile, realpath } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'yaml'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const INSTANCE_DIR = join(repoRoot, 'packages', 'instances', 'acme-lc500')
const KIND_MPE = join(repoRoot, 'packages', 'kinds', 'sst-r60', 'mpe.yaml')
const D_MAX_KG = 500
const SEED = 42

// ── The linked runtime (the declared file: dependency) ───────────────

interface SessionLike { url: string; close(): Promise<void> }
type LoadPackageFn = (dir: string) => Promise<unknown>
type RunSessionFn = (pkg: unknown, opts: { port: number; seed: number; sample?: string }) => Promise<SessionLike>
type MpeAtFn = (loadKg: number, className: string, config: unknown) => number
type ParseMpeConfigFn = (yaml: unknown, vMin: number, pLc?: number) => unknown

async function resolveRuntime(): Promise<string> {
  return realpath(join(repoRoot, 'node_modules', '@primmel', 'sst-runtime'))
}

async function importRuntime(runtimeRoot: string): Promise<{
  loadPackage: LoadPackageFn
  runSession: RunSessionFn
  mpeAt: MpeAtFn
  parseMpeConfig: ParseMpeConfigFn
}> {
  const loader = await import(pathToFileURL(join(runtimeRoot, 'src', 'package-loader.ts')).href) as { loadPackage: LoadPackageFn }
  const session = await import(pathToFileURL(join(runtimeRoot, 'src', 'session.ts')).href) as { runSession: RunSessionFn }
  const verdict = await import(pathToFileURL(join(runtimeRoot, 'src', 'certification', 'verdict.ts')).href) as { mpeAt: MpeAtFn; parseMpeConfig: ParseMpeConfigFn }
  return { loadPackage: loader.loadPackage, runSession: session.runSession, mpeAt: verdict.mpeAt, parseMpeConfig: verdict.parseMpeConfig }
}

// ── Driving the booted twin ──────────────────────────────────────────

async function gql(url: string, endpoint: '/twin' | '/world', query: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${url}${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.json() as { data?: Record<string, unknown>; errors?: unknown }
  if (body.errors) throw new Error(`${endpoint} answered errors: ${JSON.stringify(body.errors)}`)
  return body.data ?? {}
}

async function readSerial(url: string): Promise<unknown> {
  const data = await gql(url, '/twin', '{ instrument { identification { serial } } }')
  return (data.instrument as { identification?: { serial?: string } } | undefined)?.identification?.serial
}

async function readIndicationKg(url: string): Promise<number> {
  const data = await gql(url, '/twin', '{ indication { value unit } }')
  return (data.indication as { value: number }).value
}

async function advanceAndRead(url: string, seconds: number): Promise<number> {
  await gql(url, '/world', `mutation { advanceTime(seconds: ${seconds}) { clock } }`)
  return readIndicationKg(url)
}

// ── The analytic band drift (the physics pin, quantization-free) ─────

interface CreepLaw { coefficient: number; tauS: number; slowCoefficient: number; slowTauS: number }

async function readCreepLaw(sampleFile: string): Promise<CreepLaw> {
  const nested = parse(await readFile(join(INSTANCE_DIR, 'coefficients.yaml'), 'utf-8')) as { mechanical?: Record<string, number> }
  const sample = parse(await readFile(join(INSTANCE_DIR, 'samples', sampleFile), 'utf-8')) as { overrides?: Record<string, number> }
  const mech = nested.mechanical ?? {}
  const over = sample.overrides ?? {}
  return {
    coefficient: over.creep_coefficient ?? mech.creep_coefficient ?? 0,
    tauS: over.creep_tau_s ?? mech.creep_tau_s ?? 1,
    slowCoefficient: over.creep_slow_coefficient ?? mech.creep_slow_coefficient ?? 0,
    slowTauS: over.creep_slow_tau_s ?? mech.creep_slow_tau_s ?? 0,
  }
}

/** The exact t20→t30 creep rise at `loadKg` for the merged law (the
 *  indication tracks the load × the creep fraction, both components). */
function analyticBandDriftKg(law: CreepLaw, loadKg: number): number {
  const primary = law.coefficient * (Math.exp(-1200 / law.tauS) - Math.exp(-1800 / law.tauS))
  const slow = law.slowTauS > 0
    ? law.slowCoefficient * (Math.exp(-1200 / law.slowTauS) - Math.exp(-1800 / law.slowTauS))
    : 0
  return loadKg * (primary + slow)
}

// ── The guard ────────────────────────────────────────────────────────

interface Leg {
  sample: string
  expectSerial: string
  /** 'hold' = passing instrument settles; 'drift' = failing instrument walks past the band limit. */
  behavior: 'hold' | 'drift'
}

const LEGS: Leg[] = [
  { sample: 'fresh', expectSerial: 'LC500-001', behavior: 'hold' },
  { sample: 'creep-fail', expectSerial: 'LC500-002', behavior: 'drift' },
  { sample: 'creep-fail-001', expectSerial: 'LC500-001', behavior: 'drift' },
]

async function main(): Promise<number> {
  // The boot resolves the kind + the baked twin contract through the
  // library: this script lives inside it, so declare it (the same
  // doctrine as the framework's own test suite — never probed).
  process.env.SST_LIBRARY_PATH ??= repoRoot
  const { loadPackage, runSession, mpeAt, parseMpeConfig } = await importRuntime(await resolveRuntime())

  // The judged limits from the kind's mpe.yaml + the instance's v_min,
  // computed by the runtime's own MPE machinery.
  const mpeYaml = parse(await readFile(KIND_MPE, 'utf-8')) as { additional_limits?: { creep?: { limit?: number; intermediate_limit?: number } } }
  const manifest = parse(await readFile(join(INSTANCE_DIR, 'package.sst.yaml'), 'utf-8')) as { design_parameters?: Record<string, { value?: number }> }
  const coefficients = parse(await readFile(join(INSTANCE_DIR, 'coefficients.yaml'), 'utf-8')) as { conditioning?: Record<string, number> }
  const vMin = manifest.design_parameters?.v_min?.value ?? 0.02
  const scaleIntervalKg = coefficients.conditioning?.scale_interval_kg ?? 0.05
  const mpeConfig = parseMpeConfig(mpeYaml, vMin, 0.7)
  const mpeKg = mpeAt(D_MAX_KG, 'C', mpeConfig)
  const bandLimitKg = (mpeYaml.additional_limits?.creep?.intermediate_limit ?? 0.15) * mpeKg

  console.log(`── limits: MPE(${D_MAX_KG} kg) = ${mpeKg} kg; the 20–30 min band limit = 0.15 × MPE = ${bandLimitKg} kg`)

  let failures = 0
  const t20BySample = new Map<string, number>()

  for (const leg of LEGS) {
    const pkg = await loadPackage(INSTANCE_DIR)
    const session = await runSession(pkg, { port: 0, seed: SEED, sample: leg.sample })
    const problems: string[] = []
    try {
      const serial = await readSerial(session.url)
      if (serial !== leg.expectSerial) {
        problems.push(`serial: served "${String(serial)}", expected "${leg.expectSerial}"`)
      }

      await gql(session.url, '/world', `mutation { placeLoad(massKg: ${D_MAX_KG}) { groundTruth { appliedLoadKg } } }`)
      const t20 = await advanceAndRead(session.url, 1200)
      const t30 = await advanceAndRead(session.url, 600)
      const servedDrift = t30 - t20
      t20BySample.set(leg.sample, t20)

      const law = await readCreepLaw(`${leg.sample}.yaml`)
      const analyticDrift = analyticBandDriftKg(law, D_MAX_KG)

      if (leg.behavior === 'hold') {
        // A passing instrument settles and holds: the served series stays
        // within one scale interval (the raw drift is far below the band
        // limit; quantization dominates the served value).
        if (Math.abs(servedDrift) > scaleIntervalKg + 1e-9) {
          problems.push(`band drift ${servedDrift.toFixed(4)} kg exceeds one scale interval (${scaleIntervalKg} kg) — the passing leg must settle and hold`)
        }
        if (analyticDrift > bandLimitKg) {
          problems.push(`analytic band drift ${analyticDrift.toFixed(5)} kg exceeds the band limit ${bandLimitKg} kg`)
        }
      } else {
        // A failing instrument walks past the judged limit INSIDE the
        // band — decisively, so the recorded series carries the
        // signature the R 60-1 §5.5.1 evaluation judges.
        if (!(servedDrift > 3 * bandLimitKg)) {
          problems.push(
            `band drift ${servedDrift.toFixed(4)} kg does not exceed 3 × the band limit ${bandLimitKg} kg — ` +
            `the failing leg must drift past the limit inside the 20–30 min band ` +
            `(if the drift reads 0 the bundled behavior.js predates the slow-creep component — ` +
            `re-bundle it against the current primmel/sst)`,
          )
        }
        if (servedDrift > 0.5) {
          problems.push(`band drift ${servedDrift.toFixed(4)} kg reads like an offset, not a slow tail (< 0.5 kg)`)
        }
        if (!(analyticDrift > bandLimitKg)) {
          problems.push(`analytic band drift ${analyticDrift.toFixed(5)} kg does not exceed the band limit ${bandLimitKg} kg`)
        }
      }

      const verdict = problems.length === 0 ? 'ok' : 'FAIL'
      console.log(
        `── ${leg.sample} (serial ${String(serial)}): t20 = ${t20} kg, t30 = ${t30} kg, ` +
        `band drift ${servedDrift.toFixed(4)} kg (analytic ${analyticDrift.toFixed(5)} kg, limit ${bandLimitKg} kg) — ${verdict}`,
      )
      for (const p of problems) console.error(`    ✗ ${p}`)
      if (problems.length > 0) failures++
    } finally {
      await session.close()
    }
  }

  // The fast primary component stays: the failing plateau keeps its
  // offset over the passing leg (≈ creep_coefficient × load = +2 kg at
  // 500 kg, plus the slow tail's rise by t20) — the total-creep
  // signature (0.7 × |MPE|) is intact alongside the new band signature.
  const freshT20 = t20BySample.get('fresh')
  for (const sample of ['creep-fail', 'creep-fail-001']) {
    const failT20 = t20BySample.get(sample)
    if (freshT20 == null || failT20 == null) continue
    const offset = failT20 - freshT20
    if (offset < 1.8 || offset > 2.8) {
      failures++
      console.error(`✗ ${sample}: plateau offset over fresh at t20 is ${offset.toFixed(3)} kg — expected ≈ +2.4 kg (the primary creep component must stay)`)
    } else {
      console.log(`── ${sample}: plateau offset over fresh at t20 = +${offset.toFixed(3)} kg — the primary component is intact`)
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} leg(s) fail the creep-band guard`)
    return 1
  }
  console.log('\nthe creep legs carry their R 60-1 §5.5.1 signatures: the failing band drifts past the limit, the passing band holds')
  return 0
}

process.exitCode = await main()
