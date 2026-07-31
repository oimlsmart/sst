// world.ts — the radar family's /world channel: the generic builder
// (core world-schema.ts) + the radar kind. Every mutation realizes
// THROUGH the physics stages — there is no path from /world to the
// indication but the signal chain.
import type { GraphQLSchema } from 'graphql'
import { buildWorldSchemaFor, type WorldContext, type WorldKind } from '@primmel/sst-runtime/world-schema'
import { RadarSpeedMeter, type RadarDefinition } from './instrument.js'
import { R91_SCENARIOS } from './scenarios.js'
import { validateSpeedKeyframes, type SpeedKeyframe } from './driver.js'

export type R91WorldContext = WorldContext<RadarSpeedMeter, RadarDefinition>

/** The road/target-simulator kind (instrument family #3): the target,
 *  rain, the D 11 disturbance severities, and the physically-realized
 *  faults (oscillator drift, antenna misalignment, the interference
 *  source) plus the vehicle speed-profile driver. */
export const R91_WORLD_KIND: WorldKind<RadarSpeedMeter, RadarDefinition> = {
  types: /* GraphQL */ `
    type RadarTarget { speedKmh: Float!, rangeM: Float!, angleDeg: Float!, rcsM2: Float! }
    type InterferenceSource { apparentSpeedKmh: Float!, rcsM2: Float!, rangeM: Float! }
    type RadarReading { valid: Boolean!, reason: String!, indicatedKmh: Float!, highResKmh: Float!, snrDb: Float!, source: String! }
    input SpeedKeyframeInput { atS: Float!, speedKmh: Float! }

    type GroundTruth {
      clockS: Float!
      environment: Environment!
      target: RadarTarget!
      rainRateMmH: Float!
      vibrationSeverity: Float!
      emiSeverity: Float!
      interference: InterferenceSource
      oscillatorErrorPpm: Float!
      carrierActualHz: Float!
      lastReading: RadarReading
    }
  `,
  mutationFields: /* GraphQL */ `
    setTarget(speedKmh: Float!, rangeM: Float!, angleDeg: Float, rcsM2: Float): WorldState!
    setRain(rateMmH: Float!): WorldState!
    setVibration(severity: Float!): WorldState!
    setEmi(severity: Float!): WorldState!
    setOscillatorDrift(tcPpmPerDegC: Float, biasPpm: Float, driftPpmPerDay: Float): WorldState!
    setAntennaMisalignment(angleDeg: Float!): WorldState!
    setInterferenceSource(apparentSpeedKmh: Float!, rcsM2: Float!, rangeM: Float!): WorldState!
    clearInterferenceSource: WorldState!
    driveProfile(keyframes: [SpeedKeyframeInput!]!): WorldState!
    stopProfile: WorldState!
  `,
  scenarios: Object.fromEntries(Object.values(R91_SCENARIOS).map(s => [s.name, { name: s.name, description: s.description, definition: s }])),
  groundTruth: ctx => ctx.instrument.groundTruth(),
  mutations: {
    setTarget: (ctx, args) => {
      const a = args as { speedKmh: number; rangeM: number; angleDeg?: number; rcsM2?: number }
      if (!(a.speedKmh >= 0)) throw new Error(`target speed must be ≥ 0, got ${a.speedKmh}`)
      if (!(a.rangeM > 0)) throw new Error(`target range must be > 0, got ${a.rangeM}`)
      ctx.instrument.setTarget(a)
    },
    setRain: (ctx, args) => { ctx.instrument.setRain((args as { rateMmH: number }).rateMmH) },
    setVibration: (ctx, args) => { ctx.instrument.setVibration((args as { severity: number }).severity) },
    setEmi: (ctx, args) => { ctx.instrument.setEmi((args as { severity: number }).severity) },
    setOscillatorDrift: (ctx, args) => {
      ctx.instrument.setOscillatorDrift(args as { tcPpmPerDegC?: number; biasPpm?: number; driftPpmPerDay?: number })
    },
    setAntennaMisalignment: (ctx, args) => { ctx.instrument.setAntennaMisalignment((args as { angleDeg: number }).angleDeg) },
    setInterferenceSource: (ctx, args) => {
      const a = args as { apparentSpeedKmh: number; rcsM2: number; rangeM: number }
      if (!(a.rcsM2 > 0) || !(a.rangeM > 0)) throw new Error('interference source needs rcsM2 > 0 and rangeM > 0')
      ctx.instrument.setInterferenceSource(a)
    },
    clearInterferenceSource: ctx => { ctx.instrument.clearInterferenceSource() },
    driveProfile: (ctx, args) => {
      const keyframes = (args as { keyframes: SpeedKeyframe[] }).keyframes
      validateSpeedKeyframes(keyframes)
      ctx.instrument.driveProfile(keyframes)
    },
    stopProfile: ctx => { ctx.instrument.stopProfile() },
  },
}

/** The radar /world channel (family #3's entry point). */
export function buildR91WorldSchema(ctx: R91WorldContext): GraphQLSchema {
  return buildWorldSchemaFor(ctx, R91_WORLD_KIND)
}
