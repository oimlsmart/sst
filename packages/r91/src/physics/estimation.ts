// estimation.ts — stage (b): demodulation + Doppler→speed estimation.
// The receiver mixes the echoes with the local oscillator, detects the
// Doppler lines, picks ONE per the declared discrimination mode, and
// converts f_d → speed using the NOMINAL f_0 and the instrument's
// declared installation angle — every conversion assumption is an error
// channel, realized here through the physics, never asserted.
import { C0_M_PER_S } from './emission.js'

/** The declared target-discrimination mode: the strongest return in the
 *  beam wins. (fastest / first-in-beam are other real modes — the
 *  family declares this one; the world's interference source is what a
 *  strongest-in-beam meter can legitimately be captured by.) */
export type DiscriminationMode = 'strongest-in-beam'
export const DISCRIMINATION_MODE: DiscriminationMode = 'strongest-in-beam'

export interface DopplerLine {
  dopplerHz: number
  snrDb: number
  inRange: boolean
  source: 'target' | 'interference'
}

export interface EstimationParams {
  /** nominal f_0 (Hz) — the conversion constant the firmware uses. */
  carrierHz: number
  /** the declared beam-to-road installation angle (deg); the firmware
   *  compensates 1/cos(installAngle) — a misaligned beam UNDER-reads. */
  installAngleDeg: number
  /** detection threshold (dB): below it there is NO reading — a missed
   *  measurement, never a wrong one. */
  detectSnrDbMin: number
  /** estimation σ (km/h) at the reference SNR; scales as 1/√SNR below it. */
  noiseSigmaKmh: number
  referenceSnrDb: number
  /** vibration broadens the Doppler line: added σ per severity level. */
  vibrationNoiseKmhPerSeverity: number
  /** EMI raises the receiver noise floor: SNR penalty per severity level. */
  emiNoiseFloorDbPerSeverity: number
}

export interface Estimate {
  detected: boolean
  /** the winner's high-resolution speed estimate (km/h; 0 when none). */
  speedKmh: number
  /** the winner's post-disturbance SNR (dB; 0 when none). */
  snrDb: number
  source: 'target' | 'interference' | 'none'
}

/** Demodulate + estimate. Disturbance channels enter as physics: EMI
 *  raises the noise floor (a faded echo is a MISSED reading), vibration
 *  widens the estimation noise. A competing interference line can
 *  CAPTURE a strongest-in-beam discriminator — a wrong reading by
 *  physics, exactly what R 91-2's disturbance runs probe. */
export function estimate(
  lines: DopplerLine[],
  p: EstimationParams,
  disturbances: { vibrationSeverity: number; emiSeverity: number },
  normal: () => number,
): Estimate {
  const noiseFloorDb = disturbances.emiSeverity * p.emiNoiseFloorDbPerSeverity
  const candidates = lines
    .filter(l => l.inRange)
    .map(l => ({ ...l, snrDb: l.snrDb - noiseFloorDb }))
    .filter(l => l.snrDb >= p.detectSnrDbMin)
  if (candidates.length === 0) return { detected: false, speedKmh: 0, snrDb: 0, source: 'none' }
  // the declared discrimination mode: strongest-in-beam
  const winner = candidates.reduce((a, b) => (b.snrDb > a.snrDb ? b : a))
  // nominal f_0 — oscillator drift realizes as a fractional speed error
  const vMs = (winner.dopplerHz * C0_M_PER_S) / (2 * p.carrierHz)
  const compensation = 1 / Math.cos((p.installAngleDeg * Math.PI) / 180)
  const sigmaKmh =
    p.noiseSigmaKmh * Math.pow(10, (p.referenceSnrDb - winner.snrDb) / 20) +
    disturbances.vibrationSeverity * p.vibrationNoiseKmhPerSeverity
  const speedKmh = vMs * 3.6 * compensation + normal() * sigmaKmh
  return { detected: true, speedKmh, snrDb: winner.snrDb, source: winner.source }
}
