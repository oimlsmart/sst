// conditioning.ts — stage (c): the output conditioning. The oscillator
// model (frequency stability: temperature drift + bias + ageing) feeds
// BACK into stage (a) — drift physically scales the Doppler shift at
// the source. Here the estimate meets the calibration factor, the
// measuring-interval limits (R 91-1, 6.1: no indication outside the
// declared interval), and the legal indication's integer-km/h
// resolution (R 91-1, 6.2).

export interface ConditioningParams {
  /** the declared speed measuring interval (R 91-1, 6.1 — min ≤ 20,
   *  max ≥ 180 km/h for the reference meter). */
  intervalMinKmh: number
  intervalMaxKmh: number
  /** the calibration factor (nominal 1.0). */
  calibrationFactor: number
  /** oscillator temperature coefficient (ppm/°C). */
  oscillatorTcPpmPerDegC: number
  /** static oscillator bias (ppm) — a fault knob. */
  oscillatorBiasPpm: number
  /** oscillator ageing (ppm/day) — a fault knob. */
  oscillatorDriftPpmPerDay: number
  referenceTempDegC: number
}

/** The oscillator's fractional frequency error (ppm): temperature
 *  drift + static bias + ageing. */
export function oscillatorErrorPpm(p: ConditioningParams, tempDegC: number, ageDays: number): number {
  return (
    p.oscillatorTcPpmPerDegC * (tempDegC - p.referenceTempDegC) +
    p.oscillatorBiasPpm +
    p.oscillatorDriftPpmPerDay * ageDays
  )
}

/** The actual carrier frequency under the error (stage (a)'s input). */
export function actualCarrierHz(nominalHz: number, errorPpm: number): number {
  return nominalHz * (1 + errorPpm / 1e6)
}

export interface ConditionedReading {
  /** inside the declared measuring interval — outside it the meter
   *  produces NO indication (R 91-1, 6.1). */
  inInterval: boolean
  /** the calibrated, integer-resolution indication (km/h, R 91-1, 6.2). */
  indicatedKmh: number
}

/** The output stage: calibration, the interval gate, integer rounding. */
export function conditionReading(estimateKmh: number, p: ConditioningParams): ConditionedReading {
  const calibrated = estimateKmh * p.calibrationFactor
  const inInterval = calibrated >= p.intervalMinKmh && calibrated <= p.intervalMaxKmh
  return { inInterval, indicatedKmh: Math.round(calibrated) }
}
