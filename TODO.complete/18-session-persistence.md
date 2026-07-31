# TODO 18 — Session persistence + replay

**Priority:** P1   **Status:** ✅ done

## Goal

Sessions are ephemeral today. For certification, the evidence chain matters. This TODO adds a **session recorder** that captures every mutation + response, and a **replayer** that reconstructs the session.

## Deliverables

- `packages/runtime/sst-runtime/src/session/recorder.ts` — captures mutations + twin reads + state snapshots
- `packages/runtime/sst-runtime/src/session/replayer.ts` — reconstructs from a recording
- Export endpoint: `GET /session/<id>/evidence.json`
- Import: `POST /session/from-recording` with a recording file

## Acceptance criteria

- A recorded session replays identically (same indication at same virtual time)
- The evidence JSON contains: every mutation, every twin read, the MPE verdicts
- A third party can verify the recording without running the sim
