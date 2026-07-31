// R 60 kind — the contract every R 60 instance's behavior.js must satisfy.
// At load time, the runtime imports the instance's bundled behavior.js
// and validates its default export against this shape.
//
// The instance carries BOTH behavior (simulation physics) AND scene
// (3D interactivity). Only the manufacturer knows their device's
// physics and how their 3D model should respond — see
// specs/11-scene-context.md for the rationale.

import type { VirtualClock } from '@primmel/sst-runtime'
import type { Qty } from '@primmel/sst-runtime'
import type { Environment, FidelityKnobs, WorldContext } from '@primmel/sst-runtime'
import type { SceneContext } from '@primmel/sst-runtime/scene/context'
import type { GltfScene } from '@primmel/sst-runtime/scene/gltf'

/** An R 60 instance's instrumented view — the legal view (read by /twin)
 *  plus the kind-specific reality (read by /world). */
export interface R60Instrument {
  // The legal view (consumed by /twin)
  indication(): Qty
  servedAt(): number
  operationalState(): 'off' | 'warming' | 'ready' | 'fault'
  environment(): Environment

  // The kind-specific actuation API (consumed by the handlers below)
  placeMass(massKg: number): void
  removeMass(): void
  setFidelity(knobs: Partial<FidelityKnobs>): void
  resetFidelity(): void
  setThermalHysteresis(perDegC: number, tauS?: number): void

  // Common instrument lifecycle (consumed by /world base mutations)
  setEnvironment(e: Partial<Environment>): void
  injectFault(): void
  clearFault(): void
  reset(): void
}

/** The R 60 definition an instance's behavior.js creates instruments from.
 *  Composed by the runtime from the instance package's manifest +
 *  coefficients.yaml + a chosen sample's overrides. */
export interface R60Definition {
  id: string
  classification: {
    accuracyClass: 'A' | 'B' | 'C' | 'D'
    classNumber: number
    technology: 'strain-gauge' | 'piezo-electric' | 'electro-magnetic' | 'capacitive' | 'vibrating-wire' | 'optical'
    humidityClass: 'NH' | 'CH' | 'SH'
    loadType: 'compression' | 'tension' | 'universal' | 'beam'
    construction: 'bending-beam' | 'shear-beam' | 'column' | 'canister' | 'ring' | 'pancake' | 'single-point' | 's-beam' | 'button'
  }
  designParameters: {
    eMaxKg: number
    eMinKg: number
    nLc: number
    vMinKg: number
    drKg: number
    tMinDegC: number
    tMaxDegC: number
  }
  stack: 'analog-passive' | 'analog-active' | 'digital' | 'digital-processing'
  coefficients: R60Coefficients
  fidelity?: Partial<FidelityKnobs>
}

/** The R 60 physics coefficients — sim-owned, not in the SSOT. Each
 *  instance declares these in coefficients.yaml. */
export interface R60Coefficients {
  sensitivityMVperV: number
  gaugeFactor: number
  excitationV: number
  tcZeroPerDegC: number
  tcSpanPerDegC: number
  barometricPerKPa: number
  referenceTempDegC: number
  referencePressureKPa: number
  thermalHysteresisPerDegC: number
  thermalHysteresisTauS: number
  filterTauS: number
  linearizationErrorKg: number
  compensationResidualPerDegC: number
  noiseSigmaKg: number
  warmUpTauS: number
  spanDriftPerDay: number
  // Construction-profile coefficients (elastic-element geometry)
  complianceKgPerMm: number
  hysteresisClass: number
  creepCoefficient: number
  creepTauS: number
  resonantHz: number
  offCenterSensitivity: number
  // Optional paired analogue-passive indicator (spec §14)
  pairedDial?: { capacityKg: number; graduationKg: number; unit: string }
}

/** The default export shape every R 60 instance's behavior.js must
 *  provide. The runtime validates against this and fails loudly if
 *  a mutation declared in world-kind.yaml has no matching handler. */
export interface R60Behavior {
  /** Create a new instrument instance for the given definition. */
  create(def: R60Definition, clock: VirtualClock, seed: number): R60Instrument

  /** Mutation handlers — one per mutation declared in world-kind.yaml. */
  handlers: {
    applyMass:            (ctx: WorldContext<R60Instrument>, args: { massKg: number }) => void
    removeMass:           (ctx: WorldContext<R60Instrument>) => void
    setTwinFidelity:      (ctx: WorldContext<R60Instrument>, args: { servedOffsetKg?: number; servedLagS?: number }) => void
    resetTwinFidelity:    (ctx: WorldContext<R60Instrument>) => void
    setThermalHysteresis: (ctx: WorldContext<R60Instrument>, args: { perDegC: number; tauS?: number }) => void
  }
}

/** The 3D-interactivity contract — every R 60 instance's scene.ts must
 *  satisfy this. The runtime constructs a SceneContext at session boot
 *  and calls scene.bind(gltf, ctx); the instance wires its 3D gestures
 *  to simulation actions via the context's twin/world drivers.
 *
 *  See specs/11-scene-context.md for the rationale and protocol. */
export interface R60Scene {
  bind(scene: GltfScene, ctx: SceneContext<R60Instrument>): () => void
}

/** The combined shape — behavior AND scene — every R 60 instance's
 *  behavior.js default export must satisfy. */
export interface R60Instance {
  behavior: R60Behavior
  scene: R60Scene
}
