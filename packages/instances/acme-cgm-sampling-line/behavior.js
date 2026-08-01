import { createRequire as _cr } from 'module'; const require = _cr(import.meta.url);

// packages/instances/acme-cgm-sampling-line/src/behavior.ts
var DEFAULT_AMBIENT = {
  coPpm: 0.4,
  noxPpm: 0.02,
  no2Fraction: 0.05,
  co2PercentVol: 0.04,
  h2oPercentVol: 1.2
};
function pick(def, ...keys) {
  for (const k of keys) {
    const v = def[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return void 0;
}
var SamplingLine = class {
  #clock;
  #ambient;
  #queue = [];
  #lineVolumeL;
  #nominalFlowLPerMin;
  #minimumFlowLPerMin;
  #nominalTransportDelayS;
  #stagnationRatePerS;
  #responseTauS;
  #flowLPerMin;
  #lineTemperatureDegC;
  #leakFraction;
  #faulted = false;
  #inlet;
  #outlet;
  #env = { temperatureDegC: 20, humidityPercentRh: 50, pressureKPa: 101.325 };
  #servedAt = 0;
  constructor(def, clock) {
    this.#clock = clock;
    const dp = def.designParameters ?? {};
    const coeff = def.coefficients ?? {};
    this.#lineVolumeL = pick(dp, "line_volume_l", "lineVolumeL") ?? 0.05;
    this.#nominalFlowLPerMin = pick(dp, "nominal_flow_l_min", "nominalFlowLMin", "nominal_flow_l_per_min", "nominalFlowLPerMin") ?? 1.5;
    this.#minimumFlowLPerMin = pick(dp, "minimum_flow_l_min", "minimumFlowLMin", "minimum_flow_l_per_min", "minimumFlowLPerMin") ?? 0.5;
    this.#nominalTransportDelayS = pick(coeff, "nominal_transport_delay_s", "nominalTransportDelayS") ?? 10;
    this.#stagnationRatePerS = pick(coeff, "stagnation_rate_per_s", "stagnationRatePerS", "rate_per_s", "ratePerS") ?? 0.05;
    this.#responseTauS = pick(coeff, "response_tau_s", "responseTauS") ?? 0.5;
    this.#ambient = {
      coPpm: pick(dp, "ambient_co_ppm", "ambientCoPpm") ?? DEFAULT_AMBIENT.coPpm,
      noxPpm: pick(dp, "ambient_nox_ppm", "ambientNoxPpm") ?? DEFAULT_AMBIENT.noxPpm,
      no2Fraction: pick(dp, "ambient_no2_fraction", "ambientNo2Fraction") ?? DEFAULT_AMBIENT.no2Fraction,
      co2PercentVol: pick(dp, "ambient_co2_percent", "ambientCo2Percent", "ambient_co2_percent_vol", "ambientCo2PercentVol") ?? DEFAULT_AMBIENT.co2PercentVol,
      h2oPercentVol: pick(dp, "ambient_h2o_percent", "ambientH2oPercent", "ambient_h2o_percent_vol", "ambientH2oPercentVol") ?? DEFAULT_AMBIENT.h2oPercentVol
    };
    this.#flowLPerMin = coeff.flow_l_per_min ?? this.#nominalFlowLPerMin;
    this.#lineTemperatureDegC = 20;
    this.#leakFraction = coeff.default_leak_fraction ?? coeff.leak_fraction ?? 0;
    this.#inlet = { ...this.#ambient };
    this.#outlet = { ...this.#ambient };
    clock.onAdvance((dt) => this.#tick(dt));
  }
  // ── TwinInstrumentView (served registers) ─────────────────────────────
  sampleFlow() {
    return { value: this.#flowLPerMin, unit: "L/min", kind: "volume-flow-rate" };
  }
  linePressure() {
    const inletKpa = 101.325;
    const dropPerLPerMin = 2;
    return { value: inletKpa - dropPerLPerMin * this.#flowLPerMin, unit: "kPa", kind: "pressure" };
  }
  gasTemperature() {
    return { value: this.#lineTemperatureDegC, unit: "\xB0C", kind: "temperature" };
  }
  transportDelay() {
    return { value: this.#computeTransportDelayS(), unit: "s", kind: "time" };
  }
  outletComposition() {
    return { ...this.#outlet };
  }
  servedAt() {
    return this.#servedAt;
  }
  operationalState() {
    return this.#faulted ? "fault" : "ok";
  }
  environment() {
    return { ...this.#env };
  }
  // ── Coupling ports ───────────────────────────────────────────────────
  setInletComposition(c) {
    if (c.coPpm != null) this.#inlet.coPpm = c.coPpm;
    if (c.noxPpm != null) this.#inlet.noxPpm = c.noxPpm;
    if (c.no2Fraction != null) this.#inlet.no2Fraction = c.no2Fraction;
    if (c.co2PercentVol != null) this.#inlet.co2PercentVol = c.co2PercentVol;
    if (c.h2oPercentVol != null) this.#inlet.h2oPercentVol = c.h2oPercentVol;
  }
  inletComposition() {
    return { ...this.#inlet };
  }
  // ── WorldInstrument (mutators — /world only) ─────────────────────────
  setFlowRate(lPerMin) {
    if (!(lPerMin >= 0)) throw new Error(`flow rate must be \u2265 0, got ${lPerMin}`);
    this.#flowLPerMin = lPerMin;
  }
  setLineTemperature(degC) {
    this.#lineTemperatureDegC = degC;
  }
  introduceLeak(fraction) {
    if (!(fraction >= 0 && fraction <= 1)) throw new Error(`leak fraction must be in 0..1, got ${fraction}`);
    this.#leakFraction = fraction;
  }
  setEnvironment(e) {
    this.#env = { ...this.#env, ...e };
  }
  injectFault() {
    this.#faulted = true;
  }
  clearFault() {
    this.#faulted = false;
  }
  reset() {
    this.#queue.length = 0;
    this.#inlet = { ...this.#ambient };
    this.#outlet = { ...this.#ambient };
    this.#leakFraction = 0;
    this.#faulted = false;
  }
  groundTruth() {
    return {
      clockS: this.#clock.now(),
      environment: this.#env,
      line: {
        flowLPerMin: this.#flowLPerMin,
        lineTemperatureDegC: this.#lineTemperatureDegC,
        leakFraction: this.#leakFraction,
        transportDelayS: this.#computeTransportDelayS(),
        faulted: this.#faulted
      },
      inletComposition: { ...this.#inlet },
      outletComposition: { ...this.#outlet }
    };
  }
  // ── The signal chain (called on each clock advance) ──────────────────
  #tick(dt) {
    const now = this.#clock.now();
    if (this.#flowLPerMin < this.#minimumFlowLPerMin) {
      this.#faulted = true;
    } else if (this.#faulted && this.#flowLPerMin >= this.#minimumFlowLPerMin) {
      this.#faulted = false;
    }
    let target;
    if (this.#faulted) {
      const decay = 1 - Math.exp(-this.#stagnationRatePerS * dt);
      target = this.#blend(this.#outlet, this.#ambient, decay);
    } else {
      const diluted = this.#blend(this.#inlet, this.#ambient, this.#leakFraction);
      if (this.#responseTauS > 0 && dt < this.#responseTauS * 100) {
        const a = 1 - Math.exp(-dt / this.#responseTauS);
        target = this.#blend(this.#outlet, diluted, a);
      } else {
        target = diluted;
      }
    }
    this.#outlet = target;
    this.#servedAt = now;
  }
  #computeTransportDelayS() {
    if (this.#flowLPerMin <= 0) return this.#nominalTransportDelayS;
    return Math.min(this.#nominalTransportDelayS, this.#lineVolumeL / this.#flowLPerMin * 60);
  }
  #blend(a, b, f) {
    const g = (x, y) => x * (1 - f) + y * f;
    return {
      coPpm: g(a.coPpm, b.coPpm),
      noxPpm: g(a.noxPpm, b.noxPpm),
      no2Fraction: a.no2Fraction * (1 - f) + b.no2Fraction * f,
      co2PercentVol: g(a.co2PercentVol, b.co2PercentVol),
      h2oPercentVol: g(a.h2oPercentVol, b.h2oPercentVol)
    };
  }
};
var create = (def, clock, _seed) => {
  return new SamplingLine(def, clock);
};
var handlers = {
  setFlowRate: (ctx, a) => ctx.instrument.setFlowRate(a.lPerMin),
  setLineTemperature: (ctx, a) => ctx.instrument.setLineTemperature(a.degC),
  introduceLeak: (ctx, a) => ctx.instrument.introduceLeak(a.fraction),
  setInletComposition: (ctx, a) => ctx.instrument.setInletComposition(a)
};
var behavior_default = { create, handlers };
export {
  create,
  behavior_default as default,
  handlers
};
