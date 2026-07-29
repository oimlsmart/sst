import { describe, it, expect } from 'vitest'
import {
  alongTrackResolutionCm, edgeSigmaCm, widthSigmaCm, heightSigmaCm,
  thermalSpanFrac, scanObject, type ScanningParams,
} from './scanning.js'
import type { ConveyorObjectSpec } from './geometry.js'

// The scanning-stage laws, pinned per phenomenon (spec §12: per-stage
// unit tests; scripted normals make the trajectories golden).
const P: ScanningParams = {
  scanRateHz: 200,
  edgeSigmaRefCm: 0.03, widthSigmaRefCm: 0.03, heightSigmaRefCm: 0.03,
  reflectanceRef: 0.9, ambientLxRef: 100, ambientNoiseGain: 0.5,
  frameAlphaFracPerDegC: 0.000023, referenceTempDegC: 20,
}
const BOX: ConveyorObjectSpec = {
  lengthCm: 60, widthCm: 40, heightCm: 30,
  shape: 'rectangular', reflectance: 0.9, protrusionCm: 0, orientationDeg: 0,
}
const QUIET = { conveyorSpeedMS: 1.0, ambientLx: 100, temperatureDegC: 20, encoderSlipFrac: 0, scannerTiltDeg: 0, thermalResidualFrac: 0 }
const zero = () => 0

describe('the optical scanning stage (stage b)', () => {
  it('the along-track resolution is the belt travel per frame — the speed-of-movement law', () => {
    expect(alongTrackResolutionCm(1.5, P)).toBeCloseTo(0.75, 10) // 200 Hz at V_max
    expect(alongTrackResolutionCm(0.1, P)).toBeCloseTo(0.05, 10) // 200 Hz at V_min
    expect(alongTrackResolutionCm(1.5, { ...P, scanRateHz: 50 })).toBeCloseTo(3, 10) // the slow-scanner preset
  })

  it('edge/width jitter amplify as the surface darkens (the A.3.1 white-to-black span)', () => {
    expect(edgeSigmaCm(0.9, P)).toBeCloseTo(0.03, 10)
    expect(edgeSigmaCm(0.05, P)).toBeCloseTo(0.03 * Math.sqrt(0.9 / 0.05), 10) // matt black ≈ ×4.24
    expect(widthSigmaCm(0.05, P)).toBeCloseTo(0.03 * Math.sqrt(0.9 / 0.05), 10)
  })

  it('height jitter amplifies with ambient light (the A.4.1 100–1500 lx range)', () => {
    const at100 = heightSigmaCm(0.9, 100, P)
    const at1500 = heightSigmaCm(0.9, 1500, P)
    expect(at1500 / at100).toBeCloseTo(Math.sqrt(8.5 / 1.5), 6) // ×2.38 with gain 0.5
    expect(heightSigmaCm(0.9, 1500, { ...P, ambientNoiseGain: 6 }) / at100).toBeCloseTo(Math.sqrt(91 / 1.5), 6)
  })

  it('the thermal span error is the frame expansion plus the post-cycle residual', () => {
    expect(thermalSpanFrac(40, 0, P)).toBeCloseTo(0.00046, 8) // +20 °C × 23 ppm/°C
    expect(thermalSpanFrac(20, 0.015, P)).toBeCloseTo(0.015, 10) // the configurable post-cycle difference
  })

  it('a quiet scan of a white box at reference conditions reproduces the box', () => {
    const raw = scanObject(BOX, QUIET, P, zero)
    expect(raw.lengthCm).toBeCloseTo(60, 10)
    expect(raw.widthCm).toBeCloseTo(40, 10)
    expect(raw.heightCm).toBeCloseTo(30, 10)
    expect(raw.protrusionMissed).toBe(false)
  })

  it('encoder slip scales the length; the scanner tilt biases width with the object height', () => {
    const slipped = scanObject(BOX, { ...QUIET, encoderSlipFrac: 0.02 }, P, zero)
    expect(slipped.lengthCm).toBeCloseTo(61.2, 6)
    const tilted = scanObject(BOX, { ...QUIET, scannerTiltDeg: 5 }, P, zero)
    expect(tilted.widthCm).toBeCloseTo(40 + 30 * Math.tan((5 * Math.PI) / 180), 6)
    expect(tilted.lengthCm).toBeCloseTo(60, 6) // the tilt never touches the beam-cutting length
  })

  it('the thermal residual scales every axis (the post-temperature-cycle difference)', () => {
    const raw = scanObject(BOX, { ...QUIET, thermalResidualFrac: 0.015 }, P, zero)
    expect(raw.lengthCm).toBeCloseTo(60 * 1.015, 6)
    expect(raw.widthCm).toBeCloseTo(40 * 1.015, 6)
    expect(raw.heightCm).toBeCloseTo(30 * 1.015, 6)
  })

  it('a protrusion thinner than the along-track resolution falls between cross-sections (A.3.9)', () => {
    const irregular: ConveyorObjectSpec = { ...BOX, shape: 'irregular', protrusionCm: 2 }
    // 200 Hz at 1 m/s: resolution 0.5 cm — the 2 cm protrusion resolves.
    const resolved = scanObject(irregular, QUIET, P, zero)
    expect(resolved.protrusionMissed).toBe(false)
    expect(resolved.lengthCm).toBeCloseTo(62, 6) // the enclosing box includes it
    // 50 Hz at 1.5 m/s: resolution 3 cm — the 2 cm protrusion is missed.
    const missed = scanObject(irregular, { ...QUIET, conveyorSpeedMS: 1.5 }, { ...P, scanRateHz: 50 }, zero)
    expect(missed.protrusionMissed).toBe(true)
    expect(missed.lengthCm).toBeCloseTo(60, 6) // under-read by the protrusion
  })
})
