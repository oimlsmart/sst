// packages/md/src/instrument.ts
import { qty } from "@primmel/sst-runtime/physics/quantity";
import { normal } from "@primmel/sst-runtime/physics/rng";
import { REFERENCE_ENVIRONMENT } from "@primmel/sst-runtime/instrument";

// packages/md/src/physics/geometry.ts
function enclosingBoxCm(spec) {
  return {
    l: spec.lengthCm + (spec.shape === "irregular" ? spec.protrusionCm : 0),
    w: spec.widthCm,
    h: spec.heightCm
  };
}
function validateObjectSpec(spec) {
  if (!(spec.lengthCm > 0)) throw new Error(`object length must be > 0, got ${spec.lengthCm}`);
  if (!(spec.widthCm > 0)) throw new Error(`object width must be > 0, got ${spec.widthCm}`);
  if (!(spec.heightCm > 0)) throw new Error(`object height must be > 0, got ${spec.heightCm}`);
  if (spec.shape !== "rectangular" && spec.shape !== "irregular") throw new Error(`object shape must be rectangular|irregular, got '${spec.shape}'`);
  if (!(spec.reflectance > 0 && spec.reflectance <= 1)) throw new Error(`object reflectance must be in (0, 1], got ${spec.reflectance}`);
  if (!(spec.protrusionCm >= 0)) throw new Error(`object protrusion must be \u2265 0, got ${spec.protrusionCm}`);
  if (spec.shape === "rectangular" && spec.protrusionCm > 0) throw new Error("a rectangular object carries no protrusion (protrusionCm must be 0)");
}
function beginTraversal(spec, atS) {
  validateObjectSpec(spec);
  return { spec: { ...spec }, positionM: 0, lengthM: enclosingBoxCm(spec).l / 100, entryS: atS };
}
function advanceTraversal(t, speedMS, dt) {
  t.positionM += speedMS * dt;
}
function traversalComplete(t) {
  return t.positionM >= t.lengthM;
}

// packages/md/src/physics/scanning.ts
function alongTrackResolutionCm(speedMS, p) {
  return speedMS * 100 / p.scanRateHz;
}
function edgeSigmaCm(reflectance, p) {
  return p.edgeSigmaRefCm * Math.sqrt(p.reflectanceRef / reflectance);
}
function widthSigmaCm(reflectance, p) {
  return p.widthSigmaRefCm * Math.sqrt(p.reflectanceRef / reflectance);
}
function heightSigmaCm(reflectance, ambientLx, p) {
  const ambient = Math.sqrt(1 + p.ambientNoiseGain * (ambientLx / p.ambientLxRef));
  return p.heightSigmaRefCm * Math.sqrt(p.reflectanceRef / reflectance) * ambient;
}
function thermalSpanFrac(temperatureDegC, residualFrac, p) {
  return p.frameAlphaFracPerDegC * (temperatureDegC - p.referenceTempDegC) + residualFrac;
}
function scanObject(spec, inputs, p, normal2) {
  const box = enclosingBoxCm(spec);
  const resolutionCm = alongTrackResolutionCm(inputs.conveyorSpeedMS, p);
  const quantizationCm = normal2() * 0.577 * (resolutionCm / 2);
  const sEdge = edgeSigmaCm(spec.reflectance, p);
  const sWidth = widthSigmaCm(spec.reflectance, p);
  const sHeight = heightSigmaCm(spec.reflectance, inputs.ambientLx, p);
  const span = 1 + thermalSpanFrac(inputs.temperatureDegC, inputs.thermalResidualFrac, p);
  const tilt = inputs.scannerTiltDeg * Math.PI / 180;
  const protrusionMissed = spec.shape === "irregular" && spec.protrusionCm > 0 && spec.protrusionCm < resolutionCm;
  const lengthCm = (box.l + quantizationCm + normal2() * sEdge - (protrusionMissed ? spec.protrusionCm : 0)) * span * (1 + inputs.encoderSlipFrac);
  const widthCm = (box.w + normal2() * sWidth + box.h * Math.tan(tilt)) * span;
  const heightCm = (box.h + normal2() * sHeight + box.h * (1 / Math.cos(tilt) - 1)) * span;
  return { lengthCm, widthCm, heightCm, protrusionMissed, quantizationCm, sigmas: { edgeCm: sEdge, widthCm: sWidth, heightCm: sHeight } };
}

