// instrument.ts — the LC-500 instrument definition (spec §4.4):
// digital stack × compression profile, class C6, E_max 500 kg,
// n_lc 6000, rated −10…+40 °C (per the acme-lc500 product package).
// The definition data itself lives in @primmel/sst-runtime's scenario registry
// (LC500_GOOD + the named presets); this module names it as the
// package's own and carries the package metadata.
import { LC500_GOOD, type InstrumentDefinition } from '@primmel/sst-runtime/instrument'
import { SCENARIOS, getScenario, type Scenario } from '@primmel/sst-runtime/scenario'

export const LC500_INSTRUMENT: InstrumentDefinition = LC500_GOOD
export const LC500_SCENARIOS: Record<string, Scenario> = SCENARIOS
export { getScenario }

export const LC500_META = {
  designation: 'LC-500 class C6 compression load cell',
  manufacturer: 'ACME',
  eMaxKg: 500,
  nLc: 6000,
  ratedTempDegC: [-10, 40] as const,
  productPackage: 'acme-lc500 (oimlsmart/smart primmel-packages)',
} as const
