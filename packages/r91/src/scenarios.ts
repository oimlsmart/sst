// scenarios.ts — the named instrument definitions + physics presets
// (spec §8: scenarios are data, not code). The radar family's presets:
// the good meter, and the fault classes the brief names — a misaligned
// antenna (the cosine error), a temperature-drifting oscillator, and an
// interference-present bench (a scenario = instrument + its initial
// world; the source is a world fact, so it lives in the world block).
import { R91_GOOD, type RadarDefinition, type RadarParameters } from './instrument.js'

export interface RadarScenario extends RadarDefinition {
  name: string
  description: string
}

const GOOD: RadarParameters = R91_GOOD.parameters

export const R91_SCENARIOS: Record<string, RadarScenario> = {
  'good-radar': {
    ...R91_GOOD,
    name: 'good-radar',
    description: 'The reference radar: stationary Doppler, 20–180 km/h (R 91-1, 6.1), the 6.4 stationary MPE (±3 km/h ≤ 100, ±3 % above) — all coefficients inside R 91 limits.',
  },
  'angle-misaligned': {
    id: 'r91-ref-misaligned',
    name: 'angle-misaligned',
    description: 'Antenna tilted 8° off its declared installation angle — the cosine error: the meter UNDER-reads by cos(20°)/cos(12°) ≈ −4 %.',
    parameters: { ...GOOD, misalignmentDeg: 8 },
    world: { target: { speedKmh: 50, rangeM: 120, angleDeg: 12, rcsM2: 5 } },
  },
  'temperature-drifting': {
    id: 'r91-ref-tempdrift',
    name: 'temperature-drifting',
    description: 'A faulty oscillator: 200 ppm/°C temperature coefficient — the Doppler shift scales at the source and every speed reads fractionally high/low with temperature.',
    parameters: { ...GOOD, oscillatorTcPpmPerDegC: 200 },
    world: { target: { speedKmh: 50, rangeM: 120, angleDeg: 12, rcsM2: 5 } },
  },
  'interference-present': {
    id: 'r91-ref-interference',
    name: 'interference-present',
    description: 'Honest meter, hostile bench: an in-beam interference source (apparent 45 km/h, a stronger return than the target) captures the strongest-in-beam discriminator.',
    parameters: { ...GOOD },
    world: {
      target: { speedKmh: 50, rangeM: 120, angleDeg: 12, rcsM2: 5 },
      interference: { apparentSpeedKmh: 45, rcsM2: 12, rangeM: 80 },
    },
  },
}

export function getR91Scenario(name: string): RadarScenario {
  const s = R91_SCENARIOS[name]
  if (!s) throw new Error(`unknown scenario '${name}' (known: ${Object.keys(R91_SCENARIOS).join(', ')})`)
  return s
}
