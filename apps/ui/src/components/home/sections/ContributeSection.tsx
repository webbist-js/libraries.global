import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { ContributionActions } from "@/components/home/ContributionActions"
import { DriveCarousel } from "@/components/home/DriveCarousel"
import Emphasis from "@/components/home/Emphasis"
import { homepageLinkAttributes } from "@/components/home/homepage.analytics"
import type {
  ContributionTask,
  CtaBand,
  SectionIntro,
  Step,
} from "@/components/home/homepage.types"
import { HomeDriveCard } from "@/components/home/sections/HomeDriveCard"
import type { DriveView } from "@/lib/drives/drive-view"
import type { IncompleteLibrary } from "@/lib/strapi-api/content/server"

/** Keyed by the record completeness sections, in task priority order. */
const TASK_COPY: Record<string, string> = {
  facilities: "Missing accessibility information",
  photo: "Needs a photo",
  hours: "Opening hours not added",
  contact: "No website or contact details",
  about: "Collections not described",
  history: "Founding date unknown",
  address: "Street address missing",
  location: "Not pinned on the map",
}

const PRIORITY = Object.keys(TASK_COPY)

/** One task per record, preferring a different kind of gap on each card so
 * the section shows the range of small things anyone can add. */
export function pickTasks(
  records: readonly IncompleteLibrary[],
  limit: number
): ContributionTask[] {
  const used = new Set<string>()
  const tasks: ContributionTask[] = []
  for (const record of records) {
    if (tasks.length >= limit) break
    const known = PRIORITY.filter((key) => record.missing.includes(key))
    const missingKey = known.find((key) => !used.has(key)) ?? known[0]
    if (!missingKey) continue
    used.add(missingKey)
    tasks.push({
      documentId: record.documentId,
      slug: record.slug,
      name: record.name,
      place: record.place,
      missingKey,
    })
  }

  return tasks
}

function taskHref(task: ContributionTask): string {
  return `/contribute/correct/${task.slug}?libraryName=${encodeURIComponent(task.name)}`
}

/** A free-account invitation beside real, open community work. */
export function ContributeSection({
  band,
  steps,
  tasksIntro,
  tasks,
  drives,
}: {
  readonly band: CtaBand
  readonly steps: readonly Step[]
  readonly tasksIntro: SectionIntro
  readonly tasks: readonly ContributionTask[]
  readonly drives: readonly DriveView[]
}) {
  const t = useTranslations("homepageContribute")

  return (
    <section
      id="contribute"
      aria-labelledby="contribute-title"
      data-homepage-surface="paper"
      className="home-frame home-split home-contribute"
    >
      <div>
        <p className="home-kicker">{t("eyebrow")}</p>
        <h2 id="contribute-title" className="type-display-band font-semibold">
          <Emphasis text={band.title ?? ""} />
        </h2>
        <p className="home-section-copy">{band.text}</p>
        <ol className="home-contribution-steps">
          {steps
            .filter((step) => step.title)
            .map((step, index) => (
              <li key={step.title}>
                <span aria-hidden="true">{index + 1}</span>
                {step.title}
              </li>
            ))}
        </ol>
        <ContributionActions
          memberLabel={band.primaryLabel}
          memberHref={band.primaryHref}
          secondaryAction={
            <GlobalLink
              href={band.secondaryHref ?? "/contribute/index/new"}
              className="home-button home-button-paper"
            >
              {band.secondaryLabel ?? "Add a library"}
            </GlobalLink>
          }
        />
        <div className="home-contribution-help">
          <GlobalLink
            href="/contribute/index"
            {...homepageLinkAttributes("/contribute/index")}
            className="home-text-link"
          >
            {t("suggestCorrection")}
          </GlobalLink>
          <GlobalLink
            href="/knowledge/governance/how-review-works"
            {...homepageLinkAttributes(
              "/knowledge/governance/how-review-works"
            )}
            className="home-text-link"
          >
            {t("howReviewWorks")}
          </GlobalLink>
        </div>
      </div>
      <div className="home-contribution-work">
        {drives.length ? (
          <>
            <div className="home-drive-heading">
              <h3 className="type-h3">{t("openDrives")}</h3>
              <GlobalLink
                href="/community"
                {...homepageLinkAttributes("/community")}
                className="home-text-link"
              >
                {t("allDrives")}
              </GlobalLink>
            </div>
            <p className="home-drive-intro">{t("driveIntro")}</p>
            <DriveCarousel label={t("openDrives")}>
              {drives.map((view, index) => (
                <HomeDriveCard
                  key={view.drive.documentId}
                  view={view}
                  index={index + 1}
                />
              ))}
            </DriveCarousel>
          </>
        ) : (
          <div className="home-task-card">
            <h3 className="home-kicker">
              {tasksIntro.title ?? "Open tasks right now"}
            </h3>
            <ul className="home-link-rows">
              {tasks.length ? (
                tasks.map((task) => (
                  <li key={task.documentId}>
                    <GlobalLink href={taskHref(task)}>
                      <span>
                        {task.name}
                        <small>
                          {TASK_COPY[task.missingKey]} · {task.place}
                        </small>
                      </span>
                    </GlobalLink>
                  </li>
                ))
              ) : (
                <li>
                  <GlobalLink
                    href="/contribute/index/new"
                    {...homepageLinkAttributes("/contribute/index/new")}
                  >
                    Add a missing library <Plus aria-hidden="true" size={18} />
                  </GlobalLink>
                </li>
              )}
            </ul>
            <GlobalLink
              href="/contribute"
              {...homepageLinkAttributes("/contribute")}
              className="home-text-link"
            >
              All ways to contribute
            </GlobalLink>
          </div>
        )}
      </div>
    </section>
  )
}

export default ContributeSection
