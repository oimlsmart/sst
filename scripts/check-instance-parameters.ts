// check-instance-parameters.ts — the instance-parameter guard
// (TODO.model-content/05; the doctrine: smart/AGENTS.d/16 — the model is
// the interface; an instance never re-authors what the product package
// carries, and where both speak they must agree).
//
// Every instance package's manifest (package.sst.yaml) hand-types
// `classification:` + `design_parameters:`. The authoritative values for
// the parameters the PRODUCT MODEL declares live in the Primmel product
// package named by the manifest's `maps_to:` (the smart checkout's
// primmel-packages/<id>). The `maps_to:` seam makes the comparison
// mechanical: load the product package with the real PRL parser
// (@primmel/primmel, resolved through the linked @primmel/sst-runtime —
// the framework's own file: dependency), take the subject's
// is.designParameters (Record<string, "<value> <unit>"), and compare
// every SHARED key against the instance's typed value:
//
//   - instance design_parameters { value, unit }  ↔  "<value> <unit>"
//     (numeric value AND unit must agree)
//   - instance classification scalars             ↔  the product value's
//     numeric/text part (classification carries no units; a
//     "dimensionless" product quantity compares numerically)
//
// Instance-only parameters (e.g. the LC-500's rated_output) are the
// sim's own richness — allowed, reported as unchecked. Product-only
// parameters are reported as coverage gaps the instance does not type —
// allowed (the instance is not obliged to type every declared
// parameter), printed so the coverage is visible.
//
// Usage:
//   npx tsx scripts/check-instance-parameters.ts [smart-checkout-root]
//   SMART_REPO=/path/to/smart npx tsx scripts/check-instance-parameters.ts
//
// Without the smart checkout declared, the guard skips honestly (exit 0
// with the skip line) — the same doctrine as the bake-freshness leg. CI:
// the `instance-parameters` job. A disagreement exits 1 and names the
// parameter, the manifest value, and the product-package value.

import { readdir, readFile, realpath } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'yaml'

// ── Manifest shapes (the parts we read) ─────────────────────────────
interface Quantity { value?: number | string; unit?: string }
interface InstanceManifest {
  id?: string
  maps_to?: string
  classification?: Record<string, unknown>
  design_parameters?: Record<string, Quantity>
}

interface ProductSubject { id?: string; is?: { designParameters?: Record<string, string> } }
interface ProductPackage { subjects?: ProductSubject[] }
type LoadPackage = (dir: string) => Promise<unknown>

/** Resolve @primmel/primmel through the declared file: dependency chain:
 *  the library links the framework (node_modules/@primmel/sst-runtime);
 *  the framework links primmel-ts. Walk up from the runtime's REAL
 *  location until the primmel package.json shows up. */
