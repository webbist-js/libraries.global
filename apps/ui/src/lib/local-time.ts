/**
 * Local wall-clock time in an IANA zone, shared by the "Open now" filter
 * (lib/find-search.ts) and the cards' open badge (find-helpers `openStatus`)
 * so both read the clock the same way.
 */
/** The weekday ("mon"…"sun") and minute after local midnight in a zone. */
export function localDayMinute(
  timeZone: string,
  now: Date
): { day: string; minute: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now)
    const get = (type: string) => parts.find((p) => p.type === type)?.value
    const day = get("weekday")?.toLowerCase().slice(0, 3)
    if (!day) return null

    return { day, minute: Number(get("hour")) * 60 + Number(get("minute")) }
  } catch {
    return null
  }
}
