// scripts/bake.ts — regenerate the bundled twin contract artifact from
// the real acme-md3xx product package (spec §9: baked at pack time;
// the standalone boot rides this, primmel-ts never imports at runtime).
// The handshake test (src/handshake.test.ts) enforces fixture ≡ package.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseTwinContract } from '@primmel/sst-runtime/twin-contract-prl'
import { bakeTwinContract } from '@primmel/sst-runtime/twin-bake'

const PKG = process.argv[2] ?? '/Users/mulgogi/src/oimlsmart/smart/primmel-packages/acme-md3xx'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'twin', 'md.twin.json')

const contract = await parseTwinContract(PKG)
await bakeTwinContract(contract, OUT, PKG)
console.log(`baked ${contract.serves.length} serves / ${contract.operations.length} operations from ${PKG} → ${OUT}`)
