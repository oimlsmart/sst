// api.ts — the bench's channel client: /world for reality (the bench
// scene, the console), /twin for the instrument's legal view (the
// indication display). The two are polled separately ON PURPOSE —
// the epistemic split stays visible in the data flow.
//
// The world-token knob (TODO.v2/11): when the sim guards /world
// (SIM_WORLD_TOKEN set), the operator supplies the token once — the
// terminal pane prompts on the first rejected mutation. It rides
// sessionStorage (tab-scoped, never persisted) and attaches to
// /world requests only. Unset → no header, the zero-config path.
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

const WORLD_TOKEN_KEY = 'sim.worldToken'

function store(): Storage | undefined {
  try { return typeof sessionStorage === 'undefined' ? undefined : sessionStorage } catch { return undefined }
}

export function worldToken(): string | undefined {
  return store()?.getItem(WORLD_TOKEN_KEY) ?? undefined
}

export function setWorldToken(token: string): void {
  store()?.setItem(WORLD_TOKEN_KEY, token)
}

export function clearWorldToken(): void {
  store()?.removeItem(WORLD_TOKEN_KEY)
}

/** Did the sim reject this response as unauthorized (the 401 the
 *  /world guard answers with)? gql() unwraps data, so a rejected call
 *  surfaces here as the raw `{ errors }` body. */
export function isUnauthorized(result: unknown): boolean {
  const errors = (result as { errors?: Array<{ extensions?: { code?: string } }> } | null)?.errors
  return errors?.some(e => e.extensions?.code === 'UNAUTHORIZED') ?? false
}

export async function gql(baseUrl: string, channel: '/world' | '/twin', query: string): Promise<unknown> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const token = channel === '/world' ? worldToken() : undefined
  if (token) headers['authorization'] = `Bearer ${token}`
  const res = await fetch(`${baseUrl}${channel}`, {
    method: 'POST', headers, body: JSON.stringify({ query }),
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
