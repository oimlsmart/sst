#!/usr/bin/env tsx
// bake.ts — bakes the sampling-line twin contract.
//
// The sampling line is not a measuring instrument in the OIML sense;
// there's no upstream Primmel product package for it (yet). The
// contract is declared inline here — the kind's interface.d.ts is the
// source of truth. The smart side's sample-line.prl declares only
// `flow`; this contract adds the four registers the runtime needs
// (sampleFlow, linePressure, gasTemperature, transportDelayS) plus
// the composite coupling port (outletComposition — non-served, read
// only by the runtime's per-tick coupler).

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { bakeTwinContract } from '@primmel/sst-runtime/twin-bake'
import type { TwinContract } from '@primmel/sst-runtime/twin-contract'

const SAMPLING_LINE_CONTRACT = {
  instrumentId: 'sampling-line',
  serves: [
    { target: 'sample_flow',     via: 'get_sample_flow',     freshWithinS: 5 },
    { target: 'line_pressure',   via: 'get_line_pressure',   freshWithinS: 5 },
    { target: 'gas_temperature', via: 'get_gas_temperature', freshWithinS: 5 },
    { target: 'transport_delay', via: 'get_transport_delay', freshWithinS: 5 },
    { target: 'state',           via: 'watch_state',         freshWithinS: 1 },
  ],
  operations: [
    { id: 'get_sample_flow',     kind: 'query' as const },
    { id: 'get_line_pressure',   kind: 'query' as const },
    { id: 'get_gas_temperature', kind: 'query' as const },
    { id: 'get_transport_delay', kind: 'query' as const },
    { id: 'watch_state',         kind: 'watch' as const },
  ],
} as const satisfies TwinContract

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'twin', 'sampling-line.twin.json')

await bakeTwinContract(SAMPLING_LINE_CONTRACT, OUT, 'packages/kinds/sst-sampling-line/scripts/bake.ts (inline)')
console.log(`✓ baked ${OUT}`)
