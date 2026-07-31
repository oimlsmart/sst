# TODO 12 — TwinDriver + WorldDriver + SceneContext

**Priority:** P0   **Status:** ✅ done   **Blocks:** TODO 03, 05   **Blocked by:** TODO 02

## Goal

Close the model-driven loop on the client side. The platform already generates the server-side twin schema from the `TwinContract`; this workstream adds the **client-side twin driver** (TwinDriver), the **client-side world driver** (WorldDriver), and the **SceneContext** that the instance's `scene.ts` receives — the typed binding protocol for two-way 3D interactivity.

These three together replace every raw-GraphQL-string call site in the bench, the per-family tests, the console, and (eventually) the SMART app's gateway connector.

## Deliverables

### Runtime modules (`packages/runtime/sst-runtime/src/`)

- `twin/types.ts` — `ServedQuantity`, `Environment`, `OpResult`, `DriverOpts`. ✅ done (scaffold).
- `twin/transport.ts` — the shared `gql()` POST + `subscribe()` SSE transport (used by both drivers). ✅ done (scaffold).
- `twin/freshness.ts` — `checkFreshness()` helper. ✅ done (scaffold).
- `twin/driver.ts` — `createTwinDriver<C>(contract, url, opts?)` + `TwinDriver` interface. ✅ done (scaffold).
- `world/types.ts` — `WorldState`, `ScenarioInfo`, `ProfileInfo`. ✅ done (scaffold).
- `world/driver.ts` — `createWorldDriver(url, opts?, kindMutations?)` + `WorldDriver` interface (base mutations + base reads + kind-specific mutations). ✅ done (scaffold).
- `scene/context.ts` — `createSceneContext<I>()` + `SceneContext<I>` interface. ✅ done (scaffold).
- `scene/gltf.ts` — `GltfScene` interface + `NULL_GLTF_SCENE` test stub. ✅ done (scaffold).

### Specs

- `specs/10-twin-driver.md` — the formal TwinDriver + WorldDriver spec. ✅ done.
- `specs/11-scene-context.md` — the formal SceneContext + scene binding spec. ✅ done.

### Instance-side work

- Update `packages/kinds/sst-r60/interface.d.ts` to declare `R60Scene` + `R60Instance` (combined behavior + scene shape).
- Update `packages/instances/acme-lc500/src/scene.ts` — author the LC-500's 3D interactivity binding (drag calibration mass → placeLoad; click zero button → runSelfTest; drag temp dial → setEnvironment).
- Update `packages/instances/acme-lc500/behavior.js` to export `{ behavior, scene }` (the bundled default).
- Update `packages/instances/acme-lc500/src/behavior.ts` to import + re-export the scene.
- Mirror the interface + scene additions in the sibling kind packages (sst-r91, sst-r129, sst-r144) and their instance stubs.

### Migration of existing call sites

- `packages/lc500/bench/src/api.ts` — replace hand-rolled `gql()` with `createTwinDriver` + `createWorldDriver`.
- `packages/lc500/src/bin.test.ts`, `packages/gas-analyzer/src/bin.test.ts`, `packages/r91/src/bin.test.ts`, `packages/md/src/bin.test.ts` — replace per-file `gql()` with the shared driver.
- `packages/core/src/console/client.ts` — back `show indication` with `driver.indication()` instead of raw query.
- The SMART app's `browser/src/gateway/connectors.ts` — adopt the driver as the canonical twin-client surface (replaces `unwrapGraphqlData`).

### Tests (`packages/runtime/sst-runtime/tests/`)

- `twin-driver.test.ts` — boot a session, call every read/subscribe/invoke method, assert responses.
- `world-driver.test.ts` — call every base mutation + kind mutation, assert state changes.
- `freshness.test.ts` — set `onStale: 'throw'`; serve a stale value; expect throw.
- `scene-binding.test.ts` — boot an instance with a stub `GltfScene`; verify `scene.bind()` registers the right handlers; simulate a drag event; verify the world mutation was called.

## Steps

1. ✅ Author the runtime modules (scaffold).
2. ✅ Author the specs.
3. ✅ Update the R 60 kind's `interface.d.ts` to add `R60Scene` + `R60Instance`.
4. ✅ Author the ACME LC-500 `src/scene.ts`.
5. ✅ Migrate the bench's `api.ts` to the driver.
6. ✅ Migrate the per-family `bin.test.ts` files.
7. ✅ Author the runtime tests.
8. ✅ Mirror the interface + scene additions in sibling kinds (sst-r91, sst-r129, sst-r144).
9. ✅ Mirror the scene.ts additions in sibling instances (acme-rs180, acme-md3xx, acme-cgm-200) once their behavior.ts files land in TODO 07.

## Acceptance criteria

- `TwinDriver<C>` exposes typed methods per the contract's serves + operations; calling a non-existent method fails at compile time (after TODO 02 full) or runtime (scaffold).
- `WorldDriver` exposes every base mutation + every kind mutation.
- `SceneContext` carries `{ instrument, twin, world, clock }` and is constructed at session boot.
- The instance's `scene.bind(gltf, ctx)` returns an unbind function; calling it drops all handlers.
- A drag event on the LC-500's weight node calls `ctx.world.placeLoad(40)`; an `isOver('pan')` failure calls `ctx.world.removeLoad()`.
- The 5+ duplicated `gql()` helpers across the bench + tests collapse to one (the driver's transport).
- `npm test` green across the runtime.

## Design notes

- **The driver is a runtime object, not a code generator.** Per-contract TypeScript types are TODO 02 full execution; the scaffold uses dynamic method injection. The API surface stays stable across the gap.
- **TwinDriver and WorldDriver are separate** to mirror the epistemic-wall topology. The SceneContext carries both; the instance's scene.ts decides which to call per gesture.
- **GltfScene is the renderer-abstraction seam.** Today WebGL2; tomorrow WebGPU or Three.js. Instance packages don't change.
- **No doubles in tests.** Use a stub `GltfScene` (`NULL_GLTF_SCENE`) and a real `TwinDriver` pointed at an in-process server. Per the global rule.

## Dependencies

- Requires TODO 02 (runtime) — the driver lives in the runtime package.
- Blocks TODO 03 (shell) — the shell's session view uses the driver to display state.
- Blocks TODO 05 (bench kind-driven) — the bench reads via the driver.
