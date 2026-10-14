/** Count visible time and body progress within one consented article view. */
export function createReadingTracker(start: number) {
  let last = start
  let wasVisible = false
  let visibleTime = 0
  let reached = false
  let sent = false

  return (now: number, visible: boolean, progress: number): boolean => {
    if (wasVisible) visibleTime += Math.max(0, now - last)
    last = now
    wasVisible = visible
    if (visible && progress >= 0.75) reached = true
    if (sent || !visible || !reached || visibleTime < 30_000) return false
    sent = true

    return true
  }
}
