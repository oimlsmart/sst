// twin-contract.ts — the dimensioner family's serve contract. Law 2:
// the twin interface GENERATES from the product reference package's
// serve declarations, never hand-written. TODO.v2/08's R 129 leg has
// LANDED as primmel-packages/acme-md3xx — the package is the SSOT;
// this fixture mirrors its md350_api endpoint exactly (get_dimensions /
// get_volume / get_dim_weight fresh_within 2s, watch_state on state +
// environmental_context, run_self_test — the R 129-1, 5.6 checking
// facility) for the package-less standalone posture, and the handshake
// test (handshake.test.ts) parses the real package in place and
// asserts it produces exactly this fixture (the R91_CONTRACT idiom).
// The package declares no fault-report operation: a detected fault IS
// the state answer (R 129-1, 5.6.1), served by state / watch_state.
import type { TwinContract } from '@sim/core/twin-contract'

export const MD350_CONTRACT: TwinContract = {
  instrumentId: 'acme-md3xx',
  serves: [
    { target: 'indication_length', via: 'get_dimensions', freshWithinS: 2 },
    { target: 'indication_width', via: 'get_dimensions', freshWithinS: 2 },
    { target: 'indication_height', via: 'get_dimensions', freshWithinS: 2 },
    { target: 'dim_volume', via: 'get_volume', freshWithinS: 2 },
    { target: 'dim_weight', via: 'get_dim_weight', freshWithinS: 2 },
    { target: 'state', via: 'watch_state', freshWithinS: 1 },
    { target: 'environmental_context', via: 'watch_state', freshWithinS: 1 },
  ],
  operations: [
    { id: 'get_dimensions', kind: 'query' },
    { id: 'get_volume', kind: 'query' },
    { id: 'get_dim_weight', kind: 'query' },
    { id: 'watch_state', kind: 'watch' },
    { id: 'run_self_test', kind: 'command' },
  ],
}
