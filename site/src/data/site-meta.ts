/**
 * The SMI Simulation site constants — the identity and origin values
 * the injected configs (brand, nav, footer) compose from (TODO.ia/03
 * item 6: the shell went machinery-only at 0.2.0, so the site carries
 * its own content). Data-only under plain node: the nav completeness
 * gate (scripts/check-nav.mjs, via the shell's check-nav) loads the
 * nav model through this module, so nothing here may import the
 * package's TypeScript source.
 */
export const SITE = {
  url: 'https://www.oimlsmart.org',
  base: '/sst',
  title: 'SMI Simulation',
  description:
    'The SMI Simulation — faithful, scriptable simulated twins of SMART Measuring Instruments, for training and integration without hardware.',
}
