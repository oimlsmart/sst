#!/usr/bin/env tsx
// sim-lc500 — the standalone simulated ACME LC-500 (spec §9):
// one process, both channels, the landing page, GraphiQL playgrounds.
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { VirtualClock } from '@sim/core/time'
import { SimulatedInstrument } from '@sim/core/instrument'
import { buildWorldSchema, type WorldContext } from '@sim/core/world-schema'
import { generateTwinSchema } from '@sim/core/twin-schema'
import { checkTwinConformance } from '@sim/core/conformance'
import { loadBakedContract } from '@sim/core/twin-bake'
import { createSimServer } from '@sim/core/server'
import { runConsole, httpConsoleIo } from '@sim/core/console/client'
import { getScenario, LC500_META } from './instrument.js'

const { values } = parseArgs({
  options: {
    package: { type: 'string' },
    port: { type: 'string', default: '5290' },
    scenario: { type: 'string', default: 'good-cell' },
    console: { type: 'boolean', default: false },
    seed: { type: 'string', default: '42' },
  },
})

const scenario = getScenario(values.scenario ?? 'good-cell')
const clock = new VirtualClock()
const instrument = new SimulatedInstrument(scenario, clock, Number(values.seed ?? 42))
const host: WorldContext = {
  instrument,
  clock,
  swap(def) { this.instrument = new SimulatedInstrument(def, clock, Number(values.seed ?? 42)) },
}

// the serve contract: --package re-parses (development posture);
// otherwise the bundled baked artifact (standalone — zero SMART).
const contract = values.package
  ? await (await import('@sim/core/twin-contract-prl')).parseTwinContract(values.package)
  : await loadBakedContract(join(dirname(fileURLToPath(import.meta.url)), '..', 'twin', 'lc500.twin.json'))

const io = { instrument: host.instrument, clock }
const twinSchema = generateTwinSchema(contract, io)
const diffs = checkTwinConformance(twinSchema, contract)
if (diffs.length > 0) {
  console.error('twin conformance check FAILED (law 2):')
  for (const d of diffs) console.error(`  - ${d}`)
  process.exit(1)
}

const server = await createSimServer({
  worldSchema: buildWorldSchema(host),
  twinSchema,
  port: Number(values.port ?? 5290),
  title: `${LC500_META.designation} (simulated)`,
})

console.log(`
sim-lc500 — a simulated ${LC500_META.designation}
  scenario:   ${scenario.name} — ${scenario.description}
  E_max ${LC500_META.eMaxKg} kg, n_lc ${LC500_META.nLc}, rated ${LC500_META.ratedTempDegC[0]}…+${LC500_META.ratedTempDegC[1]} °C

  bench + landing:  ${server.url}/
  /twin  (SMART digital twin interface):  ${server.url}/twin   (GraphiQL)
  /world (simulated actions):             ${server.url}/world  (GraphiQL)

  try on /world:  mutation { placeLoad(massKg: 40) { groundTruth { appliedLoadKg } } }
  then on /twin:  { indication { value unit servedAt } }
  console:        sim-lc500 console  (or restart with --console)
`)

if (values.console) {
  runConsole(httpConsoleIo(server.url, t => process.stdout.write(t)), process.stdin, process.stdout)
}
