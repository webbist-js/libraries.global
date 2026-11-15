import { Icon } from "@iconify/react"
import { normalizeMobileTimetable, summarizeTimetable } from "@repo/shared-data"
import { useTranslations } from "next-intl"

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
  const tExtra = useTranslations("libraryExtra")
  const tStatic = useTranslations("staticUi")

  if (!libraries.length) return null

  return (
    <section>
      <h2 className="type-h2">{tStatic("library.based_here")}</h2>
      <p style={{ color: T.ink.dim }}>
        {tStatic(
          "library.mobile_libraries_that_start_their_routes_from_this_library"
        )}
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
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold"
                style={{
                  background: TYPE_TINT.public.bg,
                  color: TYPE_TINT.public.fg,
                }}
              >
                <Icon aria-hidden="true" icon="mdi:bus-side" width={14} />
                {tStatic("common.mobileLibrary")}
              </span>
              <h3 className="type-h3 mt-3 mb-1">
                <Link
                  href={path}
                  className="no-underline hover:underline"
                  style={{ color: T.ink.base }}
                >
                  {library.name}
                </Link>
              </h3>
              <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
                {tExtra("mobileSummary", {
                  count: summary.stopCount,
                  weeks: summary.cycleWeeks,
                })}
              </p>
              <Link
                href={`${path}#stops`}
                className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                {tStatic("common.stopsTimes")}
              </Link>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
