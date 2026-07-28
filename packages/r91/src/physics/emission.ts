// emission.ts — stage (a): microwave emission + target reflection, the
// stage where the Doppler shift physically arises.
//
// Waveform choice: CW Doppler, the classic traffic-radar principle
// (R 91-1, 5.3's doppler-radar working principle is "virtually
// instantaneous" speed measurement). CW carries the whole speed
// measurement in one spectral line, so the phenomena the brief pins —
// the cosine error, oscillator drift, rain attenuation, interference
// capture — realize with no range-gating machinery. Pulsed/FMCW would
// add range resolution the family never uses: the world declares each
// target's range directly and target discrimination is declared
// strongest-in-beam (estimation.ts), not range-gated.

export const C0_M_PER_S = 299792458

export interface RadarTarget {
  /** true vehicle speed (km/h) — reality, /world only. */
  speedKmh: number
  /** distance along the beam (m). */
  rangeM: number
  /** beam-to-trajectory angle θ (deg); 0 = dead ahead along the road. */
  angleDeg: number
  /** radar cross-section (m²). */
  rcsM2: number
}

export interface EmissionParams {
  /** nominal carrier f_0 (Hz) — the reference meter is K-band, 24.15 GHz. */
  carrierHz: number
  /** SNR model anchors: the clear-air SNR at the reference geometry. */
  referenceRangeM: number
  referenceRcsM2: number
  referenceSnrDb: number
  /** two-way rain attenuation coefficient (dB per km per mm/h) — a
   *  lumped K-band constant; rain fades the echo, it never bends it. */
  rainAttenuationDbPerKmPerMmH: number
  /** beam/geometry detection limit (m). */
  maxRangeM: number
}

export interface Reflection {
  /** the echo's Doppler shift (Hz). */
  dopplerHz: number
  /** echo SNR after the radar equation + rain attenuation (dB). */
  snrDb: number
  /** within the beam's detection range. */
  inRange: boolean
}

/** The reflected echo of one target: f_d = 2·v·f_actual·cos(θ)/c, with
 *  the two-way radar equation (received power ∝ RCS / R⁴) and two-way
 *  rain attenuation. The oscillator's ACTUAL frequency is an input —
 *  temperature drift physically scales f_d here; the error realizes
 *  downstream when estimation converts back with the NOMINAL f_0. */
export function reflect(target: RadarTarget, fActualHz: number, rainRateMmH: number, p: EmissionParams): Reflection {
  const vMs = target.speedKmh / 3.6
  const theta = (target.angleDeg * Math.PI) / 180
  const dopplerHz = (2 * vMs * fActualHz * Math.cos(theta)) / C0_M_PER_S
  const rangeKm = target.rangeM / 1000
  const snrDb =
    p.referenceSnrDb +
    10 * Math.log10(Math.max(target.rcsM2, 1e-9) / p.referenceRcsM2) +
    40 * Math.log10(p.referenceRangeM / Math.max(target.rangeM, 1e-9)) -
    2 * p.rainAttenuationDbPerKmPerMmH * rainRateMmH * rangeKm
  return { dopplerHz, snrDb, inRange: target.rangeM <= p.maxRangeM }
}
