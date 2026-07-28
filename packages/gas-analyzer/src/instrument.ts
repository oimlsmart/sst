// instrument.ts — the reference CGM instrument definition (R 144
// territory): a dual-component continuous gas monitor — CO by NDIR
// (Beer–Lambert absorption), NOx by chemiluminescence. The definition
// data itself lives in @sim/core's gas scenario registry
// (GAS_ANALYZER_GOOD + the named presets); this module names it as the
// package's own and carries the package metadata (the lc500 precedent).
import { GAS_ANALYZER_GOOD, type GasAnalyzerDefinition } from '@sim/core/gas-instrument'
import { GAS_SCENARIOS, getGasScenario, type GasScenario } from '@sim/core/gas-scenario'

export const GAS_ANALYZER_INSTRUMENT: GasAnalyzerDefinition = GAS_ANALYZER_GOOD
export const GAS_ANALYZER_SCENARIOS: Record<string, GasScenario> = GAS_SCENARIOS
export { getGasScenario }

export const GAS_ANALYZER_META = {
  designation: 'reference continuous gas monitor (CO + NOx)',
  standard: 'OIML R 144',
  principles: {
    co: 'NDIR — Beer–Lambert absorption (the EN 15058 reference principle)',
    nox: 'chemiluminescence — NO + O3 → NO2* + hν (the EN 14792 reference principle)',
  },
  /** sub-ranges inside the R 144-1, 4.2 envelopes (CO 10–20000 ppm;
   *  NOx = NO+NO2 20–5500 ppm) — representative stationary-source spans. */
  rangeCoPpm: [0, 1000] as const,
  rangeNoxPpm: [0, 500] as const,
  /** the R 144-1, 4.5.1 rated operating conditions. */
  ratedTempDegC: [5, 40] as const,
  ratedPressureKPa: [86, 106] as const,
  ratedFlowLPerMin: [0.5, 2] as const,
  /** declared interferent maxima (R 144-1, 4.5.2 NOTE — manufacturer list). */
  interferentMaxPercentVol: { co2: 20, h2o: 20 } as const,
  warmUpTimeS: 3600,
  productPackage: 'SIM-R144-2 (pending — the twin rides the DECLARED contract GAS_ANALYZER_CONTRACT until the product reference package lands; the handshake test is skip-guarded)',
} as const
