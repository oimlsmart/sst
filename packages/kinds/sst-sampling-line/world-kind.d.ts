// sst-sampling-line world-kind.d.ts — the typed args for each mutation
// declared in world-kind.sdl.graphql. The runtime's world-schema assembler
// binds these to the kind handlers.

export interface SetFlowRateArgs { lPerMin: number }
export interface SetLineTemperatureArgs { degC: number }
export interface IntroduceLeakArgs { fraction: number }
export interface SetInletCompositionArgs {
  coPpm?: number
  noxPpm?: number
  no2Fraction?: number
  co2PercentVol?: number
  h2oPercentVol?: number
}
