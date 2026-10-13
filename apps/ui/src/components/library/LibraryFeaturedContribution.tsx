"use client"

import { normalizeMobileTimetable, sectionCheckedAt } from "@repo/shared-data"

import { FeaturedContribution } from "@/components/contribute/FeaturedContribution"
import { hubHref } from "@/components/contribute/wizard.logic"
import GlobalLink from "@/components/global/GlobalLink"
import { useCorrectionDrawer } from "@/components/library/LibraryCorrection"
import { LibraryDriveNote } from "@/components/library/LibraryDriveNote"
import { timetablePresentation } from "@/components/mobile/timetable-presentation"
import { useMobileClock } from "@/components/mobile/useMobileClock"
import { T } from "@/lib/design-tokens"

export function LibraryFeaturedContribution({
  library,
  unanswered,
  hasHours,
  hasPhoto,
  path,
}: {
  readonly library: {
    documentId: string
    slug: string
    name: string
    libraryType?: string | null
    verifiedSections?: unknown
    lastVerifiedAt?: unknown
    city?: string | null
    website?: string | null
    mobileTimetable?: unknown
    timezone?: string | null
  }
  readonly unanswered: number
  readonly hasHours: boolean
  readonly hasPhoto: boolean
  readonly path: string
}) {
  const { open, verify } = useCorrectionDrawer()
  const mobile = library.libraryType === "Mobile"
  const stamp = sectionCheckedAt(library, "hours")
  const now = useMobileClock()
  const staleHours =
    !stamp ||
    Boolean(now && now.getTime() - Date.parse(stamp) > 730 * 86_400_000)
  const digital = library.libraryType === "Digital"
  const timetable = normalizeMobileTimetable(library.mobileTimetable)
  const presentation =
    mobile && timetable && now
      ? timetablePresentation(timetable, [], now, library.timezone ?? "UTC")
      : null
  const scheduleNeedsWork =
    !digital &&
    (mobile
      ? !hasHours || Boolean(presentation?.expired || presentation?.warning)
      : !hasHours || staleHours)
  const ask =
    unanswered && !(mobile && scheduleNeedsWork)
      ? {
          title: `${unanswered === 1 ? "One accessibility question is" : `${unanswered} accessibility questions are`} unanswered here`,
          description: `${unanswered} access details are not recorded. Answer one you know; an explicit No is useful too.`,
          href: "#access",
          label: `Answer ${unanswered === 1 ? "one question" : `${unanswered} questions`}`,
        }
      : scheduleNeedsWork
        ? {
            title: hasHours
              ? `Are these ${mobile ? "stops and times" : "hours"} still right?`
              : `Add ${mobile ? "stops and times" : "opening hours"}`,
            description: hasHours
              ? "Check the published schedule against a current source, then confirm it or suggest a change."
              : "A current schedule helps people choose when to visit. Add what the library publishes, with a source.",
            label: hasHours ? "Confirm the schedule" : "Add the schedule",
            category: mobile ? "Stops & times" : "Opening hours",
          }
        : unanswered
          ? {
              title: `Document access aboard ${library.name}`,
              description:
                "Answer an onboard access question you know. An explicit No is useful too.",
              href: "#access",
              label: "Answer an access question",
            }
          : !hasPhoto
            ? {
                title: `Show visitors ${library.name}`,
                description:
                  "Share a photo you took or may publish under the contribution licence.",
                label: "Share a photo",
                href: hubHref("photo", library),
              }
            : {
                title: `Keep ${library.name}'s record current`,
                description:
                  "Spotted a changed detail? Send the correction with a source.",
                label: "Suggest a correction",
                category: "Something else",
              }
  const actionClass =
    "inline-flex min-h-12 items-center rounded-full px-5 text-sm font-semibold text-white"
  const action =
    "href" in ask ? (
      <GlobalLink
        href={ask.href!}
        className={actionClass}
        style={{ background: T.accent.primary }}
      >
        {ask.label}
      </GlobalLink>
    ) : (
      <button
        type="button"
        className={actionClass}
        style={{ background: T.accent.primary }}
        onClick={() =>
          ask.category === "Opening hours" || ask.category === "Stops & times"
            ? hasHours
              ? verify(["hours"])
              : open(ask.category)
            : open(ask.category)
        }
      >
        {ask.label}
      </button>
    )

  return (
    <LibraryDriveNote
      library={{ ...library, href: path }}
      featured
      fallback={
        <FeaturedContribution
          title={ask.title}
          description={ask.description}
          action={action}
          steps={
            "href" in ask && ask.href === "#access"
              ? [
                  "Answer Yes, No or Not sure. One answer is enough.",
                  "{sign-in}",
                  "A reviewer checks it before it appears here.",
                ]
              : undefined
          }
          alternatives={[
            {
              title: "Suggest a correction",
              href: hubHref("correction", library),
              description: "Changed details are checked against your source.",
            },
            {
              title: "Share a photo",
              href: hubHref("photo", library),
              description: "Use your own or an openly licensed photo.",
            },
            {
              title: mobile ? "Check stops and times" : "Check opening hours",
              href: hubHref(
                "correction",
                library,
                mobile ? "Stops & times" : "Opening hours"
              ),
              description: "A current schedule helps visitors plan ahead.",
            },
          ].filter((item) => !("href" in ask) || item.href !== ask.href)}
        />
      }
    />
  )
}
