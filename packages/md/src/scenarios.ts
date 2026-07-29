// scenarios.ts — the named instrument definitions + physics presets
// (spec §8: scenarios are data, not code). The dimensioner family's
// presets: the good instrument, and the failure classes R 129's own
// test program hunts — dark surfaces (A.3), ambient light (A.4.1), an
// inadequate frame rate at V_max (the Annex A speed-of-movement test),
// and the post-temperature-cycle residual (the static-temperatures
// test; the configurable post-cycle difference).
import { MD350_GOOD, type MdDefinition, type MdParameters } from './instrument.js'

export interface MdScenario extends MdDefinition {
  name: string
  description: string
}

const GOOD: MdParameters = MD350_GOOD.parameters

export const MD_SCENARIOS: Record<string, MdScenario> = {
  'good-dimensioner': {
    ...MD350_GOOD,
    name: 'good-dimensioner',
    description: 'The reference dimensioner: optical light-section, automatic, d = 0.5 cm, V_min…V_max 0.1–1.5 m/s, the per-axis MPE ±1.0 d (R 129-1, 4.1.2) — all coefficients inside R 129 limits.',
  },
  'dark-objects': {
    id: 'md350-ref-dark',
    name: 'dark-objects',
    description: 'The scanner\'s dark-surface noise is excessive (σ at the reference reflectance ×5): matt-black parcels blow past ±1 d while white ones pass — the A.3 surface-characteristics failure. Feed a dark object (reflectance ≈ 0.05) to see it.',
    parameters: { ...GOOD, edgeSigmaRefCm: 0.15, widthSigmaRefCm: 0.15, heightSigmaRefCm: 0.12 },
    world: { conveyorSpeedMS: 1.0 },
  },
  'high-ambient-light': {
    id: 'md350-ref-lux',
    name: 'high-ambient-light',
    description: 'Inadequate ambient-light suppression (the ambient shot-noise gain ×12): the height channel drifts past ±1 d as the hall lighting climbs toward the A.4.1 upper level (1500 lx). The bench boots at 1500 lx.',
    parameters: { ...GOOD, ambientNoiseGain: 6 },
    world: { conveyorSpeedMS: 1.0, ambientLx: 1500 },
  },
  'slow-scanner': {
    id: 'md350-ref-slow',
    name: 'slow-scanner',
    description: 'A 50 Hz frame rate: along-track quantization ±1.5 cm at V_max (3 d) — passes at V_min, fails at V_max, exactly the Annex A speed-of-movement test\'s prey. Sweep the conveyor speed to see the error grow.',
    parameters: { ...GOOD, scanRateHz: 50 },
    world: { conveyorSpeedMS: 1.0 },
  },
  'thermally-cycled': {
    id: 'md350-ref-thermal',
    name: 'thermally-cycled',
    description: 'A frame that keeps a 1.5 % residual span error after a temperature cycle (the configurable post-cycle difference): small boxes still pass, a 50 cm box fails ±1 d — the static-temperatures failure.',
    parameters: { ...GOOD, thermalResidualFrac: 0.015 },
    world: { conveyorSpeedMS: 1.0 },
  },
}

export function getMdScenario(name: string): MdScenario {
  const s = MD_SCENARIOS[name]
  if (!s) throw new Error(`unknown scenario '${name}' (known: ${Object.keys(MD_SCENARIOS).join(', ')})`)
  return s
}
