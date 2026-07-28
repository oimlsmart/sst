#!/usr/bin/env tsx
// sim-gas-analyzer — the standalone simulated R 144 reference CGM
// (CO + NOx): one process, both channels, the landing page, GraphiQL
// playgrounds. The twin rides the DECLARED contract
// (GAS_ANALYZER_CONTRACT) until the SIM-R144-2 product reference
// package lands — pass --package to re-parse a real package and prove
// the handshake (the development posture). The console is the next
// leg's scope.
import { parseArgs } from 'node:util'
import { VirtualClock } from '@sim/core/time'
import { SimulatedGasAnalyzer, type GasComponent } from '@sim/core/gas-instrument'
import { buildGasWorldSchema, type GasWorldContext } from '@sim/core/gas-world'
import { generateTwinSchema, type TwinIo } from '@sim/core/twin-schema'
import { checkTwinConformance } from '@sim/core/conformance'
import { GAS_ANALYZER_CONTRACT } from '@sim/core/twin-contract'
import { createSimServer } from '@sim/core/server'
import { getGasScenario, GAS_ANALYZER_META } from './instrument.js'

const { values } = parseArgs({
  options: {
    package: { type: 'string' },
    port: { type: 'string', default: '5291' },
    scenario: { type: 'string', default: 'good-analyzer' },
    seed: { type: 'string', default: '42' },
  },
})

const scenario = getGasScenario(values.scenario ?? 'good-analyzer')
const clock = new VirtualClock()
const seed = Number(values.seed ?? 42)
const host: GasWorldContext = {
  instrument: new SimulatedGasAnalyzer(scenario, clock, seed),
  clock,
  swap(def) { this.instrument = new SimulatedGasAnalyzer(def, clock, seed) },
}

// the serve contract: --package re-parses a landed product package
// (development posture); otherwise the DECLARED intended serves —
// the conformance check below still fails the process on any diff.
const contract = values.package
  ? await (await import('@sim/core/twin-contract-prl')).parseTwinContract(values.package)
  : GAS_ANALYZER_CONTRACT

function served(component: GasComponent) {
  const q = host.instrument.indication(component)
  return { value: q.value, unit: q.unit, kind: q.kind, servedAt: host.instrument.servedAt() }
}
const io: TwinIo = {
  get instrument() { return host.instrument },
  clock,
  registers: {
    indication_co: () => served('co'),
    indication_nox: () => served('nox'),
  },
  operations: {
    zero_calibration: () => host.instrument.zeroCalibration(),
    span_calibration: () => host.instrument.spanCalibration(),
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
  worldSchema: buildGasWorldSchema(host),
  twinSchema,
  port: Number(values.port ?? 5291),
  title: `${GAS_ANALYZER_META.designation} (simulated)`,
})

console.log(`
sim-gas-analyzer — a simulated ${GAS_ANALYZER_META.designation} (${GAS_ANALYZER_META.standard})
  scenario:   ${scenario.name} — ${scenario.description}
  CO ${GAS_ANALYZER_META.rangeCoPpm[0]}–${GAS_ANALYZER_META.rangeCoPpm[1]} ppm (${GAS_ANALYZER_META.principles.co})
  NOx ${GAS_ANALYZER_META.rangeNoxPpm[0]}–${GAS_ANALYZER_META.rangeNoxPpm[1]} ppm (${GAS_ANALYZER_META.principles.nox})
  twin:       ${values.package ? `parsed from ${values.package}` : 'DECLARED contract (the SIM-R144-2 product package is pending)'}

  landing:    ${server.url}/
  /twin  (SMART digital twin interface):  ${server.url}/twin   (GraphiQL)
  /world (simulated actions):             ${server.url}/world  (GraphiQL)

  try on /world:  mutation { setGasConcentration(component: "co", ppm: 800) { groundTruth { bench { coPpm } } } }
  then on /twin:  { indicationCo { value unit servedAt } }
  calibration:  mutation { zeroCalibration { state } }  (feed zero gas on /world first!)
`)
