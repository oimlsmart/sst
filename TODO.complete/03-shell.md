# TODO 03 — SST shell (Phase 4)

**Priority:** P0   **Status:** ✅ done   **Blocks:** TODO 11   **Blocked by:** TODO 02

## Goal

Build `packages/shell/sst-shell/` — the web UI host. A 2-step drill-down:
gallery of instrument **kinds** → gallery of **instances** within a kind
→ a session tab running the bench for that instance. Plus an
"Upload package…" affordance at both the kinds level (upload a kind
package) and the instances level (upload an instance package for the
current kind).

The shell is an Astro + Vue app, parallel to today's
`packages/lc500/bench/`. The bench is embedded per session via iframe
(consistent with the SMART app's existing embed pattern).

## Deliverables

### Routes

- **`/`** — landing; gallery of instrument kinds. One card per kind:
  designation, OIML Recommendation badge, instance count, 3D
  thumbnail (a kind-level default), "details" link.
- **`/kind/<kind-id>`** — instances of that kind. One card per
  instance: manufacturer, model, class badge, sample count, sample
  preview (fresh / damaged badges). Upload-instance button.
- **`/session/<session-id>`** — the running-instrument view; the bench
  in an iframe pointed at the runtime's port for this session.
- **`/upload`** — modal/page for uploading a ZIP (kind or instance).

### Components

- `src/pages/index.astro` — kinds gallery
- `src/pages/kind/[id].astro` — instances gallery
- `src/pages/session/[id].astro` — session view (iframe)
- `src/components/KindCard.vue`
- `src/components/InstanceCard.vue`
- `src/components/UploadPackage.vue` — `<input type="file" accept=".zip">`
  + drag-and-drop; POSTs to the runtime's `/sessions` endpoint.
- `src/components/SessionTabs.vue` — top-level session manager
- `src/lib/sessions.ts` — session lifecycle: open (calls runtime), close
  (calls runtime), list (calls runtime).

### Runtime endpoints (added by TODO 02)

The shell talks to the runtime via HTTP:
- `GET /kinds` — array of available kinds
- `GET /instances?kind=<id>` — array of instances for a kind
- `POST /sessions` `{ kind, instance, sample }` → `{ sessionId, port }`
- `DELETE /sessions/<id>`
- `POST /upload` (multipart) `{ file, tier }` — extracts + validates;
  returns either a new package entry or a precise error.

## Steps

1. `npm create astro@latest packages/shell/sst-shell` — Astro 7 + Vue 7
   + Tailwind 4 (matches the bench's stack).
2. Author the routes; stub the runtime calls.
3. Author the components.
4. Wire the upload flow; verify it extracts + validates a real ZIP.
5. Add a `primmel-sst-shell` bin that boots the shell (Astro preview
   in prod, dev server in dev) on a configurable port.
6. Configure CORS so the shell can call the runtime on a different port.

## Acceptance criteria

- Open `primmel-sst-shell` → see 4 kind cards (R 60, R 91, R 129, R 144).
- Click R 60 → see at least 1 instance card (ACME LC-500; more after
  Phase 8 lands the siblings).
- Click ACME LC-500 → see sample picker (fresh / creep-fail / aged /
  lying-twin / etc.) → "Start session" → bench opens in an iframe,
  fully functional.
- Upload a hypothetical `hbk-hlci.zip` → kind view shows the new card;
  clicking it boots a session with HBK's glTF + behavior.
- An invalid ZIP produces a precise error (which file failed validation,
  which schema rule).
- Multiple sessions run side-by-side in different tabs without
  interference.

## Design notes

- **The shell is kind-agnostic.** It reads `GET /kinds` and renders
  whatever the runtime exposes. Adding a new kind to the runtime makes
  it appear automatically.
- **Sessions are iframe-embedded.** No SPA routing inside the bench; the
  shell owns the URL space, the bench owns the canvas.
- **Upload is server-side.** The shell POSTs the ZIP to the runtime;
  the runtime extracts, validates against the manifest schema, and
  either accepts (returns a new entry) or rejects with a structured
  error. No client-side sandboxing in v1.
- **Styling** reuses the bench's design tokens (Space Grotesk + IBM
  Plex Sans + IBM Plex Mono, dark instrument-panel palette) so the
  transition from shell → bench is seamless.
- **Performance.** Initial kind-card render is SSG; per-session boot
  is the only cold path. Session iframes are independent; killing one
  doesn't affect others.

## Dependencies

- Requires TODO 02 (runtime) for the HTTP endpoints.
- The `bench` referenced by `/session/<id>` is today's
  `packages/lc500/bench/` — TODO 05 generalizes it to be kind-driven.
