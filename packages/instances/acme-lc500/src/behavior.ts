// ACME LC-500 instance package — behavior source.
//
// Implements the R 60 kind's R60Behavior interface via the runtime's
// data-driven ComposedInstrument (physics-chain.yaml + coefficients).
// Bundled to behavior.js at the package root for plug-and-play loading.

import type { R60Behavior, R60Definition, R60Instrument } from '../../../kinds/sst-r60/interface.d.ts'
import type { VirtualClock } from '@primmel/sst-runtime'
import { ComposedInstrument } from '@primmel/sst-runtime/stages/composer'
import type { PhysicsChainDecl } from '@primmel/sst-runtime/stages/data-driven'

export const create = (def: R60Definition & { physicsChain?: PhysicsChainDecl; coefficients?: Record<string, number> }, clock: VirtualClock, seed: number): R60Instrument => {
  const c = def.coefficients as unknown as Record<string, number>
  // Coefficients may arrive camelCase (from definition-builder aliases)
  // or snake_case (from coefficients.yaml). Normalize to snake_case for
  // ComposedInstrument.
  const coefficients = toSnakeCoefficients(c)

  const classification = def.classification as unknown as Record<string, string>
  const inst = new ComposedInstrument({
    classification: {
      construction: classification.construction ?? 'column',
      technology: classification.technology ?? classification.technology ?? 'strain-gauge',
      stack: (def.stack as string) ?? 'digital',
    },
    coefficients,
    ...(def.physicsChain ? { physicsChain: def.physicsChain } : {}),
    ...(def.fidelity ? {
      fidelity: {
        servedOffsetKg: (def.fidelity as { servedOffsetKg?: number }).servedOffsetKg,
        servedLagS: (def.fidelity as { servedLagS?: number }).servedLagS,
      },
    } : {}),
  }, clock, seed)

  // ComposedInstrument already satisfies R60Instrument (placeMass, etc.).
  return inst as unknown as R60Instrument
}

export const handlers: R60Behavior['handlers'] = {
  applyMass:            (ctx, args) => { ctx.instrument.placeMass(args.massKg) },
  removeMass:           (ctx)      => { ctx.instrument.removeMass() },
  setTwinFidelity:      (ctx, a)   => { ctx.instrument.setFidelity(a) },
  resetTwinFidelity:    (ctx)      => { ctx.instrument.resetFidelity() },
  setThermalHysteresis: (ctx, a)   => { ctx.instrument.setThermalHysteresis(a.perDegC, a.tauS) },
}

export default { create, handlers }

function toSnakeCoefficients(c: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...c }
  const map: Record<string, string> = {
    sensitivityMVperV: 'sensitivity_mVperV',
    gaugeFactor: 'gauge_factor',
    excitationV: 'excitation_V',
    tcZeroPerDegC: 'tc_zero_per_degC',
    tcSpanPerDegC: 'tc_span_per_degC',
    barometricPerKPa: 'barometric_per_kPa',
    referenceTempDegC: 'reference_temp_degC',
    referencePressureKPa: 'reference_pressure_kPa',
    thermalHysteresisPerDegC: 'thermal_hysteresis_per_degC',
    thermalHysteresisTauS: 'thermal_hysteresis_tau_s',
    filterTauS: 'filter_tau_s',
    linearizationErrorKg: 'linearization_error_kg',
    compensationResidualPerDegC: 'compensation_residual_per_degC',
    noiseSigmaKg: 'noise_sigma_kg',
    scaleIntervalKg: 'scale_interval_kg',
    capacityKg: 'capacity_kg',
    warmUpTauS: 'warm_up_tau_s',
    spanDriftPerDay: 'span_drift_per_day',
    creepCoefficient: 'creep_coefficient',
    creepTauS: 'creep_tau_s',
  }
  for (const [camel, snake] of Object.entries(map)) {
    if (typeof c[camel] === 'number' && out[snake] == null) out[snake] = c[camel]!
  }
  return out
}
