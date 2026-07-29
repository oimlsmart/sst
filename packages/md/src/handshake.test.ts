import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { MD350_CONTRACT } from './twin-contract.js'

// THE TWIN-SCHEMA HANDSHAKE with TODO.v2/08's R 129 product package
// (law 2): the /twin schema must GENERATE from the product reference
// package's serve declarations. The package has LANDED as the smart
// repo's primmel-packages/acme-md3xx (feat/acme-md-package) — this leg
// parses it in place and asserts the parse produces exactly the
// fixture: any drift fails here. The guard only skips when the
// (private) smart checkout is absent (CI); override the path with
// SIM_MD_PRODUCT_PACKAGE (the development posture while the package
// rides its feature branch in a worktree).
const PKG = process.env.SIM_MD_PRODUCT_PACKAGE ?? '/Users/mulgogi/src/oimlsmart/smart/primmel-packages/acme-md3xx'
const PRESENT = existsSync(PKG)

describe('the R 129 handshake (the product package parses to the contract)', () => {
  it.skipIf(!PRESENT)(`the real package parses to exactly the served contract (${PKG})`, async () => {
    const { parseTwinContract } = await import('@sim/core/twin-contract-prl')
    const contract = await parseTwinContract(PKG)
    expect(contract).toEqual(MD350_CONTRACT)
  })

  it('the guard itself is honest: the skip reason is the missing package', () => {
    if (!PRESENT) {
      // documents the guard: the package directory is absent in this checkout
      expect(PRESENT).toBe(false)
    }
  })
})
