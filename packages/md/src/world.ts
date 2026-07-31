// world.ts — the dimensioner family's /world channel: the generic
// builder (core world-schema.ts) + the dimensioner kind. Every
// mutation realizes THROUGH the physics stages — there is no path from
// /world to the indication but the signal chain.
import type { GraphQLSchema } from 'graphql'
import { buildWorldSchemaFor, type WorldContext, type WorldKind } from '@primmel/sst-runtime/world-schema'
import { MultiDimensionalInstrument, type MdDefinition, type ConveyorObjectSpec } from './instrument.js'
import { MD_SCENARIOS } from './scenarios.js'
import { validateFeedKeyframes, type FeedKeyframe } from './driver.js'

export type MdWorldContext = WorldContext<MultiDimensionalInstrument, MdDefinition>

interface FeedKeyframeInput extends Omit<FeedKeyframe, 'object'> {
  object: ConveyorObjectSpec
}

/** The conveyor/object-simulator kind (instrument family #4): the
 *  object feed, the belt speed, the ambient light, the D 11
 *  disturbance severities, and the physically-realized faults (encoder
 *  slip, scan-head tilt, the post-temperature-cycle residual, the
 *  occluded light curtain) plus the object-feed driver. */
export const MD_WORLD_KIND: WorldKind<MultiDimensionalInstrument, MdDefinition> = {
  types: /* GraphQL */ `
    type ConveyorObject { lengthCm: Float!, widthCm: Float!, heightCm: Float!, shape: String!, reflectance: Float!, protrusionCm: Float!, orientationDeg: Float!, positionM: Float! }
    type MdReading { valid: Boolean!, reason: String!, measuredLengthCm: Float!, measuredWidthCm: Float!, measuredHeightCm: Float!, indicatedLengthCm: Float!, indicatedWidthCm: Float!, indicatedHeightCm: Float!, dimVolumeCm3: Float!, dimWeightKg: Float!, protrusionMissed: Boolean!, quantizationCm: Float! }
    input FeedKeyframeInput { atS: Float!, object: ConveyorObjectInput! }
    input ConveyorObjectInput { lengthCm: Float!, widthCm: Float!, heightCm: Float!, shape: String, reflectance: Float, protrusionCm: Float, orientationDeg: Float }

    type GroundTruth {
      clockS: Float!
      environment: Environment!
      conveyorSpeedMS: Float!
      object: ConveyorObject
      ambientLx: Float!
      emiSeverity: Float!
      beamOccluded: Boolean!
      encoderSlipFrac: Float!
      scannerTiltDeg: Float!
      thermalResidualFrac: Float!
      thermalSpanFrac: Float!
      lastReading: MdReading
    }
  `,
  mutationFields: /* GraphQL */ `
    setConveyorSpeed(speedMS: Float!): WorldState!
    feedObject(lengthCm: Float!, widthCm: Float!, heightCm: Float!, shape: String, reflectance: Float, protrusionCm: Float, orientationDeg: Float): WorldState!
    clearObject: WorldState!
    setAmbientLight(lx: Float!): WorldState!
    setEmi(severity: Float!): WorldState!
    setBeamOccluded(occluded: Boolean!): WorldState!
    setEncoderSlip(frac: Float!): WorldState!
    setScannerTilt(tiltDeg: Float!): WorldState!
    setThermalResidual(frac: Float!): WorldState!
    driveFeed(keyframes: [FeedKeyframeInput!]!): WorldState!
    stopFeed: WorldState!
  `,
  scenarios: Object.fromEntries(Object.values(MD_SCENARIOS).map(s => [s.name, { name: s.name, description: s.description, definition: s }])),
  groundTruth: ctx => ctx.instrument.groundTruth(),
  mutations: {
    setConveyorSpeed: (ctx, args) => { ctx.instrument.setConveyorSpeed((args as { speedMS: number }).speedMS) },
    feedObject: (ctx, args) => {
      const a = args as { lengthCm: number; widthCm: number; heightCm: number; shape?: string; reflectance?: number; protrusionCm?: number; orientationDeg?: number }
      ctx.instrument.feedObject({
        lengthCm: a.lengthCm, widthCm: a.widthCm, heightCm: a.heightCm,
        shape: (a.shape as ConveyorObjectSpec['shape']) ?? 'rectangular',
        reflectance: a.reflectance ?? 0.9,
        protrusionCm: a.protrusionCm ?? 0,
        orientationDeg: a.orientationDeg ?? 0,
      })
    },
    clearObject: ctx => { ctx.instrument.clearObject() },
    setAmbientLight: (ctx, args) => { ctx.instrument.setAmbientLight((args as { lx: number }).lx) },
    setEmi: (ctx, args) => { ctx.instrument.setEmi((args as { severity: number }).severity) },
    setBeamOccluded: (ctx, args) => { ctx.instrument.setBeamOccluded((args as { occluded: boolean }).occluded) },
    setEncoderSlip: (ctx, args) => { ctx.instrument.setEncoderSlip((args as { frac: number }).frac) },
    setScannerTilt: (ctx, args) => { ctx.instrument.setScannerTilt((args as { tiltDeg: number }).tiltDeg) },
    setThermalResidual: (ctx, args) => { ctx.instrument.setThermalResidual((args as { frac: number }).frac) },
    driveFeed: (ctx, args) => {
      const keyframes = (args as { keyframes: FeedKeyframeInput[] }).keyframes.map(k => ({
        atS: k.atS,
        object: {
          lengthCm: k.object.lengthCm, widthCm: k.object.widthCm, heightCm: k.object.heightCm,
          shape: k.object.shape ?? 'rectangular',
          reflectance: k.object.reflectance ?? 0.9,
          protrusionCm: k.object.protrusionCm ?? 0,
          orientationDeg: k.object.orientationDeg ?? 0,
        },
      }))
      validateFeedKeyframes(keyframes)
      ctx.instrument.driveFeed(keyframes)
    },
    stopFeed: ctx => { ctx.instrument.stopFeed() },
  },
}

/** The dimensioner /world channel (family #4's entry point). */
export function buildMdWorldSchema(ctx: MdWorldContext): GraphQLSchema {
  return buildWorldSchemaFor(ctx, MD_WORLD_KIND)
}
