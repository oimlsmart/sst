# TODO 09 — Formal specs

**Priority:** P0   **Status:** ✅ done   **Blocks:** TODO 02, 07, 10   **Blocked by:** nothing

## Goal

Author the formal specification documents under `specs/`. These are the
normative references that TODO 02 (runtime), TODO 07 (siblings), and
TODO 10 (tests) implement against. Without these specs, "model-driven"
is an aspiration; with them, it's a contract.

The user emphasized: "Make sure we have good specs throughout."

## Deliverables

### `specs/` directory

- `00-architecture.md` — the five-layer architecture (base / kinds /
  instances / runtime / shell); the composition rule; the OCP seams.
- `01-package-format.md` — the `package.sst.yaml` manifest schema.
  Covers all three tiers. JSON Schema in an appendix.
- `02-base-package.md` — the D 11 base tier spec: what conditions look
  like, severity-level encoding, influence-vs-disturbance.
- `03-kind-package.md` — the kind tier spec: classification axes,
  MPE formulas, world-kind SDL, interface.d.ts contract.
- `04-instance-package.md` — the instance tier spec: coefficients,
  samples, behavior.js shape, glTF model expectations.
- `05-runtime.md` — the runtime spec: package-loader protocol,
  kind-interface registry, stage registry, CLI surface.
- `06-shell.md` — the shell spec: routes, HTTP endpoints to the
  runtime, session lifecycle, upload protocol.
- `07-ocp-patterns.md` — how the architecture embodies OCP/MECE/DRY;
  concrete patterns and anti-patterns to avoid.
- `08-additive-extension.md` — the cookbook: how to add a new kind;
  how to add a new instance; how to add a new D 11 condition; how to
  add a new active domain. Step-by-step.
- `09-design-decisions.md` — the ADR log. Why glTF; why no Three.js;
  why per-kind behavior.js instead of a YAML DSL; why base tier is
  bundled vs. uploadable; etc.

### JSON Schemas (under `specs/schemas/`)

- `package-manifest.schema.json` — the manifest, with `oneOf` for the
  three tiers.
- `condition.schema.json` — a D 11 condition file.
- `profile.schema.json` — a chamber-program profile.
- `classification.schema.json` — a kind's classification axes.
- `mpe.schema.json` — a kind's MPE envelope.
- `world-kind.schema.json` — the mutation → handler binding file.
- `coefficients.schema.json` — an instance's physics coefficients.
- `sample.schema.json` — a sample's manifest.
- `bench.schema.json` — a kind's bench metadata.

These schemas are normative — the runtime's package-loader validates
every loaded package against them. CI bakes the schemas into TypeScript
types via `json-schema-to-typescript`.

## Steps

1. Author `00-architecture.md` (the framing doc — references all
   others).
2. Author `01-package-format.md` + the manifest JSON Schema.
3. Author `02-04` (the three tier specs) + their JSON Schemas.
4. Author `05-runtime.md` and `06-shell.md` (the code-tier specs).
5. Author `07-ocp-patterns.md` + `08-additive-extension.md` (the
   pattern library + cookbook).
6. Author `09-design-decisions.md` (the ADR log).
7. Wire the JSON Schemas into the runtime's loader (TODO 02) and the
   tests (TODO 10).

## Acceptance criteria

- Every JSON Schema validates at least one real example (the existing
  ACME LC-500 instance package; the R 60 kind package; the D 11 base).
- `specs/` is referenced from `README.md` as the authoritative source.
- The runtime's package-loader (TODO 02) validates against these
  schemas at load time.
- A new contributor can author a new kind by following
  `08-additive-extension.md` without reading code.

## Design notes

- **Specs are normative.** Code conforms to specs; specs don't conform
  to code. When the two diverge, either fix the code or update the
  spec — never let them drift silently.
- **JSON Schema is the contract.** YAML is the human form; the schema
  is the machine form. Both must stay in sync (a CI check verifies).
- **ADRs capture the "why".** Code captures the "what". A new
  contributor reading the ADR log should understand why each
  architectural choice was made, not just what was chosen.

## Dependencies

- Blocks TODO 02 (runtime implements the loader against these specs),
  TODO 07 (siblings conform to the kind spec), TODO 10 (tests validate
  against the schemas).
