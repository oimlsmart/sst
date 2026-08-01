// ACME CGM-200 sampling line — 3D interactivity bindings.
//
// Minimal for v1: the bench's kind-driven HUD renders the sampling
// line's registers from bench.yaml. Future versions bind the probe,
// pump, and filter affordances to the world mutations (drag a wrench
// onto the filter to clog it; click the pump to toggle it on/off).

export const scene = {
  bind(_gltf, _ctx) {
    return () => {}
  },
}

export default scene
