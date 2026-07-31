// bake-catalog.ts — read the R 60 SSOT and write a catalog.json per
// instance package. The InstrumentChooser reads this JSON at runtime
// instead of the hand-curated catalog.ts. Run via:
//
//   npx tsx packages/instances/acme-lc500/scripts/bake-catalog.ts \
//     /path/to/smart/data/r60/sample-data.yaml \
//     > packages/instances/acme-lc500/catalog.json
//
// Or with no args (uses the default SSOT path):
//
//   npx tsx packages/instances/acme-lc500/scripts/bake-catalog.ts
//
// The script is per-instance because each instance package owns its
// own samples (fresh, aged, dropped, etc.). The SSOT carries the
// authoritative manufacturer/model/sample hierarchy; the catalog
// projects it to the shape the bench's InstrumentChooser expects.
//
// See TODO.complete/06-catalog-bake.md for the workstream spec.

import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_SSOT = '/Users/mulgogi/src/oimlsmart/smart/data/r60/sample-data.yaml'

// ── SSOT shapes (the parts we read) ───────────────────────────────────
interface SsotFlow {
  name?: string
  id_prefix?: string
  subject?: {
    manufacturer?: { id?: string; company?: string; country?: string }
    family?: { id?: string; family_designation?: string; manufacturer_id?: string }
    groups?: Array<{
      id?: string
      group_label?: string
      family_id?: string
      classification?: { accuracy_class?: string; load_type?: string }
      parameters?: { n_lc?: { value?: number }; dr?: { value?: number; unit?: string } }
    }>
    models?: Array<{
      id?: string
      group_id?: string
      classification?: { accuracy_class?: string; load_type?: string; technology?: string }
      parameters?: { e_max?: { value?: number; unit?: string }; v_min?: { value?: number; unit?: string } }
    }>
    samples?: Array<{
      id?: string
      model_id?: string
      serial_number?: string
      test_context?: { d_min?: { value?: number }; d_max?: { value?: number } }
    }>
  }
}

interface SsotRoot { flows?: SsotFlow[] }

// ── Catalog shapes (what the bench expects) ──────────────────────────
interface CatalogSample {
  id: string
  scenarioId: string                    // maps to a scenario in scenarios.yaml
  serialNumber: string
  sampleName: string                    // fresh / aged / dropped / ...
  description: string
  damageKind: 'fresh' | 'aged' | 'dropped' | 'corroded' | 'lying-twin' | 'stale-twin' | 'creep-fail' | 'temp-fail' | 'drift-fail'
}
interface CatalogModel {
  id: string
  designation: string
  manufacturerId: string
  accuracyClass: 'A' | 'B' | 'C' | 'D'
  classNumber: number
  eMaxKg: number
  nLc: number
  samples: CatalogSample[]
}
interface CatalogManufacturer {
  id: string
  name: string
  shortName: string
  country: string
  models: CatalogModel[]
}

// ── Bake ──────────────────────────────────────────────────────────────

/** Read the SSOT, project to the catalog shape, write catalog.json.
 *  Filters to manufacturers whose models appear in our shipped instance
 *  packages. */
async function bake(ssotPath: string, outPath: string, filterManufacturerIds: string[]): Promise<void> {
  const text = await readFile(ssotPath, 'utf-8')
  const ssot = parse(text) as SsotRoot
  if (!ssot.flows) throw new Error('SSOT missing top-level flows array')

  const manufacturers = new Map<string, CatalogManufacturer>()
  const models = new Map<string, CatalogModel>()

  for (const flow of ssot.flows) {
    const mfrRaw = flow.subject?.manufacturer
    if (!mfrRaw?.id) continue
    if (filterManufacturerIds.length > 0 && !filterManufacturerIds.includes(mfrRaw.id)) continue

    if (!manufacturers.has(mfrRaw.id)) {
      manufacturers.set(mfrRaw.id, {
        id: mfrRaw.id,
        name: mfrRaw.company ?? mfrRaw.id,
        shortName: (mfrRaw.company ?? mfrRaw.id).split(/[ -]/).slice(0, 2).join(''),
        country: mfrRaw.country ?? '??',
        models: [],
      })
    }
    const mfr = manufacturers.get(mfrRaw.id)!

    // Models (carry the accuracy class + capacity from their parent group)
    for (const model of flow.subject?.models ?? []) {
      if (!model?.id) continue
      const group = flow.subject?.groups?.find(g => g?.id === model.group_id)
      const accuracyClass = (model.classification?.accuracy_class ?? group?.classification?.accuracy_class ?? 'C') as 'A' | 'B' | 'C' | 'D'
      const nLc = group?.parameters?.n_lc?.value ?? 6000
      const eMaxKg = model.parameters?.e_max?.value ?? 500
      const classNumber = Math.round(nLc / 1000)

      const cmodel: CatalogModel = {
        id: model.id,
        designation: `${mfr.shortName} ${flow.subject?.family?.family_designation ?? ''} ${accuracyClass}${classNumber}`.trim(),
        manufacturerId: mfr.id,
        accuracyClass,
        classNumber,
        eMaxKg,
        nLc,
        samples: [],
      }
      models.set(model.id, cmodel)
      mfr.models.push(cmodel)
    }

    // Samples — assign to their model; derive sampleName + damageKind from custody/test context.
    for (const sample of flow.subject?.samples ?? []) {
      if (!sample?.id || !sample.model_id) continue
      const model = models.get(sample.model_id)
      if (!model) continue
      const serial = sample.serial_number ?? sample.id
      const csample: CatalogSample = {
        id: sample.id,
        scenarioId: 'fresh',                       // default — TODO: derive from custody events
        serialNumber: serial,
        sampleName: 'fresh',
        description: `Serial ${serial}; SSOT id ${sample.id}`,
        damageKind: 'fresh',
      }
      model.samples.push(csample)
    }
  }

  const catalog = [...manufacturers.values()]
  await writeFile(outPath, JSON.stringify(catalog, null, 2) + '\n', 'utf-8')
  const total = catalog.reduce((n, m) => n + m.models.reduce((mn, m2) => mn + m2.samples.length, 0), 0)
  console.error(`baked ${catalog.length} manufacturer(s), ${catalog.reduce((n, m) => n + m.models.length, 0)} model(s), ${total} sample(s) → ${outPath}`)
}

// ── CLI ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
if (args[0] === '--help' || args[0] === '-h') {
  console.error('Usage: bake-catalog.ts [ssot-path] [out-path] [mfr-id-filter...]')
  console.error(`Default SSOT: ${DEFAULT_SSOT}`)
  process.exit(0)
}

const ssotPath = args[0] ?? DEFAULT_SSOT
const outPath = args[1] ?? join(HERE, '..', 'catalog.json')
const filter = args.slice(2)

await bake(ssotPath, outPath, filter)
