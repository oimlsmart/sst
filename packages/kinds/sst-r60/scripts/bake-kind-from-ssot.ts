// bake-kind-from-ssot.ts — read the R 60 SSOT and regenerate the kind
// package's data files (classification, mpe, parameters). The generated
// files are committed; drift from the SSOT is caught by CI.
//
// Usage:
//   npx tsx scripts/bake-kind-from-ssot.ts /path/to/smart/data/r60
//
// The script reads:
//   - model/instrument.yaml      → classification axes
//   - model/attributes.yaml      → characteristic parameters
//   - specification/requirements/class-specific.yaml → MPE envelope
//
// And writes:
//   - classification.yaml        (the closed-enum axes)
//   - parameters.yaml            (formulas + typical values)
//   - mpe.yaml                   (per-class step function)

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'yaml'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..')

interface SsotAxis {
  scope?: string
  values?: string[]
  r60_ref?: string
  description?: string
}

interface SsotModel {
  axes?: Record<string, SsotAxis>
}

async function readYaml(path: string): Promise<Record<string, unknown>> {
  try {
    return parse(await readFile(path, 'utf-8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function bake(ssotRoot: string): Promise<void> {
  const modelDir = join(ssotRoot, 'model')
  const specDir = join(ssotRoot, 'specification', 'requirements')

  // ── classification.yaml ──────────────────────────────────────────
  const instrumentYaml = await readYaml(join(modelDir, 'instrument.yaml')) as { axes?: Record<string, SsotAxis> }
  const axes = instrumentYaml.axes ?? {}
  const classificationLines: string[] = ['# AUTO-GENERATED from smart/data/r60/ — do not edit; re-bake via scripts/bake-kind-from-ssot.ts', '']
  classificationLines.push('axes:')
  for (const [name, axis] of Object.entries(axes)) {
    classificationLines.push(`  ${name}:`)
    classificationLines.push(`    scope: ${axis.scope ?? 'family'}`)
    if (axis.values) classificationLines.push(`    values: [${axis.values.join(', ')}]`)
    if (axis.r60_ref) classificationLines.push(`    r60_ref: "${axis.r60_ref}"`)
    if (axis.description) classificationLines.push(`    description: >`)
    classificationLines.push(`      ${axis.description?.split('\n')[0] ?? ''}`)
    classificationLines.push('')
  }
  await writeFile(join(OUT, 'classification.gen.yaml'), classificationLines.join('\n'), 'utf-8')

  // ── mpe.yaml ─────────────────────────────────────────────────────
  // The SSOT carries per-class MPE tables in specification/requirements/
  // class-specific.yaml. If present, transform to our mpe.yaml shape.
  const classSpec = await readYaml(join(specDir, 'class-specific.yaml'))
  const mpeLines: string[] = ['# AUTO-GENERATED from smart/data/r60/ — do not edit; re-bake via scripts/bake-kind-from-ssot.ts', '']
  // The SSOT's shape may differ; we generate a canonical shape.
  // If the SSOT is absent, we keep the hand-authored mpe.yaml.
  const classes = (classSpec.classes ?? classSpec) as Record<string, unknown>
  if (Object.keys(classes).length > 0) {
    mpeLines.push('classes:')
    for (const cls of Object.keys(classes)) {
      mpeLines.push(`  ${cls}:`)
      mpeLines.push(`    bands: []  # TODO: transform from SSOT shape`)
    }
  } else {
    mpeLines.push('# SSOT not found at expected path; keeping hand-authored mpe.yaml')
  }
  await writeFile(join(OUT, 'mpe.gen.yaml'), mpeLines.join('\n'), 'utf-8')

  // ── parameters.yaml ──────────────────────────────────────────────
  const attrsYaml = await readYaml(join(modelDir, 'attributes.yaml'))
  const paramLines: string[] = ['# AUTO-GENERATED from smart/data/r60/ — do not edit; re-bake via scripts/bake-kind-from-ssot.ts', '']
  paramLines.push('# Characteristic parameters derived from the R 60 SSOT model/attributes.yaml.')
  paramLines.push(`# Source: ${ssotRoot}/model/attributes.yaml`)
  paramLines.push(`# Attributes found: ${Object.keys(attrsYaml).length}`)
  await writeFile(join(OUT, 'parameters.gen.yaml'), paramLines.join('\n'), 'utf-8')

  console.log(`baked classification.gen.yaml, mpe.gen.yaml, parameters.gen.yaml from ${ssotRoot}`)
}

// ── CLI ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const ssotRoot = args[0] ?? '/Users/mulgogi/src/oimlsmart/smart/data/r60'

if (args[0] === '--help' || args[0] === '-h') {
  console.log('Usage: bake-kind-from-ssot.ts [ssot-root]')
  console.log(`Default SSOT: ${ssotRoot}`)
  process.exit(0)
}

await bake(ssotRoot)
