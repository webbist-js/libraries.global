// Small copy helpers shared by the staff area and the mobile library page.
// Pure, so server and client components use the same words.

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const dayMillis = (date: string) => Date.parse(`${date}T00:00:00Z`)

/** "Today", "Tomorrow", a weekday within the week, else "Wed 14 Oct". */
export function weekdayCopy(date: string, today: string): string {
  const diff = Math.round((dayMillis(date) - dayMillis(today)) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  const parsed = new Date(dayMillis(date))
  const weekday = DAY_NAMES[(parsed.getUTCDay() + 6) % 7] ?? date
  if (diff > 1 && diff < 7) return weekday

  return `${weekday.slice(0, 3)} ${parsed.getUTCDate()} ${MONTHS[parsed.getUTCMonth()]}`
}

/** "Tue 6 Oct" from a calendar date. */
export function shortDate(date: string): string {
  const parsed = new Date(dayMillis(date))
  if (Number.isNaN(parsed.getTime())) return date

  return `${(DAY_NAMES[(parsed.getUTCDay() + 6) % 7] ?? "").slice(0, 3)} ${parsed.getUTCDate()} ${MONTHS[parsed.getUTCMonth()]}`
}

/** "Tuesday" from a calendar date. */
export function weekdayName(date: string): string {
  const parsed = new Date(dayMillis(date))
  if (Number.isNaN(parsed.getTime())) return date

  return DAY_NAMES[(parsed.getUTCDay() + 6) % 7] ?? date
}

/** "just now", "4 hours ago", "9 months ago": how long since an ISO stamp. */
export function timeAgo(iso: string, now = new Date()): string {
  const ms = now.getTime() - Date.parse(iso)
  if (!Number.isFinite(ms)) return ""
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.round(hours / 24)
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`
  const months = Math.round(days / 30.4)
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`
  const years = Math.round(months / 12)

  return `${years} year${years === 1 ? "" : "s"} ago`
}

/** "Good morning", "Good afternoon" or "Good evening" for a local hour. */
export function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"

  return "Good evening"
}

/** A health row's note, as the designs say it: ages, not dates. */
export function healthNote(note: string, now = new Date()): string {
  const checked = /^Checked (\d{4}-\d{2}-\d{2})/.exec(note)
  if (checked) return `Checked ${timeAgo(`${checked[1]}T12:00:00Z`, now)}`
  if (note === "Not added") return "None yet"

  return note
}
