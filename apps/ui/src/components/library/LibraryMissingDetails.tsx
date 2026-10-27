import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { toLatLng } from "@/components/library/library-page.helpers"
import type { libraryPresentation } from "@/components/library/library-presentation"
import { OpenCorrectionLink } from "@/components/library/LibraryCorrection"
import { LibraryEventsEmptyAction } from "@/components/library/LibraryEventsEmptyAction"
import {
  LIB_ICONS,
  LibrarySectionCard,
} from "@/components/library/LibrarySectionCard"
import { T } from "@/lib/design-tokens"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

export function LibraryMissingDetails({
  library,
  missing,
  addHref,
}: {
  readonly library: PopulatedLibraryData
  readonly missing: ReturnType<typeof libraryPresentation>["missing"]
  readonly addHref: string
}) {
  const t = useTranslations("libraryPage")
  if (!missing.length) return null
  const needsLocation = !toLatLng(library.location)
  const categories = {
    about: "Collections",
    transport: "Address or location",
    admission: "Something else",
  }

  return (
    <LibrarySectionCard
      id="missing"
      title={t("notRecorded")}
      iconPath={LIB_ICONS.pencil}
    >
      <p
        className="m-0 mb-4 text-sm leading-relaxed"
        style={{ color: T.ink.dim }}
      >
        {t("missingIntro")}
      </p>
      <ul className="m-0 list-none divide-y divide-(--t-border-line) p-0">
        {missing.map((key) => (
          <li
            key={key}
            className="grid gap-x-5 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div>
              <h3 className="type-h3 m-0">{t(`missing.${key}.title`)}</h3>
              <p
                className="m-0 mt-1 text-sm leading-relaxed"
                style={{ color: T.ink.dim }}
              >
                {key === "nearby" && needsLocation
                  ? t("missing.nearby.locationDescription")
                  : t(`missing.${key}.description`)}
              </p>
            </div>
            {key === "events" ? (
              <LibraryEventsEmptyAction
                documentId={library.documentId}
                librarySlug={library.slug ?? ""}
                libraryName={library.name ?? ""}
              />
            ) : key === "nearby" && needsLocation ? (
              <OpenCorrectionLink
                category="Address or location"
                className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
              >
                {t("missing.nearby.locationAction")}
              </OpenCorrectionLink>
            ) : key === "nearby" ? (
              <GlobalLink
                href={addHref}
                className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
              >
                {t("addLibrary")}
              </GlobalLink>
            ) : (
              <OpenCorrectionLink
                category={categories[key]}
                className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
              >
                {t(`missing.${key}.action`)}
              </OpenCorrectionLink>
            )}
          </li>
        ))}
      </ul>
    </LibrarySectionCard>
  )
}
