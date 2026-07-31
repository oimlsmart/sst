// R 144 kind — the contract every R 144 instance's behavior.js must satisfy.

import type { VirtualClock, Qty, Environment, WorldContext, FidelityKnobs } from '@primmel/sst-runtime/world'

export type GasComponent = 'CO' | 'NO' | 'NO2' | 'NOx' | 'SO2' | 'O3' | 'CH4' | 'CO2'

export interface ChannelTruth {
  component: GasComponent
  concentrationPpm: number
  no2Fraction?: number
}

export interface GasBenchState {
  sampleFlowLMin: number
  sampleLineLeakFrac: number
  opticsContaminationFrac: number
  sourceAgeingFrac: number
}

export interface R144Instrument {
  indication(): Qty
  servedAt(): number
  operationalState(): 'off' | 'warming' | 'ready' | 'fault'
  environment(): Environment

  // per-component access (for multi-channel indication)
  indicationFor(component: GasComponent): Qty

  setGasConcentration(component: GasComponent, ppm: number): void
  setNo2Fraction(fraction: number): void
  setInterferents(interferent: string, ppm: number): void
  setSampleFlow(lMin: number): void
  setOpticsContamination(fraction: number): void
  setSourceAgingRate(perDay: number): void
  setSampleLineLeak(fraction: number): void
  zeroCalibration(): void
  spanCalibration(spanPpm: number): void
  runSelfCheck(): void

  setEnvironment(e: Partial<Environment>): void
  injectFault(): void
  clearFault(): void
  reset(): void
}

export interface R144Definition {
  id: string
  classification: {
    measuredComponents: GasComponent[]
    detectionPrinciple: Record<GasComponent, 'NDIR' | 'chemiluminescence' | 'UV-fluorescence' | 'UV-photometry' | 'electrochemical' | 'PAS' | 'FTIR'>
    sampleMethod: 'extractive' | 'in-situ' | 'open-path'
    driftClass: 'class-1' | 'class-2' | 'class-3'
    rangeClass: 'class-A' | 'class-B' | 'class-C'
  }
  designParameters: {
    rangeMinPpm: number
    rangeMaxPpm: number
    responseTimeT90S: number
    sampleFlowLMin: number
    warmUpTimeMin: number
    lowerDetectableLimitPpm: number
  }
  stack: 'digital' | 'analog'
  coefficients: R144Coefficients
  fidelity?: Partial<FidelityKnobs>
}

export interface R144Coefficients {
  crossSensitivityMatrix: Record<string, Record<string, number>>   // [interferent][component] → fraction
  opticsContaminationEffect: number
  sourceAgingEffect: number
  sampleLineLeakEffect: number
  zeroDriftPerDayPpm: number
  spanDriftPerDayPct: number
  noiseSigmaPpm: number
  filterTauS: number
  warmUpTauS: number
}

export interface R144Behavior {
  create(def: R144Definition, clock: VirtualClock, seed: number): R144Instrument
  handlers: {
    setGasConcentration:    (ctx: WorldContext<R144Instrument>, args: { component: string; ppm: number }) => void
    setNo2Fraction:         (ctx: WorldContext<R144Instrument>, args: { fraction: number }) => void
    setInterferents:        (ctx: WorldContext<R144Instrument>, args: { interferent: string; ppm: number }) => void
    setSampleFlow:          (ctx: WorldContext<R144Instrument>, args: { lMin: number }) => void
    setOpticsContamination: (ctx: WorldContext<R144Instrument>, args: { fraction: number }) => void
    setSourceAgingRate:     (ctx: WorldContext<R144Instrument>, args: { perDay: number }) => void
    setSampleLineLeak:      (ctx: WorldContext<R144Instrument>, args: { fraction: number }) => void
    zeroCalibration:        (ctx: WorldContext<R144Instrument>) => void
    spanCalibration:        (ctx: WorldContext<R144Instrument>, args: { spanGasPpm: number }) => void
    runSelfCheck:           (ctx: WorldContext<R144Instrument>) => void
  }
}