async function resolvePrimmel(repoRoot: string): Promise<string> {
  let dir = await realpath(resolve(repoRoot, 'node_modules', '@primmel', 'sst-runtime'))
  for (let i = 0; i < 6; i++) {
    const cand = join(dir, 'node_modules', '@primmel', 'primmel', 'package.json')
    if (existsSync(cand)) return dirname(cand)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(
    '@primmel/primmel is not resolvable from the linked @primmel/sst-runtime — ' +
    'run npm ci in the framework checkout (the primmel/sst sibling) first',
  )
}

/** Parse a product qualifier "<value> <unit>" (e.g. "500 kg",
 *  "6000 dimensionless") into its parts. */
function splitQualifier(q: string): { value: string; unit: string } {
  const m = /^(\S+)\s+(.*)$/.exec(q.trim())
  return m ? { value: m[1]!, unit: m[2]!.trim() } : { value: q.trim(), unit: '' }
}

function numericEqual(a: string, b: string): boolean {
  const na = Number(a)
  const nb = Number(b)
  return Number.isFinite(na) && Number.isFinite(nb) ? na === nb : a === b
}

const normKey = (s: string): string => s.toLowerCase().replace(/[-_]/g, '')

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
  const smartRoot = args[0] ?? process.env.SMART_REPO
  if (!smartRoot || !existsSync(join(smartRoot, 'primmel-packages'))) {
    console.log('smart checkout not present (SMART_REPO unset) — the instance-parameter guard runs where the smart checkout lives')
    return 0
  }

  const { loadPackage } = (await import(
    pathToFileURL(join(await resolvePrimmel(repoRoot), 'dist', 'index.js')).href
  )) as { loadPackage: LoadPackage }

  const instancesDir = join(repoRoot, 'packages', 'instances')
  const dirs = (await readdir(instancesDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()

  let failures = 0
  for (const dir of dirs) {
    const manifestPath = join(instancesDir, dir, 'package.sst.yaml')
    if (!existsSync(manifestPath)) continue
    const manifest = parse(await readFile(manifestPath, 'utf-8')) as InstanceManifest
    const id = manifest.id ?? dir
    const mapsTo = manifest.maps_to
    const classification = manifest.classification ?? {}
    const design = manifest.design_parameters ?? {}
    if (!mapsTo || (Object.keys(classification).length === 0 && Object.keys(design).length === 0)) {
      console.log(`── ${id}: no typed parameters (composite or unmapped) — skipped`)
      continue
    }

    // maps_to may name a subject inside a composite package:
    // "acme-cgm-system/sample-line" → package acme-cgm-system, subject SampleLine.
    const [pkgId, subjectHint] = mapsTo.split('/') as [string, string?]
    const pkgDir = join(smartRoot, 'primmel-packages', pkgId)
    if (!existsSync(pkgDir)) {
      console.error(`✗ ${id}: maps_to ${mapsTo} — product package not found at ${pkgDir}`)
      failures++
      continue
    }
    const pkg = (await loadPackage(pkgDir)) as ProductPackage
    const subjects = pkg.subjects ?? []
    const subject = subjectHint
      ? subjects.find((s) => normKey(s.id ?? '') === normKey(subjectHint))
      : subjects[0]
    if (!subject) {
      console.error(`✗ ${id}: maps_to ${mapsTo} — no subject matching '${subjectHint}' in ${pkgId}`)
      failures++
      continue
    }
    const productParams = subject.is?.designParameters ?? {}

    const checked: string[] = []
    const problems: string[] = []
    const gaps: string[] = []
    for (const [key, qualifier] of Object.entries(productParams)) {
      const expected = splitQualifier(qualifier)
      const designEntry = design[key]
      const classEntry = classification[key]
      if (designEntry?.value !== undefined) {
        checked.push(key)
        const actualValue = String(designEntry.value)
        const actualUnit = designEntry.unit ?? ''
        if (!numericEqual(actualValue, expected.value) || actualUnit !== expected.unit) {
          problems.push(
            `design_parameters.${key}: manifest types "${actualValue}${actualUnit ? ` ${actualUnit}` : ''}", ` +
            `the product package declares "${qualifier}"`,
          )
        }
      } else if (typeof classEntry === 'string' || typeof classEntry === 'number') {
        checked.push(`${key} (classification)`)
        if (!numericEqual(String(classEntry), expected.value)) {
          problems.push(
            `classification.${key}: manifest types "${String(classEntry)}", ` +
            `the product package declares "${qualifier}"`,
          )
        }
      } else {
        gaps.push(key)
      }
    }

    if (problems.length > 0) {
      failures++
      console.error(`✗ ${id} (maps_to ${mapsTo}) — the manifest disagrees with the product package:`)
      for (const p of problems) console.error(`    ${p}`)
    } else if (checked.length > 0) {
      console.log(`── ${id}: ${checked.length} shared parameter(s) agree with ${pkgId} [${checked.join(', ')}]` +
        (gaps.length > 0 ? `; untyped product parameters: ${gaps.join(', ')}` : ''))
    } else {
      console.log(`── ${id}: no shared parameters with ${pkgId} — nothing to guard (the vocabularies do not intersect)`)
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} instance(s) disagree with their product package — fix the manifest (the product package is the SSOT) or fix the package upstream`)
    return 1
  }
  console.log('\nall typed instance parameters agree with their product packages')
  return 0
}

process.exitCode = await main()
