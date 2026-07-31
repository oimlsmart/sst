// packages/r91/src/instrument.ts
import { qty } from "@primmel/sst-runtime/physics/quantity";
import { normal } from "@primmel/sst-runtime/physics/rng";
import { REFERENCE_ENVIRONMENT } from "@primmel/sst-runtime/instrument";

// packages/r91/src/physics/emission.ts
var C0_M_PER_S = 299792458;
function reflect(target, fActualHz, rainRateMmH, p) {
  const vMs = target.speedKmh / 3.6;
  const theta = target.angleDeg * Math.PI / 180;
  const dopplerHz = 2 * vMs * fActualHz * Math.cos(theta) / C0_M_PER_S;
  const rangeKm = target.rangeM / 1e3;
  const snrDb = p.referenceSnrDb + 10 * Math.log10(Math.max(target.rcsM2, 1e-9) / p.referenceRcsM2) + 40 * Math.log10(p.referenceRangeM / Math.max(target.rangeM, 1e-9)) - 2 * p.rainAttenuationDbPerKmPerMmH * rainRateMmH * rangeKm;
  return { dopplerHz, snrDb, inRange: target.rangeM <= p.maxRangeM };
}

// packages/r91/src/physics/estimation.ts
function estimate(lines, p, disturbances, normal2) {
  const noiseFloorDb = disturbances.emiSeverity * p.emiNoiseFloorDbPerSeverity;
  const candidates = lines.filter((l) => l.inRange).map((l) => ({ ...l, snrDb: l.snrDb - noiseFloorDb })).filter((l) => l.snrDb >= p.detectSnrDbMin);
  if (candidates.length === 0) return { detected: false, speedKmh: 0, snrDb: 0, source: "none" };
  const winner = candidates.reduce((a, b) => b.snrDb > a.snrDb ? b : a);
  const vMs = winner.dopplerHz * C0_M_PER_S / (2 * p.carrierHz);
  const compensation = 1 / Math.cos(p.installAngleDeg * Math.PI / 180);
  const sigmaKmh = p.noiseSigmaKmh * Math.pow(10, (p.referenceSnrDb - winner.snrDb) / 20) + disturbances.vibrationSeverity * p.vibrationNoiseKmhPerSeverity;
  const speedKmh = vMs * 3.6 * compensation + normal2() * sigmaKmh;
  return { detected: true, speedKmh, snrDb: winner.snrDb, source: winner.source };
}

// packages/r91/src/physics/conditioning.ts
function oscillatorErrorPpm(p, tempDegC, ageDays) {
  return p.oscillatorTcPpmPerDegC * (tempDegC - p.referenceTempDegC) + p.oscillatorBiasPpm + p.oscillatorDriftPpmPerDay * ageDays;
}
function actualCarrierHz(nominalHz, errorPpm) {
  return nominalHz * (1 + errorPpm / 1e6);
}
function conditionReading(estimateKmh, p) {
  const calibrated = estimateKmh * p.calibrationFactor;
  const inInterval = calibrated >= p.intervalMinKmh && calibrated <= p.intervalMaxKmh;
  return { inInterval, indicatedKmh: Math.round(calibrated) };
}

