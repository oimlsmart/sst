/**
 * The SMI Simulation nav model — the ordered items the house shell's
 * header, the mobile overlay, and the footer's Explore column render
 * (one model, injected through the layout's `nav` prop, TODO.ia/03
 * item 6). The shape is the package's NavModel contract
 * (@oimlsmart/site-shell/config). The file is data-only: the
 * active-path predicates ship with the package's config contract,
 * never from here.
 *
 * The model is the site's own information architecture: the story,
 * the documentation cone, and the demo stand as standalone links, and
 * the product CTA is the demo — the one thing a first-time visitor
 * came to try. Cross-site navigation is deliberately absent from the
 * top nav — it lives in the footer (the Programme column and the
 * hosts registry).
 *
 * Hrefs stay root-relative against the site's base; `origin`
 * absolutizes them at render, so the chrome's links resolve from any
 * host (ADR-0003).
 */
import type { NavModel } from '@oimlsmart/site-shell/config'
import { SITE } from './site-meta.ts'

// The relative import above carries an explicit .ts extension on
// purpose: the nav completeness gate (scripts/check-nav.mjs, via the
// shell's check-nav) loads this file under plain node's type
// stripping, which resolves relative specifiers literally — the
// extensionless house style would 404 it.

/** The minisite strip's sections — the site-local navigation under the
 *  federation header (hrefs resolve against the MinisiteNav base). */
export const MINISITE_SECTIONS = [
  { label: 'About', href: '/' },
  { label: 'Story', href: '/story' },
  { label: 'Docs', href: '/docs' },
  { label: 'Demo', href: '/demo' },
]

export const NAV_MODEL: NavModel = {
  // Front-door absolute at render (ADR-0003): the chrome's links
  // resolve from any origin.
  origin: SITE.url,
  items: [
    { type: 'link', label: 'Story', href: `${SITE.base}/story`, matchPrefix: `${SITE.base}/story` },
    { type: 'link', label: 'Docs', href: `${SITE.base}/docs/`, matchPrefix: `${SITE.base}/docs` },
  ],
  productCta: { label: 'Demo', href: `${SITE.base}/demo` },
}
