# TODO 04 — glTF loader + BenchScene integration (Phase 5)

**Priority:** P1   **Status:** ✅ done   **Blocks:** nothing   **Blocked by:** TODO 02

## Goal

Replace `BenchScene.vue`'s inline procedural geometry (box + cylinder
primitives) with a minimal glTF 2.0 binary (`.glb`) loader. Each
instance package's `model.glb` becomes the bench's 3D scene; node
animations drive the cell compression, weight settle, etc. — the "3D
dynamic artifact" the user specified.

No Three.js. The loader writes directly to WebGL2 buffers and reuses
the existing two-light shader.

## Deliverables

### New package: `packages/runtime/sst-gltf/`

- `src/loader.ts` — `loadGltf(bytes: Uint8Array): GltfScene`
  - Parses the GLB container: 12-byte header + JSON chunk + BIN chunk.
  - Walks `asset`, `scene`, `scenes`, `nodes`, `meshes`, `materials`,
    `accessors`, `bufferViews`, `buffers`, `animations`.
  - Uploads `POSITION`/`NORMAL`/`indices` accessors to GL buffers.
  - Resolves the node graph (translation/rotation/scale per node).
  - Returns a `GltfScene` with drawable primitives + animation clips.
- `src/render.ts` — `renderScene(gl, scene, uniforms)`
  - Walks nodes; applies world transforms; draws each primitive.
  - Skins/morphs out of scope for v1.
- `src/animation.ts` — `playClip(scene, clip, time)`
  - Samples animation channels (translation/rotation/scale) at the
    given time; updates node local transforms.
- `src/types.ts` — glTF 2.0 TypeScript types (subset).

### Bench integration: `packages/instances/acme-lc500/bench/`

Wait — the bench today lives at `packages/lc500/bench/`. As part of
TODO 05 it moves to `packages/shell/sst-bench/` (the running-instrument
view). For Phase 5's purposes:

- Edit `BenchScene.vue`'s `mountBenchScene()` to call `loadGltf()` on
  the instance package's `model.glb` URL.
- Map the kind's `bench.yaml:scene_3d.deformations` rules onto glTF
  node names (e.g. "cell" → squash with strain, "weight" → visible
  when loaded).
- Fallback to procedural geometry if no model present (preserves
  today's behavior during the migration window).

### Placeholder model

- `packages/instances/acme-lc500/model.glb` — a minimal valid GLB
  containing a base plate + a column cell + a calibration-mass
  cylinder. Authored by exporting Blender's primitives or by a tiny
  generator script (`scripts/gen-placeholder-glb.ts`).

## Steps

1. Author `packages/runtime/sst-gltf/src/types.ts` from the glTF 2.0
   spec subset.
2. Author `loader.ts` — parse GLB container, walk accessors/buffers,
   upload to GL.
3. Author `render.ts` — node-graph walk, two-light shader reuse.
4. Author `animation.ts` — sampler interpolation for
   translation/rotation/scale channels.
5. Author the placeholder generator (or hand-build in Blender).
6. Wire `BenchScene.vue` to load + render + animate.
7. Test: load the placeholder GLB; verify the cell compresses with
   applied load; verify the weight appears.

## Acceptance criteria

- `primmel-sst run acme-lc500` → bench loads `model.glb` and renders
  the LC-500's cell + plate + weight.
- Placing a 40 kg load visibly compresses the cell node; the weight
  node appears on the pan.
- A glTF with an animation clip plays the clip in a loop.
- A malformed GLB produces a precise error (which accessor failed).
- The bench falls back to procedural geometry when no model is present.
- WebGL2 context loss is handled (re-upload buffers on restore).

## Design notes

- **Subset of glTF 2.0.** Supported: meshes with POSITION + NORMAL +
  indices, single base color material, node transforms (TRS), animation
  channels on TRS. **Out of scope:** PBR materials, textures, skins,
  morph targets, cameras, extensions. Adding any of these is a future
  TODO.
- **No Three.js.** Keeps the bundle small (~10 KB for the loader vs
  ~600 KB for Three.js) and the bench's raw-WebGL2 aesthetic intact.
- **Deformation mapping.** The kind's `bench.yaml` declares rules like
  `{ node_substring: "cell", squash_by: "1 - strain * 400" }`. The
  bench evaluates these as GLSL uniforms or as pre-render node
  transforms. v1 uses pre-render transforms (simpler); v2 could push
  to vertex shader.
- **Performance.** The GLB is parsed once on session boot; per-frame
  cost is just the node-graph walk + draw calls. A typical scene (< 50
  nodes) is well under 1 ms per frame on commodity hardware.
- **Animation clips** drive dynamic deformation (the cell breathing
  with creep, the weight settling). The bench plays them in sync with
  the virtual clock.

## Dependencies

- Requires TODO 02 (runtime) for the loaded-package shape that exposes
  the model URL.
- Pairs with TODO 05 (bench kind-driven) which generalizes the bench's
  hard-coded load-cell specifics.
