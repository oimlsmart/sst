// main.ts — the bench SPA entry: three panes wired to the sim.
// /world feeds the bench + dials + how-it-works; /twin feeds the
// indication display. Two channels, polled separately on purpose.
import { startPolling, type GroundTruth, type Indication } from './api.js'
import { mountTerminal } from './terminal.js'
import { mountBench, renderDials } from './bench.js'
import { renderHow } from './how-it-works.js'

const baseUrl = location.origin
const COEFFS: Record<string, number | string> = {
  compliance: '2.0e-6 mm/kg',
  creepCoefficient: '3.0e-4 (good-cell)',
  creepTauS: '300 s',
  tcZero: '1.0e-4 /°C',
  tcSpan: '2.0e-4 /°C',
  scaleInterval: '0.05 kg',
  filterTau: '1.0 s',
  warmUpTau: '60 s',
}

const bench = mountBench(document.getElementById('bench-canvas') as HTMLCanvasElement)
mountTerminal(document.getElementById('pane-terminal')!, baseUrl)
const howRoot = document.getElementById('how')!

let lastGt: GroundTruth | null = null
startPolling(baseUrl, 500, gt => {
  lastGt = gt
  bench?.render(gt)
  renderHow(howRoot, gt, COEFFS)
}, (ind: { indication: Indication; state: string }) => {
  if (lastGt) renderDials(lastGt, ind.indication)
})
