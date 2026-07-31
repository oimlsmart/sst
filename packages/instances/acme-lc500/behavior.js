// packages/instances/acme-lc500/src/behavior.ts
import { ComposedInstrument } from "@primmel/sst-runtime/stages/composer";
var create = (def, clock, seed) => {
  const c = def.coefficients;
  const coefficients = toSnakeCoefficients(c);
  const classification = def.classification;
  const inst = new ComposedInstrument({
    classification: {
      construction: classification.construction ?? "column",
      technology: classification.technology ?? classification.technology ?? "strain-gauge",
      stack: def.stack ?? "digital"
    },
    coefficients,
    ...def.physicsChain ? { physicsChain: def.physicsChain } : {},
    ...def.fidelity ? {
      fidelity: {
        servedOffsetKg: def.fidelity.servedOffsetKg,
        servedLagS: def.fidelity.servedLagS
      }
    } : {}
  }, clock, seed);
  return inst;
};
var handlers = {
  applyMass: (ctx, args) => {
    ctx.instrument.placeMass(args.massKg);
  },
  removeMass: (ctx) => {
    ctx.instrument.removeMass();
  },
  setTwinFidelity: (ctx, a) => {
    ctx.instrument.setFidelity(a);
  },
  resetTwinFidelity: (ctx) => {
    ctx.instrument.resetFidelity();
  },
  setThermalHysteresis: (ctx, a) => {
    ctx.instrument.setThermalHysteresis(a.perDegC, a.tauS);
  }
};
var behavior_default = { create, handlers };
function toSnakeCoefficients(c) {
  const out = { ...c };
  const map = {
    sensitivityMVperV: "sensitivity_mVperV",
    gaugeFactor: "gauge_factor",
    excitationV: "excitation_V",
    tcZeroPerDegC: "tc_zero_per_degC",
    tcSpanPerDegC: "tc_span_per_degC",
    barometricPerKPa: "barometric_per_kPa",
    referenceTempDegC: "reference_temp_degC",
    referencePressureKPa: "reference_pressure_kPa",
    thermalHysteresisPerDegC: "thermal_hysteresis_per_degC",
    thermalHysteresisTauS: "thermal_hysteresis_tau_s",
    filterTauS: "filter_tau_s",
    linearizationErrorKg: "linearization_error_kg",
    compensationResidualPerDegC: "compensation_residual_per_degC",
    noiseSigmaKg: "noise_sigma_kg",
    scaleIntervalKg: "scale_interval_kg",
    capacityKg: "capacity_kg",
    warmUpTauS: "warm_up_tau_s",
    spanDriftPerDay: "span_drift_per_day",
    creepCoefficient: "creep_coefficient",
    creepTauS: "creep_tau_s"
  };
  for (const [camel, snake] of Object.entries(map)) {
    if (typeof c[camel] === "number" && out[snake] == null) out[snake] = c[camel];
  }
  return out;
}
export {
  create,
  behavior_default as default,
  handlers
};
