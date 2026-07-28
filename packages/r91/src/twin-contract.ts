// twin-contract.ts — the radar family's serve contract. Law 2: the
// twin interface GENERATES from the product reference package's serve
// declarations, never hand-written. SIM-R91-2's product package has
// LANDED as primmel-packages/acme-rs180 — the package is the SSOT;
// this fixture mirrors its rs180_api endpoint exactly (get_indication
// fresh_within 1s, watch_state on state + environmental_context,
// run_self_test — the R 91-1, 7.5 checking facility) for the
// package-less standalone posture, and the handshake test
// (handshake.test.ts) parses the real package in place and asserts it
// produces exactly this fixture (the LC500_CONTRACT idiom in core).
// The package declares no fault-report operation: a detected fault IS
// the state answer (R 91-1, 6.18.4), served by state / watch_state.
import type { TwinContract } from '@sim/core/twin-contract'

export const R91_CONTRACT: TwinContract = {
  instrumentId: 'acme-rs180',
  serves: [
    { target: 'indication', via: 'get_indication', freshWithinS: 1 },
    { target: 'state', via: 'watch_state', freshWithinS: 1 },
    { target: 'environmental_context', via: 'watch_state', freshWithinS: 1 },
  ],
  operations: [
    { id: 'get_indication', kind: 'query' },
    { id: 'watch_state', kind: 'watch' },
    { id: 'run_self_test', kind: 'command' },
  ],
}
