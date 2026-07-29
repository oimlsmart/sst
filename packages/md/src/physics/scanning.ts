// scanning.ts — stage (b): the optical measuring chain, where the
// object reality becomes raw dimension estimates. The family's
// technology is the light-section scanner (R 129-2, Annex A, Table
// A.1's optical principle): a laser line triangulated across the frame
// gives the width/height cross-sections; the beam-cutting light curtain
// plus the belt encoder gives the length from the traversal time.
//
// The lumped laws (the §4.5 fidelity grounding — parameters, never
// geometry):
//   - along-track sampling: cross-sections at the frame rate f_scan;
//     the length quantization jitter scales with v / f_scan — THE
//     speed-of-movement effect (R 129-2, Annex A: pass at V_min, fail
//     at V_max when the frame rate is inadequate);
//   - edge detection (beam-cutting): jitter σ_edge grows as the surface
//     reflectance falls (dark parcels return less light — the A.3.1
//     shiny-white-to-matt-black test objects);
//   - triangulation noise (height/width): shot noise grows with ambient
//     light (the A.4.1 ambient-light test, 100–1500 lx) and with falling
//     reflectance;
//   - protrusion resolution: a protrusion thinner than the along-track
//     resolution falls between cross-sections and is MISSED (the
//     sampled enclosing box under-reads — A.3.9);
//   - systematic effects: belt-encoder slip scales the length; a tilted
//     scan head biases width/height with the object height; the frame's
//     thermal expansion plus the operator-configurable post-temperature-
//     -cycle residual scale every axis as a fractional span error.
import { enclosingBoxCm, type ConveyorObjectSpec } from './geometry.js'

export interface ScanningParams {
  /** cross-section frame rate (Hz) — laser line scans per second. */
  scanRateHz: number
  /** edge-detection jitter at the reference reflectance (cm, σ). */
  edgeSigmaRefCm: number
  /** triangulation jitter at the reference reflectance (cm, σ). */
  widthSigmaRefCm: number
  heightSigmaRefCm: number
  /** the reflectance the jitter references (0.9 ≈ white cardboard). */
  reflectanceRef: number
  /** the ambient light the noise references (lx; the A.4.1 low end). */
  ambientLxRef: number
  /** how strongly ambient light adds shot noise (0 = immune). */
  ambientNoiseGain: number
  /** measuring-frame thermal expansion as a fractional span error
   *  (per °C; the aluminium-rail order, ~23 ppm/°C). */
  frameAlphaFracPerDegC: number
  referenceTempDegC: number
}

export interface ScanInputs {
  conveyorSpeedMS: number
  ambientLx: number
  temperatureDegC: number
  /** belt-encoder slip (fraction) — the length scales with it. */
  encoderSlipFrac: number
  /** scan-head tilt (deg) — width/height bias with the object height. */
  scannerTiltDeg: number
  /** the post-temperature-cycle residual span error (fraction) — the
   *  configurable post-cycle difference (the standing sim doctrine). */
  thermalResidualFrac: number
}

export interface RawMeasurement {
  lengthCm: number
  widthCm: number
  heightCm: number
  /** the irregular object's protrusion fell between cross-sections. */
  protrusionMissed: boolean
  /** the along-track quantization jitter applied (cm). */
  quantizationCm: number
  sigmas: { edgeCm: number; widthCm: number; heightCm: number }
}

/** The along-track sampling resolution (cm): belt travel per frame. */
export function alongTrackResolutionCm(speedMS: number, p: ScanningParams): number {
  return (speedMS * 100) / p.scanRateHz
}

/** Beam-cutting edge jitter (cm, σ): worse on dark surfaces. */
export function edgeSigmaCm(reflectance: number, p: ScanningParams): number {
  return p.edgeSigmaRefCm * Math.sqrt(p.reflectanceRef / reflectance)
}

/** Triangulation jitter, width (cm, σ). */
export function widthSigmaCm(reflectance: number, p: ScanningParams): number {
  return p.widthSigmaRefCm * Math.sqrt(p.reflectanceRef / reflectance)
}

/** Triangulation jitter, height (cm, σ): ambient light adds shot noise. */
export function heightSigmaCm(reflectance: number, ambientLx: number, p: ScanningParams): number {
  const ambient = Math.sqrt(1 + p.ambientNoiseGain * (ambientLx / p.ambientLxRef))
  return p.heightSigmaRefCm * Math.sqrt(p.reflectanceRef / reflectance) * ambient
}

/** The total fractional span error from temperature: the frame's
 *  thermal expansion plus the post-cycle residual. */
export function thermalSpanFrac(temperatureDegC: number, residualFrac: number, p: ScanningParams): number {
  return p.frameAlphaFracPerDegC * (temperatureDegC - p.referenceTempDegC) + residualFrac
}

/** One traversal through the optical chain: the raw (pre-rounding)
 *  dimension estimates with every stage-(b) phenomenon realized.
 *  `normal` is the seeded standard-normal source (golden trajectories). */
export function scanObject(spec: ConveyorObjectSpec, inputs: ScanInputs, p: ScanningParams, normal: () => number): RawMeasurement {
  const box = enclosingBoxCm(spec)
  const resolutionCm = alongTrackResolutionCm(inputs.conveyorSpeedMS, p)
  // Quantization jitter: modelled normal with the uniform's standard
  // deviation (resolution / √12 ≈ 0.289 × resolution; 0.5 × 0.577).
  const quantizationCm = normal() * 0.577 * (resolutionCm / 2)
  const sEdge = edgeSigmaCm(spec.reflectance, p)
  const sWidth = widthSigmaCm(spec.reflectance, p)
  const sHeight = heightSigmaCm(spec.reflectance, inputs.ambientLx, p)
  const span = 1 + thermalSpanFrac(inputs.temperatureDegC, inputs.thermalResidualFrac, p)
  const tilt = (inputs.scannerTiltDeg * Math.PI) / 180
  // The protrusion falls between cross-sections when thinner than the
  // along-track resolution — the sampled enclosing box under-reads.
  const protrusionMissed = spec.shape === 'irregular' && spec.protrusionCm > 0 && spec.protrusionCm < resolutionCm
  // Length: beam-cutting edges × the belt encoder — encoder slip scales.
  const lengthCm =
    (box.l + quantizationCm + normal() * sEdge - (protrusionMissed ? spec.protrusionCm : 0)) *
    span *
    (1 + inputs.encoderSlipFrac)
  // Width/height: the triangulated cross-section extremes; a tilted
  // head biases both with the object height.
  const widthCm = (box.w + normal() * sWidth + box.h * Math.tan(tilt)) * span
  const heightCm = (box.h + normal() * sHeight + box.h * (1 / Math.cos(tilt) - 1)) * span
  return { lengthCm, widthCm, heightCm, protrusionMissed, quantizationCm, sigmas: { edgeCm: sEdge, widthCm: sWidth, heightCm: sHeight } }
}
