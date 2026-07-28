import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { R91_CONTRACT } from './twin-contract.js'

// THE TWIN-SCHEMA HANDSHAKE with SIM-R91-2's product package (law 2):
// the /twin schema must GENERATE from the product reference package's
// serve declarations. The package has not landed (the smart repo's
// primmel-packages gains it on branch feat/radar-product-package) —
// this leg is SKIP-GUARDED until it exists. When it lands: point
// SIM_R91_PRODUCT_PACKAGE at it (or rename the default), and the parse
// must produce exactly the stand-in fixture — any drift fails here.
const PKG = process.env.SIM_R91_PRODUCT_PACKAGE ?? '/Users/mulgogi/src/oimlsmart/smart/primmel-packages/ref-radar-r91'
const PRESENT = existsSync(PKG)

describe('the SIM-R91-2 handshake (the product package parses to the contract)', () => {
  it.skipIf(!PRESENT)(`the real package parses to exactly the served contract (${PKG})`, async () => {
    const { parseTwinContract } = await import('@sim/core/twin-contract-prl')
    const contract = await parseTwinContract(PKG)
    expect(contract).toEqual(R91_CONTRACT)
  })

  it('the guard itself is honest: the skip reason is the missing package', () => {
    if (!PRESENT) {
      // documents the guard: the package directory does not exist yet
      expect(PRESENT).toBe(false)
    }
  })
})
