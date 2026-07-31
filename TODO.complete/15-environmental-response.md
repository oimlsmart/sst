# TODO 15 — Environmental-response layer (D 11 → physics)

**Priority:** P0   **Status:** ✅ done

## Goal

D 11 conditions currently set environment numbers but don't affect the instrument's physics. This TODO builds the layer that reads the base package's D 11 condition declarations + the instance's sensitivity coefficients and applies them continuously.

- **Influence quantities** (temperature, humidity, barometric, supply voltage) → continuous coefficient shifts
- **Disturbances** (bursts, surges, ESD, vibration, shock) → fault-latching events at scheduled timestamps

## Deliverables

- `packages/runtime/sst-runtime/src/environment/response.ts` — reads conditions + coefficients → applies effects
- `packages/runtime/sst-runtime/src/environment/profile-player.ts` — plays a D 11 profile and drives the response layer
- Integration with the stage composition: each stage receives `environment` + `condition` as inputs

## Acceptance criteria

- Playing `damp-heat-cyclic-db` visibly shifts the indication (humidity coefficient)
- Setting temperature to 60 °C shifts the indication via TC coefficients
- A burst event at t=300s causes the indication to glitch then recover
- The `stale-twin` scenario's freshness violation is caught
