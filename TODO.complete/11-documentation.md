# TODO 11 — Documentation

**Priority:** P1   **Status:** ✅ done   **Blocks:** nothing   **Blocked by:** TODO 02, 08

## Goal

Comprehensive documentation: end-user, contributor, and architectural.
After Phases 2-9 land the platform, the docs make it usable and
extendable by people outside the inner circle.

## Deliverables

### End-user docs

- `docs/user/quickstart.md` — install, run, upload a package, take the
  tour. The 5-minute onboarding.
- `docs/user/upload-a-package.md` — the ZIP format, the manifest
  fields, common errors.
- `docs/user/tour.md` — the guided tour, narrated.

### Contributor docs

- `docs/dev/architecture.md` — the five-layer architecture, with
  diagrams. (Mirrors `specs/00-architecture.md` but more readable.)
- `docs/dev/add-a-kind.md` — step-by-step: authoring a new kind
  package. (Mirrors `specs/08-additive-extension.md`.)
- `docs/dev/add-an-instance.md` — step-by-step: authoring a new
  instance package.
- `docs/dev/author-3d-model.md` — Blender → glTF pipeline; node-naming
  conventions; deformation rules.
- `docs/dev/build-and-test.md` — local dev setup; running the test
  suite; debugging tips.

### OIML-domain docs

- `docs/domain/oiml-d11.md` — what D 11 condition classes are, why
  passive vs active matters, how severity levels map to physical
  phenomena.
- `docs/domain/oiml-r60.md` — load cell classification, MPE envelopes,
  the test program.
- (After Phase 8: parallel docs for R 91, R 129, R 144.)

### Top-level docs (updates to existing)

- `README.md` — quickstart with the new CLI; pointer to the gallery.
- `AGENTS.md` — the workspace map; the kind-registry pattern; the
  InstrumentKindDriver interface reference; the OCP/MECE/DRY
  principles applied.
- `CLAUDE.md` — updated for the SST architecture; pointer to the
  TODO.complete/ workstreams.
- `docs/2026-07-26-simulated-instruments-design.md` — addendum or
  supersession note for the SST pivot.

### Inline docs

- Each package gets a `README.md` (the existing pattern).
- Each spec doc (TODO 09) cross-links to its implementation.
- Each major code module gets a top-of-file comment explaining its
  role in the architecture (one paragraph max — per the global rule
  on comments).

## Steps

1. Author `docs/dev/architecture.md` first (it's the foundation).
2. Author the quickstart (forces concrete CLI examples).
3. Author the contributor cookbooks (forces the additive-extension
   pattern to be real).
4. Update README/AGENTS/CLAUDE.
5. Author the domain docs (least urgent; can land last).

## Acceptance criteria

- A new contributor can clone the repo and run a sim within 5 minutes
  by following `docs/user/quickstart.md`.
- A new contributor can author a new instance package within an hour
  by following `docs/dev/add-an-instance.md`.
- Every public API has a doc reference (either inline or in specs/).
- README/AGENTS/CLAUDE updated within 24 hours of any architecture
  change.

## Design notes

- **Docs match code.** When code changes, docs change in the same PR.
- **Cross-link liberally.** Each doc references the others; specs
  reference code; code references specs.
- **The contributor cookbooks are the executable form of the OCP
  promise.** If "add-a-kind" requires editing the runtime, the
  architecture has failed; fix the architecture, not the cookbook.

## Dependencies

- Requires TODO 02 (runtime) for the CLI to document.
- Requires TODO 08 (rename) for the namespace to be stable.