// packages/md/src/physics/computation.ts
function roundToScale(x, d) {
  return Math.sign(x) * Math.round(Math.abs(x) / d) * d;
}
function computeMeasurement(raw, p) {
  const l = roundToScale(raw.lengthCm, p.scaleIntervalCm);
  const w = roundToScale(raw.widthCm, p.scaleIntervalCm);
  const h = roundToScale(raw.heightCm, p.scaleIntervalCm);
  const margin = 9 * p.scaleIntervalCm;
  const below = l < p.minDimCm || w < p.minDimCm || h < p.minDimCm;
  const beyond = l > p.maxLCm + margin || w > p.maxWCm + margin || h > p.maxHCm + margin;
  const valid = !below && !beyond;
  const reason = below ? "below-min" : beyond ? "beyond-max" : "ok";
  return {
    valid,
    reason,
    indicatedLengthCm: valid ? l : 0,
    indicatedWidthCm: valid ? w : 0,
    indicatedHeightCm: valid ? h : 0,
    dimVolumeCm3: valid ? l * w * h : 0,
    dimWeightKg: valid ? l * w * h / p.convFactorCm3PerKg : 0
  };
}

// packages/md/src/driver.ts
function validateFeedKeyframes(keyframes) {
  if (keyframes.length === 0) throw new Error("driveFeed requires at least one keyframe");
  let prev = -Infinity;
  for (const [i, k] of keyframes.entries()) {
    if (!(k.atS >= 0)) throw new Error(`driveFeed keyframe ${i}: atS must be \u2265 0, got ${k.atS}`);
    if (k.atS < prev) throw new Error(`driveFeed keyframe ${i}: atS must be non-decreasing`);
    validateObjectSpec(k.object);
    prev = k.atS;
  }
}
var ObjectFeedPlayer = class {
  #keyframes;
  #off;
  constructor(keyframes) {
    validateFeedKeyframes(keyframes);
    this.#keyframes = keyframes.map((k) => ({ atS: k.atS, object: { ...k.object } }));
  }
  start(clock, feed) {
    let programT = 0;
    let next = 0;
    const pump = () => {
      while (next < this.#keyframes.length && programT >= this.#keyframes[next].atS) {
        if (!feed(this.#keyframes[next].object)) return;
        next++;
      }
    };
    pump();
    this.#off = clock.onAdvance((dt) => {
      programT += dt;
      pump();
    });
  }
  stop() {
    this.#off?.();
    this.#off = void 0;
  }
};

