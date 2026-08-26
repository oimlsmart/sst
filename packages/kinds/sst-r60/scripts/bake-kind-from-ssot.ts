// bake-kind-from-ssot.ts — regenerate this kind's classification.yaml
// from the R 60 Recommendation model's classification dimensions
// (TODO.model-content/05; the doctrine: smart/AGENTS.d/16 — the model is
// the interface, on every surface).
//
// THE HOP (decided once, documented here): this script reads the smart
// repo's GENERATED data tree (<smart>/data/r60/model/instrument.yaml),
// one hop off the PRL packages. The tree is downstream-generated from
// primmel-packages/oiml-r60 — the single source of truth — and proven
// byte-clean against it by the smart repo's own drift guard
// (`npm run test:ssot`), so the tree is a faithful projection of the
// package and the same consumption path the app itself reads. (The
// twin-contract bake, scripts/bake.ts, reads the product PRL package
// directly through @primmel/primmel; the classification dimensions live
// in the RECOMMENDATION package, and its generated tree is the
// reviewable projection.)
//
// Usage:
//   npx tsx scripts/bake-kind-from-ssot.ts [smart-checkout-root]
//   SMART_REPO=/path/to/smart npx tsx scripts/bake-kind-from-ssot.ts
//
// Writes (committed; CI's `kind-bake-freshness` leg re-bakes and diffs):
//   classification.yaml — the closed-enum classification dimensions,
//   with the auto-generated banner.
//
// Scope: the classification surface only. mpe.yaml / parameters.yaml
// remain hand-authored (the MPE tier transform from
// specification/requirements/class-specific.yaml is future work); the
// pre-collapse stub writers (mpe.gen.yaml / parameters.gen.yaml) are
// gone — they wrote uncommitted TODO stubs, never real outputs.

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..')

// ── The current tree shape (data/r60/model/instrument.yaml) ─────────
// classification_dimensions is a LIST (post-collapse) of dimensions:
//   - id, scope, source: { doc, clause }, description: [{ spelling, value }],
//     values: [{ id, name, description, ... }]
interface Spelled { spelling?: string; value?: string }
interface DimensionValue { id?: string }
interface Dimension {
  id?: string
  scope?: string
  source?: { doc?: string; clause?: string }
  description?: Spelled[]
  values?: DimensionValue[]
}
interface InstrumentTree { classification_dimensions?: Dimension[] }

/** Emit a YAML scalar: plain when safe, double-quoted otherwise. */
function scalar(s: string): string {
  return /^[A-Za-z0-9][A-Za-z0-9 _.,()/-]*$/.test(s) ? s : JSON.stringify(s)
}

function enumId(s: string): string {
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(s) ? s : JSON.stringify(s)
}

async function bake(smartRoot: string): Promise<void> {
  const instrumentPath = join(smartRoot, 'data', 'r60', 'model', 'instrument.yaml')
  if (!existsSync(instrumentPath)) {
    throw new Error(
      `R 60 model tree not found at ${instrumentPath} — declare the smart checkout ` +
      `(SMART_REPO, or pass its root as the first argument).`,
    )
  }
  const tree = parse(await readFile(instrumentPath, 'utf-8')) as InstrumentTree
  const dims = tree.classification_dimensions
  if (!Array.isArray(dims) || dims.length === 0) {
    throw new Error(
      `${instrumentPath} carries no classification_dimensions — the tree shape moved again; ` +
      `re-point this bake (the pre-collapse 'axes' shape is gone).`,
    )
  }

  const lines: string[] = [
    '# AUTO-GENERATED from the smart repo’s R 60 model — do not edit by hand.',
    '# Source: data/r60/model/instrument.yaml · classification_dimensions',
    '#   (the data tree is generated from primmel-packages/oiml-r60 — the single',
    '#   source of truth — and proven byte-clean by the smart repo’s test:ssot).',
    '# Re-bake: npx tsx packages/kinds/sst-r60/scripts/bake-kind-from-ssot.ts [smart-checkout]',
    '# Freshness: the CI `kind-bake-freshness` leg re-bakes and diffs this file.',
    '',
    'classification_dimensions:',
  ]
  for (const dim of dims) {
    if (!dim.id) throw new Error('classification dimension without an id — the tree shape moved')
    lines.push(`  - id: ${enumId(dim.id)}`)
    if (dim.scope) lines.push(`    scope: ${enumId(dim.scope)}`)
    if (dim.source?.doc || dim.source?.clause) {
      const doc = dim.source.doc ?? ''
      const clause = dim.source.clause ?? ''
      lines.push(`    source: { doc: ${JSON.stringify(doc)}, clause: ${JSON.stringify(clause)} }`)
    }
    const desc = dim.description?.[0]?.value
    if (desc) lines.push(`    description: ${scalar(desc)}`)
    const values = (dim.values ?? []).map((v) => {
      if (!v.id) throw new Error(`dimension ${dim.id} carries a value without an id`)
      return enumId(v.id)
    })
    lines.push(`    values: [${values.join(', ')}]`)
    lines.push('')
  }
  await writeFile(join(OUT, 'classification.yaml'), lines.join('\n'), 'utf-8')
  console.log(`baked classification.yaml: ${dims.length} dimensions from ${instrumentPath}`)
}

// ── CLI ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
if (args[0] === '--help' || args[0] === '-h') {
  console.log('Usage: bake-kind-from-ssot.ts [smart-checkout-root]')
  console.log('Falls back to the SMART_REPO env; one of the two is required.')
  process.exit(0)
}
const smartRoot = args[0] ?? process.env.SMART_REPO
if (!smartRoot) {
  console.error('no smart checkout declared — pass its root as the first argument or set SMART_REPO')
  process.exit(2)
}

await bake(smartRoot)
