export type CoverageSourceRow = { total: number; countries: readonly number[] }
export type CoverageTimelineRow = CoverageSourceRow & {
  index: number
  start: number
  end: number
  stepDuration: number
  remainder: number
}
export const COVERAGE_ROW_PAUSE = 240

/** One continent owns the timeline at a time. A country fills before the next
 * starts; the total is the sum of the exact same animated integer counts. */
export function coverageTimeline(rows: readonly CoverageSourceRow[]) {
  let cursor = 160

  return rows.flatMap((row, index) => {
    const sum = row.countries.reduce((total, count) => total + count, 0)
    if (
      !Number.isFinite(row.total) ||
      row.total <= 0 ||
      row.countries.some((count) => !Number.isFinite(count) || count < 0) ||
      sum > row.total
    )
      return []
    const remainder = row.total - sum
    const steps = row.countries.length + (remainder > 0 ? 1 : 0)
    const stepDuration = Math.max(180, 720 / Math.max(1, steps))
    const start = cursor
    const end = start + steps * stepDuration
    cursor = end + COVERAGE_ROW_PAUSE

    return [{ ...row, index, remainder, stepDuration, start, end }]
  })
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

/** Shared --motion-ease-out: cubic-bezier(0.22, 1, 0.36, 1). */
export function coverageEase(progress: number) {
  const value = clamp(progress)
  if (value === 0 || value === 1) return value
  let low = 0,
    high = 1
  for (let iteration = 0; iteration < 12; iteration++) {
    const t = (low + high) / 2
    const x = 3 * (1 - t) ** 2 * t * 0.22 + 3 * (1 - t) * t ** 2 * 0.36 + t ** 3
    if (x < value) low = t
    else high = t
  }

  return 1 - (1 - (low + high) / 2) ** 3
}

export function coverageFrame(row: CoverageTimelineRow, elapsed: number) {
  const local = elapsed - row.start
  const countries = row.countries.map((target, index) => {
    const time = local - index * row.stepDuration
    const progress = coverageEase(time / row.stepDuration)

    return {
      value: Math.floor(target * progress),
      progress,
      reveal: coverageEase(time / 180),
    }
  })
  const tail = coverageEase(
    (local - row.countries.length * row.stepDuration) / row.stepDuration
  )

  return {
    countries,
    total:
      countries.reduce((sum, country) => sum + country.value, 0) +
      Math.floor(row.remainder * tail),
    state:
      elapsed < row.start
        ? "queued"
        : elapsed < row.end
          ? "active"
          : "complete",
  }
}
