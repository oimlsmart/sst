// R 91 kind — the contract every R 91 instance's behavior.js must satisfy.

import type { VirtualClock, Qty, Environment, WorldContext, FidelityKnobs } from '@primmel/sst-runtime/world'

export interface TargetState {
  speedKmh: number
  rangeM: number
  angleDeg: number
}

export interface InterferenceState {
  band: string
  powerDbm: number
  active: boolean
}

export interface ReadingState {
  speedKmh: number
  valid: boolean
  atS: number
}

export interface R91Instrument {
  // /twin legal view
  indication(): Qty
  servedAt(): number
  operationalState(): 'off' | 'warming' | 'ready' | 'fault'
  environment(): Environment

  // active-domain API
  setTarget(speed: number, range: number, angle: number): void
  clearTarget(): void
  setRain(rateMmH: number): void
  setVibration(severity: number): void
  setEmi(severity: number): void
  setOscillatorDrift(ppm: number): void
  setAntennaMisalignment(degrees: number): void
  setInterferenceSource(band: string, powerDbm: number): void
  clearInterferenceSource(): void
  driveProfile(profileId: string): void
  stopProfile(): void

  // common lifecycle
  setEnvironment(e: Partial<Environment>): void
  injectFault(): void
  clearFault(): void
  reset(): void
}

export interface R91Definition {
  id: string
  classification: {
    carrierBand: 'X' | 'K' | 'Ka'
    instrumentCategory: 'stationary' | 'mobile' | 'combined'
    antennaType: 'horn' | 'patch' | 'lens' | 'phased-array'
    installClass: 'class-1' | 'class-2' | 'class-3'
    speedRange: 'low' | 'standard' | 'high'
  }
  designParameters: {
    carrierFreqGHz: number
    speedIntervalKmh: number
    minSpeedKmh: number
    maxSpeedKmh: number
    beamWidthDeg: number
    sideLobeLevelDb: number
    antennaGainDb: number
    emittedPowerMw: number
    installAngleDeg: number
  }
  stack: 'analog' | 'digital'
  coefficients: R91Coefficients
  fidelity?: Partial<FidelityKnobs>
}

export interface R91Coefficients {
  oscillatorStabilityPpm: number
  noiseSigmaKmh: number
  cosineErrorCorrection: boolean
  captureLockTauS: number
  beamWidthDeg: number
  sideLobeLevelDb: number
  rainFadeDbPerMmH: number
  vibrationSusceptibility: number
  emiSusceptibility: number
}

export interface R91Behavior {
  create(def: R91Definition, clock: VirtualClock, seed: number): R91Instrument
  handlers: {
    setTarget:              (ctx: WorldContext<R91Instrument>, args: { speedKmh: number; rangeM?: number; angleDeg?: number }) => void
    clearTarget:            (ctx: WorldContext<R91Instrument>) => void
    setRain:                (ctx: WorldContext<R91Instrument>, args: { rateMmH: number }) => void
    setVibration:           (ctx: WorldContext<R91Instrument>, args: { severity: number }) => void
    setEmi:                 (ctx: WorldContext<R91Instrument>, args: { severity: number }) => void
    setOscillatorDrift:     (ctx: WorldContext<R91Instrument>, args: { ppm: number }) => void
    setAntennaMisalignment: (ctx: WorldContext<R91Instrument>, args: { degrees: number }) => void
    setInterferenceSource:  (ctx: WorldContext<R91Instrument>, args: { band: string; powerDbm: number }) => void
    clearInterferenceSource:(ctx: WorldContext<R91Instrument>) => void
    driveProfile:           (ctx: WorldContext<R91Instrument>, args: { profileId: string }) => void
    stopProfile:            (ctx: WorldContext<R91Instrument>) => void
  }
}
