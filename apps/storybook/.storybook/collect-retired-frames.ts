import { afterAll } from "vitest"

/**
 * Each story file renders in a fresh frame and the retired frames are only
 * reclaimed by a full garbage collection. Their DOM and rendering memory sits
 * outside the JavaScript heap, so the engine does not schedule one in time: on
 * CI the renderer grew by about 20 MB per story file until it crashed near
 * 4 GB partway through a shard. Collecting after each file keeps it level.
 * Needs the `--expose-gc` flag set in vitest.config.ts.
 */
afterAll(() => {
  ;(globalThis as { gc?: () => void }).gc?.()
})
