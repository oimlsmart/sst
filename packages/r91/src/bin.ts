#!/usr/bin/env tsx
// sim-r91 — the standalone simulated R 91 reference radar speed meter
// (spec §9): one process, both channels, the landing page, GraphiQL
// playgrounds. The console is OUT of scope for this family (the §7
// grammar is load-cell-shaped; the radar drives via /world directly).
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { VirtualClock } from '@primmel/sst-runtime/time'
import { mulberry32 } from '@primmel/sst-runtime/physics/rng'
import { generateTwinSchema, type TwinIo } from '@primmel/sst-runtime/twin-schema'
import { checkTwinConformance } from '@primmel/sst-runtime/conformance'
import { loadBakedContract } from '@primmel/sst-runtime/twin-bake'
import { createSimServer } from '@primmel/sst-runtime/server'
import { RadarSpeedMeter, R91_META } from './instrument.js'
import { getR91Scenario } from './scenarios.js'
import { buildR91WorldSchema, type R91WorldContext } from './world.js'

const { values } = parseArgs({
  options: {
    package: { type: 'string' },
    port: { type: 'string', default: '5291' },
    scenario: { type: 'string', default: 'good-radar' },
    seed: { type: 'string', default: '42' },
  },
})

const scenario = getR91Scenario(values.scenario ?? 'good-radar')
const clock = new VirtualClock()
const seed = Number(values.seed ?? 42)
const host: R91WorldContext = {
  instrument: new RadarSpeedMeter(scenario, clock, mulberry32(seed)),
  clock,
  swap(def) { this.instrument = new RadarSpeedMeter(def, clock, mulberry32(seed)) },
}

// the serve contract: --package re-parses the landed product package
// (the development posture); otherwise the bundled baked artifact
// (standalone — zero SMART).
const contract = values.package
  ? await (await import('@primmel/sst-runtime/twin-contract-prl')).parseTwinContract(values.package)
  : await loadBakedContract(join(dirname(fileURLToPath(import.meta.url)), '..', 'twin', 'r91.twin.json'))

const io: TwinIo = {
  get instrument() { return host.instrument },
  clock,
  operations: {
    run_self_test: () => host.instrument.selfTest(),
    // no fault-report operation: a detected fault IS the state answer
    // (R 91-1, 6.18.4), already served by state / watch_state.
  },
}
const twinSchema = generateTwinSchema(contract, io)
const diffs = checkTwinConformance(twinSchema, contract)
if (diffs.length > 0) {
  console.error('twin conformance check FAILED (law 2):')
  for (const d of diffs) console.error(`  - ${d}`)
  process.exit(1)
}

const server = await createSimServer({
  worldSchema: buildR91WorldSchema(host),
  twinSchema,
  port: Number(values.port ?? 5291),
  title: `${R91_META.designation} (simulated)`,
  worldToken: process.env.SIM_WORLD_TOKEN,
})

console.log(`
sim-r91 — a simulated ${R91_META.designation}
  scenario:   ${scenario.name} — ${scenario.description}
  ${R91_META.workingPrinciple}, ${R91_META.carrierGHz} GHz, ${R91_META.mode} mode, interval ${R91_META.speedIntervalKmh[0]}–${R91_META.speedIntervalKmh[1]} km/h, install angle ${R91_META.installAngleDeg}°

  landing:  ${server.url}/
  /twin  (SMART digital twin interface):  ${server.url}/twin   (GraphiQL)
  /world (simulated actions):             ${server.url}/world  (GraphiQL)

  try on /world:  mutation { setTarget(speedKmh: 87, rangeM: 150) { groundTruth { target { speedKmh } } } }
  then on /twin:  { indication { value unit servedAt } }
`)
