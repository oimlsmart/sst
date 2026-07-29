// computation.ts — stage (c): the dimension computation, where raw
// estimates become the legal indication. The instrument rounds each
// axis to its scale interval d, applies the limits-of-indication gate
// (R 129-1, 5.2.6: inhibit below Min or beyond Max + 9 d), and derives
// the calculated quantities from the INDICATED dimensions (R 129-1,
// 4.1.6: DV = L × W × H, DW = DV / F, in mathematical agreement).
import type { RawMeasurement } from './scanning.js'

export interface ComputationParams {
  /** the scale interval d (cm) — 1, 2 or 5 × 10ⁿ (R 129-1, 5.2.4). */
  scaleIntervalCm: number
  /** the minimum dimension per axis (cm) — Min ≥ 10 d for d ≤ 2 cm. */
  minDimCm: number
  /** the maximum dimension per axis (cm) — the stated Max. */
  maxLCm: number
  maxWCm: number
  maxHCm: number
  /** the marked conversion factor F (cm³/kg) — DW = DV / F. */
  convFactorCm3PerKg: number
}

export interface ComputedMeasurement {
  valid: boolean
  /** 'ok' | 'below-min' | 'beyond-max' | 'occluded' | 'disturbance' */
  reason: string
  indicatedLengthCm: number
  indicatedWidthCm: number
  indicatedHeightCm: number
  dimVolumeCm3: number
  dimWeightKg: number
}

/** Round to the scale interval (nearest, ties away from zero). */
export function roundToScale(x: number, d: number): number {
  return Math.sign(x) * Math.round(Math.abs(x) / d) * d
}

/** The limits-of-indication gate + the calculated quantities. */
export function computeMeasurement(raw: RawMeasurement, p: ComputationParams): ComputedMeasurement {
  const l = roundToScale(raw.lengthCm, p.scaleIntervalCm)
  const w = roundToScale(raw.widthCm, p.scaleIntervalCm)
  const h = roundToScale(raw.heightCm, p.scaleIntervalCm)
  const margin = 9 * p.scaleIntervalCm
  const below = l < p.minDimCm || w < p.minDimCm || h < p.minDimCm
  const beyond = l > p.maxLCm + margin || w > p.maxWCm + margin || h > p.maxHCm + margin
  const valid = !below && !beyond
  const reason = below ? 'below-min' : beyond ? 'beyond-max' : 'ok'
  return {
    valid,
    reason,
    indicatedLengthCm: valid ? l : 0,
    indicatedWidthCm: valid ? w : 0,
    indicatedHeightCm: valid ? h : 0,
    dimVolumeCm3: valid ? l * w * h : 0,
    dimWeightKg: valid ? (l * w * h) / p.convFactorCm3PerKg : 0,
  }
}
