import { Icon } from "@iconify/react"
import { normalizeMobileTimetable, summarizeTimetable } from "@repo/shared-data"

import { Card } from "@/components/ds"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

type BasedMobile = {
  documentId: string
  name?: string | null
  slug?: string | null
  mobileTimetable?: unknown
  continent?: { slug?: string | null } | null
  country?: { slug?: string | null } | null
  region?: { slug?: string | null } | null
}

export function LibrariesOnTheMove({
  libraries,
}: {
  libraries: readonly BasedMobile[]
}) {
  if (!libraries.length) return null

  return (
    <section>
      <h2 className="text-3xl" style={{ fontFamily: T.font.serif }}>
        Based here
      </h2>
      <p style={{ color: T.ink.dim }}>
        Mobile libraries that start their routes from this library.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {libraries.map((library) => {
          const summary = summarizeTimetable(
            normalizeMobileTimetable(library.mobileTimetable)
          )
          const parts = [
            library.continent?.slug,
            library.country?.slug,
            library.region?.slug,
            library.slug,
          ]
          const path = parts.every(Boolean)
            ? `/${parts.join("/")}`
            : `/libraries?q=${encodeURIComponent(library.name ?? "")}`

          return (
            <Card key={library.documentId} className="p-5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold"
                style={{
                  background: TYPE_TINT.public.bg,
                  color: TYPE_TINT.public.fg,
                }}
              >
                <Icon aria-hidden="true" icon="mdi:bus-side" width={14} />
                Mobile library
              </span>
              <h3
                className="mt-3 mb-1 text-[22px] leading-tight"
                style={{ fontFamily: T.font.serif, fontWeight: 500 }}
              >
                <Link
                  href={path}
                  className="no-underline hover:underline"
                  style={{ color: T.ink.base }}
                >
                  {library.name}
                </Link>
              </h3>
              <p className="m-0 text-[14.5px]" style={{ color: T.ink.dim }}>
                {summary.stopCount} {summary.stopCount === 1 ? "stop" : "stops"}{" "}
                · {summary.cycleWeeks}-week cycle
              </p>
              <Link
                href={`${path}#stops`}
                className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                Stops and times
              </Link>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