// packages/md/src/instrument.ts
var MD350_GOOD = {
  id: "md350-ref-good",
  parameters: {
    scaleIntervalCm: 0.5,
    minDimCm: 5,
    maxLCm: 250,
    maxWCm: 120,
    maxHCm: 180,
    convFactorCm3PerKg: 5e3,
    vMinMS: 0.1,
    vMaxMS: 1.5,
    scanRateHz: 200,
    edgeSigmaRefCm: 0.03,
    widthSigmaRefCm: 0.03,
    heightSigmaRefCm: 0.03,
    reflectanceRef: 0.9,
    ambientLxRef: 100,
    ambientNoiseGain: 0.5,
    frameAlphaFracPerDegC: 23e-6,
    referenceTempDegC: 20,
    warmUpTauS: 60,
    emiFaultSeverity: 3,
    selfTestBoundCm: 0.4,
    refGaugeCm: 50,
    encoderSlipFrac: 0,
    scannerTiltDeg: 0,
    thermalResidualFrac: 0
  },
  world: { conveyorSpeedMS: 1 }
};
var DEFAULT_WORLD = {
  conveyorSpeedMS: 1,
  ambientLx: 100,
  emiSeverity: 0,
  beamOccluded: false
};
function initialWorld(def) {
  return { ...DEFAULT_WORLD, ...def.world };
}
var MultiDimensionalInstrument = class {
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
  #traversal;
  #disturbed = false;
  // occlusion/EMI seen mid-traversal (the checking facility's input)
  #held = { l: 0, w: 0, h: 0, dv: 0, dw: 0 };
  #lastReading = null;
  #feed;
  constructor(def, clock, rng) {
    this.#def = def;
    this.#params = { ...def.parameters };
    this.#clock = clock;
    this.#normal = normal(rng);
    this.#world = initialWorld(def);
    this.#poweredAt = clock.now();
    clock.onAdvance((dt) => this.#tick(dt));
  }
  #tick(dt) {
    if (this.#state === "warming" && this.#clock.now() - this.#poweredAt >= 5 * this.#params.warmUpTauS) this.#state = "ready";
    const t = this.#traversal;
    if (!t) return;
    advanceTraversal(t, this.#world.conveyorSpeedMS, dt);
    if (this.#world.beamOccluded || this.#world.emiSeverity >= this.#params.emiFaultSeverity) this.#disturbed = true;
    if (traversalComplete(t)) this.#complete(t);
  }
  /** The measurement completes: through the whole stage set (reality
   *  side). A disturbed traversal is a significant fault — the checking
   *  facility trips and the automatic instrument is made inoperative
   *  (R 129-1, 4.3.1/5.6.1). An out-of-limits result is NO fault: the
   *  indication is inhibited (5.2.6) and the last valid reading holds. */
  #complete(t) {
    this.#traversal = void 0;
    this.#state = "ready";
    const p = this.#params;
    if (this.#disturbed) {
      const reason = this.#world.emiSeverity >= p.emiFaultSeverity ? "disturbance" : "occluded";
      this.#lastReading = {
        valid: false,
        reason,
        measuredLengthCm: 0,
        measuredWidthCm: 0,
        measuredHeightCm: 0,
        indicatedLengthCm: this.#held.l,
        indicatedWidthCm: this.#held.w,
        indicatedHeightCm: this.#held.h,
        dimVolumeCm3: this.#held.dv,
        dimWeightKg: this.#held.dw,
        protrusionMissed: false,
        quantizationCm: 0
      };
      this.#disturbed = false;
      this.#faultLatched = true;
      return;
    }
    const raw = scanObject(t.spec, {
      conveyorSpeedMS: this.#world.conveyorSpeedMS,
      ambientLx: this.#world.ambientLx,
      temperatureDegC: this.#env.temperatureDegC,
      encoderSlipFrac: p.encoderSlipFrac,
      scannerTiltDeg: p.scannerTiltDeg,
      thermalResidualFrac: p.thermalResidualFrac
    }, p, this.#normal);
    const c = computeMeasurement(raw, p);
    this.#lastReading = {
      valid: c.valid,
      reason: c.reason,
      measuredLengthCm: raw.lengthCm,
      measuredWidthCm: raw.widthCm,
      measuredHeightCm: raw.heightCm,
      indicatedLengthCm: c.valid ? c.indicatedLengthCm : this.#held.l,
      indicatedWidthCm: c.valid ? c.indicatedWidthCm : this.#held.w,
      indicatedHeightCm: c.valid ? c.indicatedHeightCm : this.#held.h,
      dimVolumeCm3: c.valid ? c.dimVolumeCm3 : this.#held.dv,
      dimWeightKg: c.valid ? c.dimWeightKg : this.#held.dw,
      protrusionMissed: raw.protrusionMissed,
      quantizationCm: raw.quantizationCm
    };
    if (c.valid) {
      this.#held = {
        l: c.indicatedLengthCm,
        w: c.indicatedWidthCm,
        h: c.indicatedHeightCm,
        dv: c.dimVolumeCm3,
        dw: c.dimWeightKg
      };
    }
  }
  // ── the TwinInstrumentView seam (the instrument's legal view) ────
  /** The core-seam indication: the held length reading, SI (the family
   *  contract serves per-axis registers — never this aggregate). */
  indication() {
    return qty(this.#held.l / 100, "m");
  }
  /** The held per-axis indications (cm, rounded to d). */
  dimensionsCm() {
    return { lengthCm: this.#held.l, widthCm: this.#held.w, heightCm: this.#held.h };
  }
  volumeCm3() {
    return this.#held.dv;
  }
  dimWeightKg() {
    return this.#held.dw;
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
  setConveyorSpeed(speedMS) {
    if (!(speedMS > 0 && speedMS <= 3)) throw new Error(`conveyor speed must be in (0, 3] m/s, got ${speedMS}`);
    this.#world.conveyorSpeedMS = speedMS;
  }
  /** Feed one object onto the conveyor (the frame takes one at a time —
   *  the bench idiom). */
  feedObject(spec) {
    validateObjectSpec(spec);
    if (this.#traversal) throw new Error("an object is already in the measuring frame \u2014 wait for the traversal or clearObject");
    if (this.#state === "warming") throw new Error("the instrument is still warming up \u2014 no measurement before ready (R 129-1, 5.1.7)");
    this.#traversal = beginTraversal(spec, this.#clock.now());
    this.#disturbed = this.#world.beamOccluded || this.#world.emiSeverity >= this.#params.emiFaultSeverity;
    this.#state = "measuring";
  }
  clearObject() {
    this.#traversal = void 0;
    this.#disturbed = false;
    if (this.#state === "measuring") this.#state = "ready";
  }
  setAmbientLight(lx) {
    if (!(lx >= 0)) throw new Error(`ambient light must be \u2265 0, got ${lx}`);
    this.#world.ambientLx = lx;
  }
  setEmi(severity) {
    if (!(severity >= 0)) throw new Error(`EMI severity must be \u2265 0, got ${severity}`);
    this.#world.emiSeverity = severity;
  }
  setBeamOccluded(occluded) {
    this.#world.beamOccluded = occluded;
  }
  /** Fault knob: belt-encoder slip (fraction) — the length scales. */
  setEncoderSlip(frac) {
    if (!(Math.abs(frac) <= 0.05)) throw new Error(`encoder slip must be within \xB15 %, got ${frac}`);
    this.#params.encoderSlipFrac = frac;
  }
  /** Fault knob: tilt the scan head (deg) — width/height bias with the
   *  object height. */
  setScannerTilt(tiltDeg) {
    if (!(Math.abs(tiltDeg) <= 10)) throw new Error(`scanner tilt must be within \xB110\xB0, got ${tiltDeg}`);
    this.#params.scannerTiltDeg = tiltDeg;
  }
  /** Fault knob: the post-temperature-cycle residual span error
   *  (fraction) — the configurable post-cycle difference (the standing
   *  sim doctrine). */
  setThermalResidual(frac) {
    if (!(Math.abs(frac) <= 0.05)) throw new Error(`thermal residual must be within \xB15 %, got ${frac}`);
    this.#params.thermalResidualFrac = frac;
  }
  /** The object-feed driver: script the parcel flow over the virtual
   *  clock (a keyframe defers while the frame is occupied). */
  driveFeed(keyframes) {
    this.#feed?.stop();
    this.#feed = new ObjectFeedPlayer(keyframes);
    this.#feed.start(this.#clock, (spec) => {
      if (this.#traversal || this.#state === "warming") return false;
      this.feedObject(spec);
      return true;
    });
  }
  stopFeed() {
    this.#feed?.stop();
    this.#feed = void 0;
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
   *  checking facility measures the internal reference gauge through
   *  the CURRENT systematics (encoder slip, scanner tilt, the thermal
   *  span error) — beyond the declared bound the fault latch trips
   *  (R 129-1, 5.6.1: made inoperative automatically). */
  selfTest() {
    const p = this.#params;
    const span = 1 + thermalSpanFrac(this.#env.temperatureDegC, p.thermalResidualFrac, p);
    const measured = p.refGaugeCm * span * (1 + p.encoderSlipFrac);
    if (Math.abs(measured - p.refGaugeCm) > p.selfTestBoundCm) this.#faultLatched = true;
  }
  groundTruth() {
    const t = this.#traversal;
    return {
      clockS: this.#clock.now(),
      environment: { ...this.#env },
      conveyorSpeedMS: this.#world.conveyorSpeedMS,
      object: t ? { ...t.spec, positionM: t.positionM } : null,
      ambientLx: this.#world.ambientLx,
      emiSeverity: this.#world.emiSeverity,
      beamOccluded: this.#world.beamOccluded,
      encoderSlipFrac: this.#params.encoderSlipFrac,
      scannerTiltDeg: this.#params.scannerTiltDeg,
      thermalResidualFrac: this.#params.thermalResidualFrac,
      thermalSpanFrac: thermalSpanFrac(this.#env.temperatureDegC, this.#params.thermalResidualFrac, this.#params),
      lastReading: this.#lastReading
    };
  }
  reset() {
    this.#feed?.stop();
    this.#feed = void 0;
    this.#world = initialWorld(this.#def);
    this.#env = { ...REFERENCE_ENVIRONMENT };
    this.#params = { ...this.#def.parameters };
    this.#traversal = void 0;
    this.#disturbed = false;
    this.#poweredAt = this.#clock.now();
    this.#state = "warming";
    this.#faultLatched = false;
    this.#held = { l: 0, w: 0, h: 0, dv: 0, dw: 0 };
    this.#lastReading = null;
  }
};

// packages/md/src/scenarios.ts
var GOOD = MD350_GOOD.parameters;
var MD_SCENARIOS = {
  "good-dimensioner": {
    ...MD350_GOOD,
    name: "good-dimensioner",
    description: "The reference dimensioner: optical light-section, automatic, d = 0.5 cm, V_min\u2026V_max 0.1\u20131.5 m/s, the per-axis MPE \xB11.0 d (R 129-1, 4.1.2) \u2014 all coefficients inside R 129 limits."
  },
  "dark-objects": {
    id: "md350-ref-dark",
    name: "dark-objects",
    description: "The scanner's dark-surface noise is excessive (\u03C3 at the reference reflectance \xD75): matt-black parcels blow past \xB11 d while white ones pass \u2014 the A.3 surface-characteristics failure. Feed a dark object (reflectance \u2248 0.05) to see it.",
    parameters: { ...GOOD, edgeSigmaRefCm: 0.15, widthSigmaRefCm: 0.15, heightSigmaRefCm: 0.12 },
    world: { conveyorSpeedMS: 1 }
  },
  "high-ambient-light": {
    id: "md350-ref-lux",
    name: "high-ambient-light",
    description: "Inadequate ambient-light suppression (the ambient shot-noise gain \xD712): the height channel drifts past \xB11 d as the hall lighting climbs toward the A.4.1 upper level (1500 lx). The bench boots at 1500 lx.",
    parameters: { ...GOOD, ambientNoiseGain: 6 },
    world: { conveyorSpeedMS: 1, ambientLx: 1500 }
  },
  "slow-scanner": {
    id: "md350-ref-slow",
    name: "slow-scanner",
    description: "A 50 Hz frame rate: along-track quantization \xB11.5 cm at V_max (3 d) \u2014 passes at V_min, fails at V_max, exactly the Annex A speed-of-movement test's prey. Sweep the conveyor speed to see the error grow.",
    parameters: { ...GOOD, scanRateHz: 50 },
    world: { conveyorSpeedMS: 1 }
  },
  "thermally-cycled": {
    id: "md350-ref-thermal",
    name: "thermally-cycled",
    description: "A frame that keeps a 1.5 % residual span error after a temperature cycle (the configurable post-cycle difference): small boxes still pass, a 50 cm box fails \xB11 d \u2014 the static-temperatures failure.",
    parameters: { ...GOOD, thermalResidualFrac: 0.015 },
    world: { conveyorSpeedMS: 1 }
  }
};
function getMdScenario(name) {
  const s = MD_SCENARIOS[name];
  if (!s) throw new Error(`unknown scenario '${name}' (known: ${Object.keys(MD_SCENARIOS).join(", ")})`);
  return s;
}

// packages/instances/acme-md3xx/src/behavior.ts
var create = (def, clock, seed) => {
  const scenario = getMdScenario("good-dimensioner");
  const inst = new MultiDimensionalInstrument(
    { ...scenario, id: def.id },
    clock,
    seedMulberry(seed)
  );
  return inst;
};
var handlers = {
  setConveyorSpeed: (ctx, a) => {
    ctx.instrument.setConveyorSpeed(a.speedMS);
  },
  feedObject: (ctx, a) => {
    ctx.instrument.feedObject(a.lengthCm ?? 60, a.widthCm ?? 40, a.heightCm ?? 30);
  },
  clearObject: (ctx) => {
    ctx.instrument.clearObject();
  },
  setAmbientLight: (ctx, a) => {
    ctx.instrument.setAmbientLight(a.lux);
  },
  setEmi: (ctx, a) => {
    ctx.instrument.setEmi(a.severity);
  },
  setBeamOccluded: (ctx, a) => {
    ctx.instrument.setBeamOccluded(a.occluded);
  },
  setEncoderSlip: (ctx, a) => {
    ctx.instrument.setEncoderSlip(a.fraction);
  },
  setScannerTilt: (ctx, a) => {
    ctx.instrument.setScannerTilt(a.degrees);
  },
  setThermalResidual: (ctx, a) => {
    ctx.instrument.setThermalResidual(a.fraction);
  },
  driveFeed: (ctx, a) => {
    ctx.instrument.driveFeed(a.profileId);
  },
  stopFeed: (ctx) => {
    ctx.instrument.stopFeed();
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
