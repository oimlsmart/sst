#!/usr/bin/env tsx
// bake.ts — bakes the R 144 (gas analyzer) twin contract from the
// canonical acme-cgm-200 product package, the same way the sibling kind
// packages (sst-r60, sst-r91, sst-r129) bake from their reference
// instance packages. The handshake test (sst-runtime/src/handshake-r144
// or wherever it lives) enforces fixture ≡ package.

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseTwinContract } from '@primmel/sst-runtime/twin-contract-prl'
import { bakeTwinContract } from '@primmel/sst-runtime/twin-bake'

const PKG = process.argv[2] ?? '/Users/mulgogi/src/oimlsmart/smart/primmel-packages/acme-cgm-200'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'twin', 'r144.twin.json')

const contract = await parseTwinContract(PKG)
await bakeTwinContract(contract, OUT, PKG)
console.log(`baked ${contract.serves.length} serves / ${contract.operations.length} operations from ${PKG} → ${OUT}`)
