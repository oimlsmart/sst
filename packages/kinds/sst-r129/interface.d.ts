// R 129 kind — the contract every R 129 instance's behavior.js must satisfy.

import type { VirtualClock, Qty, Environment, WorldContext, FidelityKnobs } from '@primmel/sst-runtime/world'

export interface ObjectState {
  present: boolean
  positionM: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

export interface ReadingState {
  valid: boolean
  lengthCm: number
  widthCm: number
  heightCm: number
  atS: number
}

export interface R129Instrument {
  // /twin legal view
  indication(): Qty
  servedAt(): number
  operationalState(): 'off' | 'warming' | 'ready' | 'fault'
  environment(): Environment

  // active-domain API
  setConveyorSpeed(mPerS: number): void
  feedObject(l: number, w: number, h: number): void
  clearObject(): void
  setAmbientLight(lux: number): void
  setEmi(severity: number): void
  setBeamOccluded(occluded: boolean): void
  setEncoderSlip(fraction: number): void
  setScannerTilt(degrees: number): void
  setThermalResidual(fraction: number): void
  driveFeed(profileId: string): void
  stopFeed(): void

  // common lifecycle
  setEnvironment(e: Partial<Environment>): void
  injectFault(): void
  clearFault(): void
  reset(): void
}

export interface R129Definition {
  id: string
  classification: {
    instrumentCategory: 'automatic-light-section' | 'automatic-image-recognition' | 'manual-digital'
    scanningMethod: 'light-section' | 'laser-line' | 'structured-light' | 'stereo-cam'
    scaleIntervalCm: number
    speedRange: 'low' | 'standard' | 'high'
    axisCount: 1 | 2 | 3
  }
  designParameters: {
    scaleIntervalCm: number
    conveyorSpeedMinMS: number
    conveyorSpeedMaxMS: number
    measurementRangeMaxCm: number
    cameraBaselineMm: number
    lightSectionAngleDeg: number
    encoderResolutionPpr: number
    ambientLightMaxLx: number
  }
  stack: 'digital' | 'analog'
  coefficients: R129Coefficients
  fidelity?: Partial<FidelityKnobs>
}

export interface R129Coefficients {
  opticsSigmaCm: number
  filterTauS: number
  linearizationErrorCm: number
  ambientLightSusceptibility: number
  emiSusceptibility: number
  encoderSlipEffect: number
  scannerTiltEffect: number
  thermalResidualEffect: number
  thermalSpanEffect: number
}

export interface R129Behavior {
  create(def: R129Definition, clock: VirtualClock, seed: number): R129Instrument
  handlers: {
    setConveyorSpeed:   (ctx: WorldContext<R129Instrument>, args: { speedMS: number }) => void
    feedObject:         (ctx: WorldContext<R129Instrument>, args: { lengthCm?: number; widthCm?: number; heightCm?: number }) => void
    clearObject:        (ctx: WorldContext<R129Instrument>) => void
    setAmbientLight:    (ctx: WorldContext<R129Instrument>, args: { lux: number }) => void
    setEmi:             (ctx: WorldContext<R129Instrument>, args: { severity: number }) => void
    setBeamOccluded:    (ctx: WorldContext<R129Instrument>, args: { occluded: boolean }) => void
    setEncoderSlip:     (ctx: WorldContext<R129Instrument>, args: { fraction: number }) => void
    setScannerTilt:     (ctx: WorldContext<R129Instrument>, args: { degrees: number }) => void
    setThermalResidual: (ctx: WorldContext<R129Instrument>, args: { fraction: number }) => void
    driveFeed:          (ctx: WorldContext<R129Instrument>, args: { profileId: string }) => void
    stopFeed:           (ctx: WorldContext<R129Instrument>) => void
  }
}
