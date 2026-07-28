// twin-contract.ts — the radar family's serve contract. Law 2: the
// twin interface GENERATES from the product reference package's serve
// declarations, never hand-written. SIM-R91-2 (the smart repo's
// primmel-packages/<demo-radar>) has NOT landed — this fixture is the
// STAND-IN, shaped as the package will declare it (speed indication
// with fresh_within, op_state, environmental context, self-test and
// fault reporting as instrument-legal operations). The handshake test
// (handshake.test.ts) parses the real package and asserts it produces
// exactly this contract — skip-guarded until the package exists. The
// same idiom as core's LC500_CONTRACT (the canonical fixture the .prl
// adapter is pinned against).
import type { TwinContract } from '@sim/core/twin-contract'

export const R91_CONTRACT: TwinContract = {
  instrumentId: 'ref-radar-r91',
  serves: [
    { target: 'indication', via: 'get_indication', freshWithinS: 2 },
    { target: 'state', via: 'watch_state', freshWithinS: 1 },
    { target: 'environmental_context', via: 'watch_state', freshWithinS: 1 },
  ],
  operations: [
    { id: 'get_indication', kind: 'query' },
    { id: 'watch_state', kind: 'watch' },
    { id: 'run_self_test', kind: 'command' },
    { id: 'report_faults', kind: 'command' },
  ],
}
