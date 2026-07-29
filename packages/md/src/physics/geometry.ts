// geometry.ts — stage (a): the object + the transport, the reality the
// optical chain scans. A conveyor carries one object at a time through
// the measuring frame; the instrument sees the object only while it
// traverses (the beam-cutting entry/exit edges), and the measurement
// completes when the object has fully passed the scan plane.
//
// The R 129 measurand is the length, width and height of the SMALLEST
// ENCLOSING RECTANGULAR BOX of the object (R 129-1, 2.1.1). For a
// rectangular box that is the box itself; an irregular object is
// modelled as its nominal box plus one thin protrusion along the
// conveyor direction — the enclosing box grows by the protrusion, and
// whether the scanner RESOLVES the protrusion is a scanning-stage
// question (a protrusion thinner than the along-track sampling
// resolution falls between cross-sections: the sampled enclosing box
// under-reads, exactly the A.3.9 protrusion provision's prey).

export interface ConveyorObjectSpec {
  /** nominal body dimensions (cm) — reality, /world only. */
  lengthCm: number
  widthCm: number
  heightCm: number
  /** 'rectangular' | 'irregular' (R 129-1, 5.3's object capability). */
  shape: 'rectangular' | 'irregular'
  /** diffuse reflectance 0–1 (1 = shiny white, ~0.05 = matt black —
   *  the A.3.1 surface-colour test objects' span). */
  reflectance: number
  /** the thin protrusion on an irregular object (cm; 0 = none). */
  protrusionCm: number
  /** rotation about the vertical axis (deg) — the orientation-
   *  independence bench knob (R 129-1, A.4). */
  orientationDeg: number
}

/** The smallest enclosing rectangular box of the object (cm) — the
 *  R 129 measurand, reality side. */
export function enclosingBoxCm(spec: ConveyorObjectSpec): { l: number; w: number; h: number } {
  return {
    l: spec.lengthCm + (spec.shape === 'irregular' ? spec.protrusionCm : 0),
    w: spec.widthCm,
    h: spec.heightCm,
  }
}

/** Validate an authored object spec; throws with the first precise error. */
export function validateObjectSpec(spec: ConveyorObjectSpec): void {
  if (!(spec.lengthCm > 0)) throw new Error(`object length must be > 0, got ${spec.lengthCm}`)
  if (!(spec.widthCm > 0)) throw new Error(`object width must be > 0, got ${spec.widthCm}`)
  if (!(spec.heightCm > 0)) throw new Error(`object height must be > 0, got ${spec.heightCm}`)
  if (spec.shape !== 'rectangular' && spec.shape !== 'irregular') throw new Error(`object shape must be rectangular|irregular, got '${spec.shape}'`)
  if (!(spec.reflectance > 0 && spec.reflectance <= 1)) throw new Error(`object reflectance must be in (0, 1], got ${spec.reflectance}`)
  if (!(spec.protrusionCm >= 0)) throw new Error(`object protrusion must be ≥ 0, got ${spec.protrusionCm}`)
  if (spec.shape === 'rectangular' && spec.protrusionCm > 0) throw new Error('a rectangular object carries no protrusion (protrusionCm must be 0)')
}

/** One object in flight through the measuring frame. */
export interface Traversal {
  spec: ConveyorObjectSpec
  /** metres past the frame entrance — reality, /world only. */
  positionM: number
  /** the enclosing-box length along the conveyor (m). */
  lengthM: number
  /** virtual timestamp the object entered the frame. */
  entryS: number
}

export function beginTraversal(spec: ConveyorObjectSpec, atS: number): Traversal {
  validateObjectSpec(spec)
  return { spec: { ...spec }, positionM: 0, lengthM: enclosingBoxCm(spec).l / 100, entryS: atS }
}

/** Advance the object on the belt. */
export function advanceTraversal(t: Traversal, speedMS: number, dt: number): void {
  t.positionM += speedMS * dt
}

/** The measurement completes when the object has fully passed the scan
 *  plane (the exit edge crossed). */
export function traversalComplete(t: Traversal): boolean {
  return t.positionM >= t.lengthM
}

/** How long the object takes to traverse (s) — the scan window. */
export function traversalDurationS(spec: ConveyorObjectSpec, speedMS: number): number {
  return enclosingBoxCm(spec).l / 100 / speedMS
}
