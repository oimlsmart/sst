#!/usr/bin/env node
/**
 * The shell-pin leg (TODO.ia/03's acceptance: a shell release changes
 * every consumer deliberately, never silently). The site shell
 * (@oimlsmart/site-shell) rode a vendored checkout
 * (file:../vendor/site-shell, fetched at the shell's main in CI) until
 * this leg moved the site to the exact published pin: package.json
 * must carry an EXACT version (no range, no file:), and it must equal
 * npm's latest published release. A red here means the pin has fallen
 * behind a real published release and should move forward deliberately
 * (a version bump review, then the release's content lands here), or
 * someone moved the dependency off the exact pin, and both are this
 * repo's rot to fix.
 *
 * The leg exits 0 when the pin is exact and current, and exits 1 with
 * the two versions printed otherwise.
 */

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

function fail(message) {
  console.error(`::error::${message}`)
  process.exit(1)
}

function parseVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version || '')
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function isAhead(candidate, base) {
  for (let i = 0; i < 3; i++) {
    if (candidate[i] !== base[i]) return candidate[i] > base[i]
  }
  return false
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const spec = pkg.dependencies['@oimlsmart/site-shell']
if (spec === undefined) fail('package.json carries no @oimlsmart/site-shell dependency at all')
if (!/^\d+\.\d+\.\d+$/.test(spec)) {
  fail(`the house shell moved off an exact npm pin: package.json carries @oimlsmart/site-shell "${spec}", expected an exact "major.minor.patch" version`)
}

let latest
try {
  latest = execFileSync('npm', ['view', '@oimlsmart/site-shell', 'version'], { encoding: 'utf8' }).trim()
} catch {
  fail('npm view failed: the registry did not answer, so the pin cannot be judged')
}
const latestTriple = parseVersion(latest)
if (!latestTriple) fail(`npm's published channel carries an unparseable version "${latest}"`)

console.log(`pinned shell: ${spec} · npm latest: ${latest}`)
if (isAhead(latestTriple, parseVersion(spec))) {
  fail(`the shell pin is behind the published channel: npm carries ${latest}, package.json pins ${spec} — review the release and move the pin forward`)
}
console.log('the shell pin satisfies the published channel')
