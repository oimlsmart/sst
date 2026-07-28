// scripts/bake.ts — regenerate the bundled twin contract artifact.
// SIM-R91-2's product package has not landed: the artifact bakes the
// STAND-IN fixture (src/twin-contract.ts), clearly marked as such in
// its `source`. When the package lands, this script gains the .prl
// parse path (lc500's bake.ts idiom) and the handshake test enforces
// fixture ≡ package.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { bakeTwinContract } from '@sim/core/twin-bake'
import { R91_CONTRACT } from '../src/twin-contract.js'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'twin', 'r91.twin.json')

await bakeTwinContract(R91_CONTRACT, OUT, 'stand-in fixture src/twin-contract.ts (SIM-R91-2 product package pending)')
console.log(`baked ${R91_CONTRACT.serves.length} serves / ${R91_CONTRACT.operations.length} operations (stand-in fixture) → ${OUT}`)
