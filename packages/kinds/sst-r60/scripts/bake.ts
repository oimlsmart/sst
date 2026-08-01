// scripts/bake.ts — regenerate the kind's bundled twin contract artifact
// from the canonical Primmel product package that maps to this kind (the
// acme-lc500 instance is the R 60 reference; its product package is the
// SSOT for the R 60 twin contract). Spec §9: baked at pack time; the
// runtime boots from the baked artifact, primmel-ts never imports at
// runtime.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseTwinContract } from '@primmel/sst-runtime/twin-contract-prl'
import { bakeTwinContract } from '@primmel/sst-runtime/twin-bake'

const PKG = process.argv[2] ?? '/Users/mulgogi/src/oimlsmart/smart/primmel-packages/acme-lc500'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'twin', 'r60.twin.json')

const contract = await parseTwinContract(PKG)
await bakeTwinContract(contract, OUT, PKG)
console.log(`baked ${contract.serves.length} serves / ${contract.operations.length} operations from ${PKG} → ${OUT}`)
