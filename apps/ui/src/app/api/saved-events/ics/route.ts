import { SITE_NAME } from "@/lib/constants"
import { savedEventsBridgeHeaders, STRAPI } from "@/lib/saved-events-bridge"

const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

export async function GET() {
  const bridge = await savedEventsBridgeHeaders()
  if (!bridge) return new Response("Unauthorized", { status: 401 })

  // Fetch user's saved event IDs
  const savedRes = await fetch(`${STRAPI}/api/saved-events`, {
    headers: bridge,
    cache: "no-store",
  })
  if (!savedRes.ok) return new Response("Error", { status: 500 })

  const saved = (await savedRes.json()) as {
    documentId: string
    eventDocumentId: string
  }[]

  if (saved.length === 0) {
    const empty = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//libraries.global//Events//EN",
      `X-WR-CALNAME:My Saved Events — ${SITE_NAME}`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "END:VCALENDAR",
    ].join("\r\n")

    return new Response(empty, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="my-saved-events.ics"',
      },
    })
  }

  // Fetch full event data for each saved event
  const eventResults = await Promise.all(
    saved.map(({ eventDocumentId }) =>
      fetch(`${STRAPI}/api/events/event/${eventDocumentId}`, {
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      }).then((r) => (r.ok ? r.json() : null))
    )
  )

  const events = eventResults.filter(Boolean) as {
    documentId: string
    title: string
    description?: string | null
    startTime: string
    endTime?: string | null
    allDay?: boolean
    url?: string | null
    libraryEntityRef?: string | null
  }[]

  // Build ICS inline (no shared dependency on Strapi plugin)
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//libraries.global//Events//EN",
    `X-WR-CALNAME:My Saved Events — ${SITE_NAME}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flatMap((e) => {
      const startProp = e.allDay ? "DTSTART;VALUE=DATE" : "DTSTART"
      const endProp = e.allDay ? "DTEND;VALUE=DATE" : "DTEND"
      const esc = (s: string) =>
        s
          .replaceAll("\\", "\\\\")
          .replaceAll(";", String.raw`\;`)
          .replaceAll(",", String.raw`\,`)
          .replaceAll("\n", String.raw`\n`)
      const dt = (iso: string) => {
        const d = new Date(iso)
        if (e.allDay)
          return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`

        return d.toISOString().replaceAll(/[-:]/g, "").slice(0, 15) + "Z"
      }

      return [
        "BEGIN:VEVENT",
        `UID:${e.documentId}@libraries.global`,
        `SUMMARY:${esc(e.title)}`,
        `${startProp}:${dt(e.startTime)}`,
        ...(e.endTime ? [`${endProp}:${dt(e.endTime)}`] : []),
        ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
        ...(e.url ? [`URL:${e.url}`] : []),
        ...(e.libraryEntityRef ? [`LOCATION:${esc(e.libraryEntityRef)}`] : []),
        "END:VEVENT",
      ]
    }),
    "END:VCALENDAR",
  ]

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="my-saved-events.ics"',
    },
  })
}
