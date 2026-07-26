// api.ts — the bench's channel client: /world for reality (the bench
// scene, the console), /twin for the instrument's legal view (the
// indication display). The two are polled separately ON PURPOSE —
// the epistemic split stays visible in the data flow.
export interface GroundTruth {
  appliedLoadKg: number
  strainMm: number
  clockS: number
  spanDriftFraction: number
  environment: { temperatureDegC: number; humidityPercentRh: number; pressureKPa: number }
}
export interface Indication { value: number; unit: string; kind: string; servedAt: number }

const GT_QUERY = `{ groundTruth { appliedLoadKg strainMm clockS spanDriftFraction environment { temperatureDegC humidityPercentRh pressureKPa } } }`
const IND_QUERY = `{ indication { value unit kind servedAt } state }`

export async function gql(baseUrl: string, channel: '/world' | '/twin', query: string): Promise<unknown> {
  const res = await fetch(`${baseUrl}${channel}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  })
  const body = await res.json() as { data?: unknown; errors?: unknown }
  return body.data ?? body
}

export async function fetchGroundTruth(baseUrl: string): Promise<GroundTruth> {
  const d = await gql(baseUrl, '/world', GT_QUERY) as { groundTruth: GroundTruth }
  return d.groundTruth
}

export async function fetchIndication(baseUrl: string): Promise<{ indication: Indication; state: string }> {
  return await gql(baseUrl, '/twin', IND_QUERY) as { indication: Indication; state: string }
}

/** Poll both channels at the given cadence; returns the stopper. */
export function startPolling(
  baseUrl: string, intervalMs: number,
  onTruth: (gt: GroundTruth) => void,
  onIndication: (i: { indication: Indication; state: string }) => void,
): () => void {
  let stopped = false
  const tick = async () => {
    if (stopped) return
    try { onTruth(await fetchGroundTruth(baseUrl)) } catch { /* sim down — keep polling */ }
    try { onIndication(await fetchIndication(baseUrl)) } catch { /* placeholder twin pre-C3 */ }
    if (!stopped) setTimeout(() => void tick(), intervalMs)
  }
  void tick()
  return () => { stopped = true }
}
