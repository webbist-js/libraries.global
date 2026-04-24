"use client"

import { Icon } from "@iconify/react"

import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { WidgetTitle } from "@/components/library/LibraryInfoCards"
import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"
import { cn } from "@/lib/styles"

function ContentSection({
  title,
  children,
}: {
  readonly title: string
  readonly children: React.ReactNode
}) {
  return (
    <div className={cn(homepagePanelClassName, "p-5 sm:p-6")}>
      <WidgetTitle>{title}</WidgetTitle>
      {children}
    </div>
  )
}

// section="description" — renders only the About description block
// section="visit-info"  — renders only Visitor Information + admissionInfo
// omitted              — renders both
export function LibraryContent({
  library,
  section,
}: {
  readonly library: PopulatedLibraryData
  readonly section?: "description" | "visit-info"
}) {
  const showDescription = section !== "visit-info"
  const showVisitInfo = section !== "description"

  const hasDescription =
    showDescription &&
    Array.isArray(library.description) &&
    library.description.length > 0
  const hasVisitNotes =
    showVisitInfo &&
    Array.isArray(library.visitNotes) &&
    library.visitNotes.length > 0
  const hasAdmission = showVisitInfo && Boolean(library.admissionInfo)

  if (!hasDescription && !hasVisitNotes && !hasAdmission) return null

  return (
    <div className="space-y-4">
      {hasDescription ? (
        <ContentSection title="About">
          <StrapiBlocksContent
            blocks={
              library.description as Parameters<
                typeof StrapiBlocksContent
              >[0]["blocks"]
            }
          />
        </ContentSection>
      ) : null}

      {hasVisitNotes || hasAdmission ? (
        <ContentSection title="Visitor Information">
          {hasAdmission ? (
            <p className="mb-4 rounded-lg border border-white/8 bg-white/4 px-4 py-3 text-sm leading-6 text-white/72">
              <Icon
                icon="mdi:ticket-outline"
                className="mr-1.5 inline size-3.5 align-text-top text-white/46"
              />
              {library.admissionInfo}
            </p>
          ) : null}
          {hasVisitNotes ? (
            <StrapiBlocksContent
              blocks={
                library.visitNotes as Parameters<
                  typeof StrapiBlocksContent
                >[0]["blocks"]
              }
            />
          ) : null}
        </ContentSection>
      ) : null}
    </div>
  )
}

LibraryContent.displayName = "LibraryContent"

export default LibraryContent
