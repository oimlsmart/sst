#!/usr/bin/env tsx
// bake.ts — one-shot baker for the R 144 (CGM-200) twin contract.
// Mirrors packages/lc500/scripts/bake.ts (TODO 19's bake-from-SSOT
// flow, but for the gas analyzer until its .prl package ships its own
// baked artifact via the SSOT bake job).

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { bakeTwinContract } from '@primmel/sst-runtime/twin-bake'
import { GAS_ANALYZER_CONTRACT } from '@primmel/sst-runtime/twin-contract'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'twin', 'cgm200.twin.json')

await bakeTwinContract(GAS_ANALYZER_CONTRACT, OUT, 'packages/core/src/twin-contract.ts (fixture)')
console.log(`✓ baked ${OUT}`)
