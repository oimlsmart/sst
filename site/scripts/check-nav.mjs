#!/usr/bin/env node
/**
 * The nav completeness gate for this site — the CI check that every
 * href in the nav model resolves to a real page (TODO.ia/03 item 6,
 * where the nav moved into this repository and grew its own gate).
 *
 * It wraps the installed shell package's check-nav (the one
 * completeness gate, no second implementation) with this site's one
 * twist: the static build emits pages at their natural paths
 * (`dist/docs/…` for the Docs section), while the model's hrefs are
 * the SERVED paths (`/sst/docs/`) — GitHub Pages mounts this artifact
 * under the site's base. So the wrapper grafts the dist tree at that
 * base inside a temporary directory (a symlink named `sst` → dist)
 * and hands the graft to the tool, which then sees exactly the served
 * routes:
 *
 *   - the model (src/data/nav-config.ts) and the site constants
 *     (src/data/site-meta.ts, the base and origin come from there) are
 *     loaded under plain node's type stripping — both modules stay
 *     data-only with explicit .ts relative imports for exactly that
 *     load;
 *   - every internal href is checked against the grafted --dist tree,
 *     and the page quality legs run (redirect stubs, coming-soon
 *     markers, thin mains);
 *   - the model carries no external hrefs today, so a plain run needs
 *     no network; --origin (the front door, from SITE.url) is passed
 *     for the day one appears, and any arguments given to this script
 *     pass through after the defaults.
 *
 * Usage (the npm script `check:nav` runs the first form):
 *
 *   node scripts/check-nav.mjs                      # build dist first
 *   node scripts/check-nav.mjs --offline            # no-network runs
 *
 * Exit 0 when every entry resolves; exit 1 with each failing entry
 * named otherwise.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MODEL_FILE = join(ROOT, 'src', 'data', 'nav-config.ts')
const SITE_META_FILE = join(ROOT, 'src', 'data', 'site-meta.ts')
// The Astro config builds to the REPO ROOT's dist/ (outDir: '../dist'),
// the tree the pages workflow uploads.
const DIST_DIR = join(ROOT, '..', 'dist')

// --- load the site constants under node's type stripping -------------------

function loadSite(file) {
  if (!existsSync(file)) fail(`the site constants are missing: ${file}`)
  const specifier = JSON.stringify(pathToFileURL(file).href)
  const code = `import(${specifier}).then(m => { process.stdout.write(JSON.stringify(m.SITE ?? m.default ?? m)) })`
  const run = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', code], { encoding: 'utf8' })
  if (run.status !== 0 || !run.stdout) {
    fail(`could not load the site constants (node >= 22.6 required): ${(run.stderr || '').trim()}`)
  }
  return JSON.parse(run.stdout)
}

function fail(message) {
  console.error(`check-nav: ${message}`)
  process.exit(1)
}

// --- main -------------------------------------------------------------------

const argv = process.argv.slice(2)
const offline = argv.includes('--offline')

if (!offline && !existsSync(DIST_DIR)) {
  fail(`no dist/ to check against — run \`npm run build\` first (or pass --offline)`)
}

const SITE = loadSite(SITE_META_FILE)

// The Pages mount: a temporary directory whose `sst` entry is a
// symlink to dist/ is the served tree — the tool derives each route
// relative to --dist, so the GRAFT PARENT is what it must see.
const mounted = mkdtempSync(join(tmpdir(), 'sst-check-nav-'))
symlinkSync(DIST_DIR, join(mounted, SITE.base.replace(/^\//, '')), 'dir')

// The direct dependency's install path (npm's node_modules layout
// exposes direct dependencies at the root; the package's exports map
// exposes no package.json to import-resolve).
const packageCheckNav = join(ROOT, 'node_modules', '@oimlsmart', 'site-shell', 'scripts', 'check-nav.mjs')
if (!existsSync(packageCheckNav)) {
  fail(`the shell package's check-nav is missing: ${packageCheckNav} — is @oimlsmart/site-shell installed?`)
}

const args = [packageCheckNav, MODEL_FILE, '--dist', mounted, '--origin', SITE.url, ...argv]
const run = spawnSync(process.execPath, args, { stdio: 'inherit' })
if (run.status === 0) {
  console.log(`sst check-nav: every nav entry checked against dist/ grafted at ${SITE.base} (the Pages mount).`)
}
process.exit(run.status ?? 1)
