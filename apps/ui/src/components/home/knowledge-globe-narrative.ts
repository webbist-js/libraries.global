export type GlobeNarrativeState = {
  progress: number
  focus: number
  step: number
  growth: number
  /** Viewport-normalized visual centre; right/up are positive. */
  frameX: number
  frameY: number
  /** Relative to the shared globe's default fitted diameter. */
  frameScale: number
  /** Measured visual-slot width divided by height. */
  frameAspect: number
  /** 0 keeps the dark globe palette; 1 draws ink on paper. */
  paper: number
  opacity: number
}

export type GlobeNarrativeController = {
  current: GlobeNarrativeState
  set: (patch: Partial<GlobeNarrativeState>) => void
  subscribe: (listener: () => void) => () => void
}

/** A small mutable signal shared by scroll, DOM controls and the canvas.
 * Subscriptions request a frame; shader updates read current values directly. */
export function createGlobeNarrative(
  initial: Partial<GlobeNarrativeState> = {}
): GlobeNarrativeController {
  const current: GlobeNarrativeState = {
    progress: 0,
    focus: 0,
    step: 0,
    growth: 0,
    frameX: 0,
    frameY: 0,
    frameScale: 1,
    frameAspect: 1,
    paper: 0,
    opacity: 1,
  }
  const listeners = new Set<() => void>()
  const controller: GlobeNarrativeController = {
    current,
    set(patch) {
      let changed = false
      for (const key of Object.keys(patch) as (keyof GlobeNarrativeState)[]) {
        const value = patch[key]
        if (value === undefined || !Number.isFinite(value)) continue
        const bounds = NARRATIVE_BOUNDS[key]
        if (!bounds) continue
        const next = Math.min(bounds[1], Math.max(bounds[0], value))
        if (current[key] === next) continue
        current[key] = next
        changed = true
      }
      if (changed) listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
  }
  controller.set(initial)

  return controller
}

const NARRATIVE_BOUNDS: Record<
  keyof GlobeNarrativeState,
  readonly [number, number]
> = {
  progress: [0, 6],
  focus: [0, 5],
  step: [0, 6],
  growth: [0, 1],
  // Measured slots can move outside the viewport during document scrolling.
  frameX: [-2, 2],
  frameY: [-3, 3],
  frameScale: [0.05, 3],
  frameAspect: [0.25, 4],
  paper: [0, 1],
  opacity: [0, 1],
}
