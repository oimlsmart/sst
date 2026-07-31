// packages/instances/acme-cgm-200/src/behavior.ts
import { SimulatedGasAnalyzer, getGasScenario } from "@primmel/sst-runtime";
var create = (def, clock, seed) => {
  const scenario = getGasScenario("good-analyzer");
  const inst = new SimulatedGasAnalyzer(
    { ...scenario, id: def.id },
    clock,
    seed
  );
  return inst;
};
var handlers = {
  setGasConcentration: (ctx, a) => {
    ctx.instrument.setGasConcentration(a.component, a.ppm);
  },
  setNo2Fraction: (ctx, a) => {
    ctx.instrument.setNo2Fraction(a.fraction);
  },
  setInterferents: (ctx, a) => {
    ctx.instrument.setInterferents(a.interferent, a.ppm);
  },
  setSampleFlow: (ctx, a) => {
    ctx.instrument.setSampleFlow(a.lMin);
  },
  setOpticsContamination: (ctx, a) => {
    ctx.instrument.setOpticsContamination(a.fraction);
  },
  setSourceAgingRate: (ctx, a) => {
    ctx.instrument.setSourceAgingRate(a.perDay);
  },
  setSampleLineLeak: (ctx, a) => {
    ctx.instrument.setSampleLineLeak(a.fraction);
  },
  zeroCalibration: (ctx) => {
    ctx.instrument.zeroCalibration();
  },
  spanCalibration: (ctx, a) => {
    ctx.instrument.spanCalibration(a.spanGasPpm);
  },
  runSelfCheck: (ctx) => {
    ctx.instrument.runSelfCheck();
  }
};
var behavior_default = { create, handlers };
export {
  create,
  behavior_default as default,
  handlers
};
