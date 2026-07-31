#!/usr/bin/env tsx
// sim-md — the standalone simulated R 129 reference dimensioner
// (spec §9): one process, both channels, the landing page, GraphiQL
// playgrounds. The console is OUT of scope for this family (the §7
// grammar is load-cell-shaped; the dimensioner drives via /world
// directly — the radar family precedent).
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { VirtualClock } from '@primmel/sst-runtime/time'
import { mulberry32 } from '@primmel/sst-runtime/physics/rng'
import { generateTwinSchema, type TwinIo } from '@primmel/sst-runtime/twin-schema'
import { checkTwinConformance } from '@primmel/sst-runtime/conformance'
import { loadBakedContract } from '@primmel/sst-runtime/twin-bake'
import { createSimServer } from '@primmel/sst-runtime/server'
import { MultiDimensionalInstrument, MD_META } from './instrument.js'
import { getMdScenario } from './scenarios.js'
import { buildMdWorldSchema, type MdWorldContext } from './world.js'

const { values } = parseArgs({
  options: {
    package: { type: 'string' },
    port: { type: 'string', default: '5129' },
    scenario: { type: 'string', default: 'good-dimensioner' },
    seed: { type: 'string', default: '42' },
  },
})

const scenario = getMdScenario(values.scenario ?? 'good-dimensioner')
const clock = new VirtualClock()
const seed = Number(values.seed ?? 42)
const host: MdWorldContext = {
  instrument: new MultiDimensionalInstrument(scenario, clock, mulberry32(seed)),
  clock,
  swap(def) { this.instrument = new MultiDimensionalInstrument(def, clock, mulberry32(seed)) },
}

// the serve contract: --package re-parses the landed product package
// (the development posture); otherwise the bundled baked artifact
// (standalone — zero SMART).
const contract = values.package
  ? await (await import('@primmel/sst-runtime/twin-contract-prl')).parseTwinContract(values.package)
  : await loadBakedContract(join(dirname(fileURLToPath(import.meta.url)), '..', 'twin', 'md.twin.json'))

const io: TwinIo = {
  get instrument() { return host.instrument },
  clock,
  registers: {
    indication_length: () => ({ value: host.instrument.dimensionsCm().lengthCm, unit: 'cm', kind: 'length', servedAt: host.instrument.servedAt() }),
    indication_width: () => ({ value: host.instrument.dimensionsCm().widthCm, unit: 'cm', kind: 'length', servedAt: host.instrument.servedAt() }),
    indication_height: () => ({ value: host.instrument.dimensionsCm().heightCm, unit: 'cm', kind: 'length', servedAt: host.instrument.servedAt() }),
    dim_volume: () => ({ value: host.instrument.volumeCm3(), unit: 'cm3', kind: 'volume', servedAt: host.instrument.servedAt() }),
    dim_weight: () => ({ value: host.instrument.dimWeightKg(), unit: 'kg', kind: 'mass', servedAt: host.instrument.servedAt() }),
  },
  operations: {
    run_self_test: () => host.instrument.selfTest(),
    // no fault-report operation: a detected fault IS the state answer
    // (R 129-1, 5.6.1), already served by state / watch_state.
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
  worldSchema: buildMdWorldSchema(host),
  twinSchema,
  port: Number(values.port ?? 5129),
  title: `${MD_META.designation} (simulated)`,
  worldToken: process.env.SIM_WORLD_TOKEN,
})

console.log(`
sim-md — a simulated ${MD_META.designation}
  scenario:   ${scenario.name} — ${scenario.description}
  ${MD_META.measurementPrinciple}, ${MD_META.instrumentCategory}, d = ${MD_META.scaleIntervalCm} cm, V_min…V_max ${MD_META.speedRangeMS[0]}–${MD_META.speedRangeMS[1]} m/s

  landing:  ${server.url}/
  /twin  (SMART digital twin interface):  ${server.url}/twin   (GraphiQL)
  /world (simulated actions):             ${server.url}/world  (GraphiQL)

  try on /world:  mutation { advanceTime(seconds: 400) { clock } }
                  mutation { feedObject(lengthCm: 60, widthCm: 40, heightCm: 30) { groundTruth { object { positionM } } } }
                  mutation { advanceTime(seconds: 2) { groundTruth { lastReading { valid indicatedLengthCm } } } }
  then on /twin:  { indicationLength { value unit servedAt } dimVolume { value unit } }
`)