// packages/r91/src/driver.ts
function speedAt(keyframes, t) {
  const first = keyframes[0];
  if (t <= first.atS) return first.speedKmh;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i], b = keyframes[i + 1];
    if (t <= b.atS) {
      const span = b.atS - a.atS;
      const f = span <= 0 ? 1 : (t - a.atS) / span;
      return a.speedKmh + (b.speedKmh - a.speedKmh) * f;
    }
  }
  return keyframes[keyframes.length - 1].speedKmh;
}
function validateSpeedKeyframes(keyframes) {
  if (keyframes.length === 0) throw new Error("driveProfile requires at least one keyframe");
  let prev = -Infinity;
  for (const [i, k] of keyframes.entries()) {
    if (!(k.atS >= 0)) throw new Error(`driveProfile keyframe ${i}: atS must be \u2265 0, got ${k.atS}`);
    if (k.atS < prev) throw new Error(`driveProfile keyframe ${i}: atS must be non-decreasing`);
    if (!(k.speedKmh >= 0)) throw new Error(`driveProfile keyframe ${i}: speedKmh must be \u2265 0, got ${k.speedKmh}`);
    prev = k.atS;
  }
}
var SpeedProfilePlayer = class {
  #keyframes;
  #off;
  constructor(keyframes) {
    validateSpeedKeyframes(keyframes);
    this.#keyframes = keyframes.map((k) => ({ ...k }));
  }
  start(clock, apply) {
    let programT = 0;
    apply(this.#keyframes[0].speedKmh);
    this.#off = clock.onAdvance((dt) => {
      programT += dt;
      apply(speedAt(this.#keyframes, programT));
    });
  }
  stop() {
    this.#off?.();
    this.#off = void 0;
  }
};

// packages/r91/src/instrument.ts
var R91_GOOD = {
  id: "r91-ref-good",
  parameters: {
    carrierHz: 2415e7,
    referenceRangeM: 100,
    referenceRcsM2: 5,
    referenceSnrDb: 40,
    rainAttenuationDbPerKmPerMmH: 0.2,
    maxRangeM: 400,
    installAngleDeg: 12,
    detectSnrDbMin: 10,
    noiseSigmaKmh: 0.15,
    vibrationNoiseKmhPerSeverity: 0.4,
    emiNoiseFloorDbPerSeverity: 8,
    intervalMinKmh: 20,
    intervalMaxKmh: 180,
    calibrationFactor: 1,
    oscillatorTcPpmPerDegC: 0.05,
    oscillatorBiasPpm: 0,
    oscillatorDriftPpmPerDay: 0,
    referenceTempDegC: 20,
    warmUpTauS: 30,
    misalignmentDeg: 0,
    emiFaultSeverity: 3,
    oscillatorFaultLimitPpm: 1e3
  },
  world: {
    target: { speedKmh: 50, rangeM: 120, angleDeg: 12, rcsM2: 5 }
  }
};
var DEFAULT_WORLD = {
  target: { speedKmh: 50, rangeM: 120, angleDeg: 12, rcsM2: 5 },
  rainRateMmH: 0,
  vibrationSeverity: 0,
  emiSeverity: 0,
  interference: void 0
};
function initialWorld(def) {
  const w = def.world ?? {};
  return {
    target: { ...DEFAULT_WORLD.target, ...w.target },
    rainRateMmH: w.rainRateMmH ?? DEFAULT_WORLD.rainRateMmH,
    vibrationSeverity: w.vibrationSeverity ?? DEFAULT_WORLD.vibrationSeverity,
    emiSeverity: w.emiSeverity ?? DEFAULT_WORLD.emiSeverity,
    interference: w.interference ? { ...w.interference } : void 0
  };
}
var RadarSpeedMeter = class {
  #def;
  #params;
  // own copy — world retunes must never mutate the shared definition record
  #clock;
  #normal;
  #env = { ...REFERENCE_ENVIRONMENT };
  #world;
  #poweredAt = 0;
  #state = "warming";
  #faultLatched = false;
  #held = qty(0, "km/h");
  #misalignmentDeg;
  #profile;
  #lastReading = null;
  constructor(def, clock, rng) {
    this.#def = def;
    this.#params = { ...def.parameters };
    this.#clock = clock;
    this.#normal = normal(rng);
    this.#world = initialWorld(def);
    this.#misalignmentDeg = def.parameters.misalignmentDeg;
    this.#poweredAt = clock.now();
    clock.onAdvance((dt) => this.#tick(dt));
  }
  #tick(_dt) {
    if (this.#state === "warming" && this.#clock.now() - this.#poweredAt >= 5 * this.#params.warmUpTauS) this.#state = "ready";
  }
  // ── the signal chain ────────────────────────────────────────────
  /** One reading through the full stage set (reality side). */
  #read() {
    if (this.#state !== "ready") {
      return { valid: false, reason: "warming", indicatedKmh: this.#held.value, highResKmh: 0, snrDb: 0, source: "none" };
    }
    const p = this.#params;
    const ageDays = (this.#clock.now() - this.#poweredAt) / 86400;
    const errPpm = oscillatorErrorPpm(p, this.#env.temperatureDegC, ageDays);
    const fActual = actualCarrierHz(p.carrierHz, errPpm);
    const t = this.#world.target;
    const lines = [];
    const echo = reflect({ ...t, angleDeg: t.angleDeg + this.#misalignmentDeg }, fActual, this.#world.rainRateMmH, p);
    lines.push({ ...echo, source: "target" });
    const src = this.#world.interference;
    if (src) {
      const ghost = reflect(
        { speedKmh: src.apparentSpeedKmh, rangeM: src.rangeM, angleDeg: t.angleDeg + this.#misalignmentDeg, rcsM2: src.rcsM2 },
        fActual,
        this.#world.rainRateMmH,
        p
      );
      lines.push({ ...ghost, source: "interference" });
    }
    if (this.#world.emiSeverity >= p.emiFaultSeverity) {
      this.#faultLatched = true;
      return { valid: false, reason: "fault", indicatedKmh: this.#held.value, highResKmh: 0, snrDb: 0, source: "none" };
    }
    const est = estimate(lines, p, this.#world, this.#normal);
    if (!est.detected) {
      return { valid: false, reason: "no-detection", indicatedKmh: this.#held.value, highResKmh: 0, snrDb: 0, source: "none" };
    }
    const cond = conditionReading(est.speedKmh, p);
    if (!cond.inInterval) {
      return { valid: false, reason: "outside-interval", indicatedKmh: this.#held.value, highResKmh: est.speedKmh, snrDb: est.snrDb, source: est.source };
    }
    return { valid: true, reason: "ok", indicatedKmh: cond.indicatedKmh, highResKmh: est.speedKmh, snrDb: est.snrDb, source: est.source };
  }
  // ── the TwinInstrumentView seam (the instrument's legal view) ────
  indication() {
    if (this.#faultLatched) return this.#held;
    const r = this.#read();
    this.#lastReading = r;
    if (r.valid) this.#held = qty(r.indicatedKmh, "km/h");
    return this.#held;
  }
  servedAt() {
    return this.#clock.now();
  }
  operationalState() {
    if (this.#faultLatched) return "fault";
    return this.#state;
  }
  environment() {
    return { ...this.#env };
  }
  // ── the /world actuation (never reachable from /twin) ───────────
  setEnvironment(e) {
    this.#env = { ...this.#env, ...e };
  }
  setTarget(t) {
    this.#world.target = { ...this.#world.target, ...t };
  }
  setRain(rateMmH) {
    if (!(rateMmH >= 0)) throw new Error(`rain rate must be \u2265 0, got ${rateMmH}`);
    this.#world.rainRateMmH = rateMmH;
  }
  setVibration(severity) {
    if (!(severity >= 0)) throw new Error(`vibration severity must be \u2265 0, got ${severity}`);
    this.#world.vibrationSeverity = severity;
  }
  setEmi(severity) {
    if (!(severity >= 0)) throw new Error(`EMI severity must be \u2265 0, got ${severity}`);
    this.#world.emiSeverity = severity;
  }
  /** Fault knob: retune the oscillator live (temperature coefficient,
   *  bias, ageing) — the drift error realizes through stages (a)→(b). */
  setOscillatorDrift(knobs) {
    if (knobs.tcPpmPerDegC !== void 0) this.#params.oscillatorTcPpmPerDegC = knobs.tcPpmPerDegC;
    if (knobs.biasPpm !== void 0) this.#params.oscillatorBiasPpm = knobs.biasPpm;
    if (knobs.driftPpmPerDay !== void 0) this.#params.oscillatorDriftPpmPerDay = knobs.driftPpmPerDay;
  }
  /** Fault knob: tilt the antenna (deg) — the cosine error realizes
   *  through stages (a)→(b); the meter under-reads. */
  setAntennaMisalignment(angleDeg) {
    this.#misalignmentDeg = angleDeg;
  }
  /** Fault/disturbance knob: an in-beam interference source. */
  setInterferenceSource(src) {
    this.#world.interference = { ...src };
  }
  clearInterferenceSource() {
    this.#world.interference = void 0;
  }
  /** The target-driving helper: script the vehicle's speed profile. */
  driveProfile(keyframes) {
    this.#profile?.stop();
    this.#profile = new SpeedProfilePlayer(keyframes);
    this.#profile.start(this.#clock, (kmh) => {
      this.#world.target.speedKmh = kmh;
    });
  }
  stopProfile() {
    this.#profile?.stop();
    this.#profile = void 0;
  }
  injectFault() {
    this.#faultLatched = true;
  }
  clearFault() {
    this.#faultLatched = false;
  }
  get faultLatched() {
    return this.#faultLatched;
  }
  /** The instrument-legal self-test (invoked from /twin only): the
   *  diagnostics check the oscillator against its lock bound — a
   *  drifting/biased oscillator beyond the declared limit trips the
   *  fault latch (the self_test behavior's legal outcome, realized
   *  from the physics). */
  selfTest() {
    const ageDays = (this.#clock.now() - this.#poweredAt) / 86400;
    const errPpm = oscillatorErrorPpm(this.#params, this.#env.temperatureDegC, ageDays);
    if (Math.abs(errPpm) > this.#params.oscillatorFaultLimitPpm) this.#faultLatched = true;
  }
  groundTruth() {
    const p = this.#params;
    const ageDays = (this.#clock.now() - this.#poweredAt) / 86400;
    const errPpm = oscillatorErrorPpm(p, this.#env.temperatureDegC, ageDays);
    return {
      clockS: this.#clock.now(),
      environment: { ...this.#env },
      target: { ...this.#world.target },
      rainRateMmH: this.#world.rainRateMmH,
      vibrationSeverity: this.#world.vibrationSeverity,
      emiSeverity: this.#world.emiSeverity,
      interference: this.#world.interference ? { ...this.#world.interference } : null,
      oscillatorErrorPpm: errPpm,
      carrierActualHz: actualCarrierHz(p.carrierHz, errPpm),
      lastReading: this.#lastReading
    };
  }
  reset() {
    this.#profile?.stop();
    this.#profile = void 0;
    this.#world = initialWorld(this.#def);
    this.#env = { ...REFERENCE_ENVIRONMENT };
    this.#misalignmentDeg = this.#def.parameters.misalignmentDeg;
    this.#params = { ...this.#def.parameters };
    this.#poweredAt = this.#clock.now();
    this.#state = "warming";
    this.#faultLatched = false;
    this.#held = qty(0, "km/h");
    this.#lastReading = null;
  }
};

// packages/r91/src/scenarios.ts
var GOOD = R91_GOOD.parameters;
var R91_SCENARIOS = {
  "good-radar": {
    ...R91_GOOD,
    name: "good-radar",
    description: "The reference radar: stationary Doppler, 20\u2013180 km/h (R 91-1, 6.1), the 6.4 stationary MPE (\xB13 km/h \u2264 100, \xB13 % above) \u2014 all coefficients inside R 91 limits."
  },
  "angle-misaligned": {
    id: "r91-ref-misaligned",
    name: "angle-misaligned",
    description: "Antenna tilted 8\xB0 off its declared installation angle \u2014 the cosine error: the meter UNDER-reads by cos(20\xB0)/cos(12\xB0) \u2248 \u22124 %.",
    parameters: { ...GOOD, misalignmentDeg: 8 },
    world: { target: { speedKmh: 50, rangeM: 120, angleDeg: 12, rcsM2: 5 } }
  },
  "temperature-drifting": {
    id: "r91-ref-tempdrift",
    name: "temperature-drifting",
    description: "A faulty oscillator: 200 ppm/\xB0C temperature coefficient \u2014 the Doppler shift scales at the source and every speed reads fractionally high/low with temperature.",
    parameters: { ...GOOD, oscillatorTcPpmPerDegC: 200 },
    world: { target: { speedKmh: 50, rangeM: 120, angleDeg: 12, rcsM2: 5 } }
  },
  "interference-present": {
    id: "r91-ref-interference",
    name: "interference-present",
    description: "Honest meter, hostile bench: an in-beam interference source (apparent 45 km/h, a stronger return than the target) captures the strongest-in-beam discriminator.",
    parameters: { ...GOOD },
    world: {
      target: { speedKmh: 50, rangeM: 120, angleDeg: 12, rcsM2: 5 },
      interference: { apparentSpeedKmh: 45, rcsM2: 12, rangeM: 80 }
    }
  }
};
function getR91Scenario(name) {
  const s = R91_SCENARIOS[name];
  if (!s) throw new Error(`unknown scenario '${name}' (known: ${Object.keys(R91_SCENARIOS).join(", ")})`);
  return s;
}

// packages/instances/acme-rs180/src/behavior.ts
var create = (def, clock, seed) => {
  const scenario = getR91Scenario("good-radar");
  const inst = new RadarSpeedMeter(
    { ...scenario, id: def.id },
    clock,
    seedMulberry(seed)
  );
  return inst;
};
var handlers = {
  setTarget: (ctx, a) => {
    ctx.instrument.setTarget(a.speedKmh, a.rangeM ?? 100, a.angleDeg ?? 20);
  },
  clearTarget: (ctx) => {
    ctx.instrument.clearTarget();
  },
  setRain: (ctx, a) => {
    ctx.instrument.setRain(a.rateMmH);
  },
  setVibration: (ctx, a) => {
    ctx.instrument.setVibration(a.severity);
  },
  setEmi: (ctx, a) => {
    ctx.instrument.setEmi(a.severity);
  },
  setOscillatorDrift: (ctx, a) => {
    ctx.instrument.setOscillatorDrift(a.ppm);
  },
  setAntennaMisalignment: (ctx, a) => {
    ctx.instrument.setAntennaMisalignment(a.degrees);
  },
  setInterferenceSource: (ctx, a) => {
    ctx.instrument.setInterferenceSource(a.band, a.powerDbm);
  },
  clearInterferenceSource: (ctx) => {
    ctx.instrument.clearInterferenceSource();
  },
  driveProfile: (ctx, a) => {
    ctx.instrument.driveProfile(a.profileId);
  },
  stopProfile: (ctx) => {
    ctx.instrument.stopProfile();
  }
};
var behavior_default = { create, handlers };
function seedMulberry(seed) {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export {
  create,
  behavior_default as default,
  handlers
};
