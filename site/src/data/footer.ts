/**
 * The SMI Simulation footer config — the content the site injects
 * into the house shell's footer frame (TODO.ia/03 item 6). The shape
 * is the package's FooterConfig (@oimlsmart/site-shell/config); the
 * Explore column is NOT here — the footer derives it from the nav
 * model. Cross-site navigation rides this config (the Programme
 * column and the hosts registry), never the top nav. The hosts list
 * is the federation's canonical registry — the same list every site
 * renders — and the attribution stays footer-class attribution, never
 * promotion.
 */
import type { FooterConfig } from '@oimlsmart/site-shell/config'
import { SITE } from './site-meta'

export const FOOTER: FooterConfig = {
  origin: SITE.url,
  description:
    'Faithful, scriptable simulated twins of SMART Measuring Instruments, so testers rehearse the workflow and developers integrate without hardware.',
  columns: [
    {
      heading: 'Programme',
      links: [
        { label: 'About OIML SMART', href: '/about/what-is-smart' },
        { label: 'Contact', href: '/about/contact' },
        { label: 'Service status', href: 'https://status.oimlsmart.org' },
        { label: 'GitHub', href: 'https://github.com/oimlsmart', external: true, icon: 'github' },
      ],
    },
  ],
  hosts: [
    { label: 'Public site', href: 'https://www.oimlsmart.org' },
    { label: 'Platform', href: 'https://platform.oimlsmart.org' },
    { label: 'Demo', href: 'https://demo.oimlsmart.org' },
    { label: 'Identity', href: 'https://id.oimlsmart.org' },
    { label: 'Status', href: 'https://status.oimlsmart.org' },
    { label: 'Ommisa', href: 'https://www.ommisa.org' },
    { label: 'Primmel', href: 'https://www.primmel.org' },
    { label: 'Studio', href: 'https://www.oimlsmart.org/studio/' },
  ],
  attribution: [
    'A programme of the ',
    { label: 'International Organization of Legal Metrology', href: 'https://www.oiml.org', external: true },
    ', delivered by ',
    { label: 'Ribose', href: 'https://www.ribose.com', external: true },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ],
  copyright: 'Content © OIML · Code © Ribose',
}
