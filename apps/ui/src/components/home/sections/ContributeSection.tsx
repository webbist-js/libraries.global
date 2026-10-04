import {
  type LucideIcon,
  Accessibility,
  BookOpen,
  Camera,
  Clock,
  Globe,
  History,
  MapPin,
  Plus,
  Star,
} from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
import { displayStyle } from "@/components/home/homepage.constants"
import type {
  ContributionTask,
  CtaBand,
  SectionIntro,
  Step,
} from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"
import type { IncompleteLibrary } from "@/lib/strapi-api/content/server"

type TaskCopy = {
  label: string
  action: string
  Icon: LucideIcon
  tint: { bg: string; fg: string }
}

const GREEN = { bg: "#E6EFE6", fg: "#2F5D3A" }
const RUST = { bg: "#F6E3DA", fg: "#8A3F22" }
const BLUE = { bg: "#E4ECF5", fg: "#28496E" }
const PURPLE = { bg: "#ECE8F6", fg: "#4A3F8C" }

/** Keyed by `computeCompleteness` section key, in task priority order. */
const TASK_COPY: Record<string, TaskCopy> = {
  facilities: {
    label: "Missing accessibility information",
    action: "Add details",
    Icon: Accessibility,
    tint: GREEN,
  },
  photo: {
    label: "Needs a photo",
    action: "Upload one",
    Icon: Camera,
    tint: RUST,
  },
  hours: {
    label: "Opening hours not added",
    action: "Add hours",
    Icon: Clock,
    tint: BLUE,
  },
  contact: {
    label: "No website or contact details",
    action: "Add contact details",
    Icon: Globe,
    tint: PURPLE,
  },
  collections: {
    label: "Collections not described",
    action: "Describe them",
    Icon: BookOpen,
    tint: GREEN,
  },
  history: {
    label: "Founding date unknown",
    action: "Add its history",
    Icon: History,
    tint: RUST,
  },
  address: {
    label: "Street address missing",
    action: "Add the address",
    Icon: MapPin,
    tint: BLUE,
  },
  location: {
    label: "Not pinned on the map",
    action: "Pin it",
    Icon: MapPin,
    tint: BLUE,
  },
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

const ROW = "group flex items-center gap-4 py-4 no-underline"

/** How contributing works, beside a few real gaps anyone could fill now. */
export function ContributeSection({
  band,
  steps,
  tasksIntro,
  tasks,
}: {
  readonly band: CtaBand
  readonly steps: readonly Step[]
  readonly tasksIntro: SectionIntro
  readonly tasks: readonly ContributionTask[]
}) {
  return (
    <section
      id="contribute"
      aria-labelledby="contribute-title"
      className="mx-auto grid w-full max-w-[1360px] grid-cols-1 items-start gap-[clamp(40px,7vw,120px)] px-4 pt-[clamp(80px,10vw,140px)] sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div>
        <h2
          id="contribute-title"
          className="m-0 text-balance"
          style={{ ...displayStyle("band"), color: T.ink.base }}
        >
          <Emphasis
            text={band.title ?? ""}
            emStyle={{ color: T.accent.primary }}
          />
        </h2>
        {band.text ? (
          <p
            className="mt-8 max-w-[540px] text-[18px] leading-[1.65] text-pretty"
            style={{ color: T.ink.dim }}
          >
            {band.text}
          </p>
        ) : null}

        {steps.length > 0 ? (
          <ol className="m-0 mt-6 flex list-none flex-wrap gap-2 p-0">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="flex items-center gap-2.5 rounded-full border bg-white py-1.5 pr-4 pl-1.5 text-[16px] font-medium"
                style={{ borderColor: T.border.line, color: T.ink.base }}
                title={step.text ?? undefined}
              >
                <span
                  aria-hidden="true"
                  className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                  style={{ background: T.ink.base }}
                >
                  {i + 1}
                </span>
                {step.title}
              </li>
            ))}
          </ol>
        ) : null}

        <div className="mt-7 flex flex-wrap gap-2.5">
          {band.primaryLabel && band.primaryHref ? (
            <GlobalLink
              href={band.primaryHref}
              className="rounded-full px-6 py-3.5 font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
              style={{ background: T.accent.primary }}
            >
              {band.primaryLabel}
            </GlobalLink>
          ) : null}
          {band.secondaryLabel && band.secondaryHref ? (
            <GlobalLink
              href={band.secondaryHref}
              className="rounded-full border bg-white px-6 py-3.5 font-semibold no-underline transition-colors hover:border-(--t-accent-primary)"
              style={{ borderColor: T.border.hi, color: T.ink.base }}
            >
              {band.secondaryLabel}
            </GlobalLink>
          ) : null}
        </div>
      </div>

      <div
        className="rounded-[28px] border bg-white px-[clamp(20px,2.4vw,32px)] pt-6 pb-5"
        style={{ borderColor: T.border.line }}
      >
        <div
          className="flex flex-wrap items-baseline justify-between gap-3 border-b pb-3"
          style={{ borderColor: T.border.line }}
        >
          <h3
            className="m-0 text-[17px] font-bold"
            style={{ color: T.ink.base }}
          >
            {tasksIntro.title}
          </h3>
          {tasks.length > 0 ? (
            <GlobalLink
              href="/contribute"
              className="text-[15px] font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              See all open tasks
            </GlobalLink>
          ) : null}
        </div>

        <ul className="m-0 list-none p-0">
          {tasks.map((task) => {
            const { label, action, Icon, tint } = TASK_COPY[task.missingKey]!

            return (
              <li
                key={task.documentId}
                className="border-b"
                style={{ borderColor: T.border.line }}
              >
                <GlobalLink href={taskHref(task)} className={ROW}>
                  <span
                    aria-hidden="true"
                    className="flex size-12 shrink-0 items-center justify-center rounded-[12px]"
                    style={{ background: tint.bg, color: tint.fg }}
                  >
                    <Icon className="size-5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-[14px] font-semibold"
                      style={{ color: tint.fg }}
                    >
                      {label}
                    </span>
                    <span
                      className="block truncate text-[22px] leading-tight transition-colors group-hover:text-(--t-accent-primary)"
                      style={{
                        fontFamily: T.font.serif,
                        fontWeight: 500,
                        color: T.ink.base,
                      }}
                    >
                      {task.name}
                    </span>
                    {task.place ? (
                      <span
                        className="block truncate text-[14px]"
                        style={{ color: T.ink.dim }}
                      >
                        {task.place}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="hidden shrink-0 text-[15px] font-semibold sm:inline"
                    style={{ color: T.accent.primary }}
                  >
                    {action} <span aria-hidden="true">→</span>
                  </span>
                </GlobalLink>
              </li>
            )
          })}

          {tasks.length === 0 ? (
            <li className="border-b" style={{ borderColor: T.border.line }}>
              <GlobalLink href="/contribute/index/new" className={ROW}>
                <span
                  aria-hidden="true"
                  className="flex size-12 shrink-0 items-center justify-center rounded-[12px]"
                  style={{
                    background: T.accent.chip,
                    color: T.accent.primary,
                  }}
                >
                  <Plus className="size-5" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[22px] leading-tight"
                    style={{
                      fontFamily: T.font.serif,
                      fontWeight: 500,
                      color: T.ink.base,
                    }}
                  >
                    Your local library missing?
                  </span>
                  <span
                    className="block text-[14px]"
                    style={{ color: T.ink.dim }}
                  >
                    Only a name, library type and one source are required.
                  </span>
                </span>
              </GlobalLink>
            </li>
          ) : null}
        </ul>

        <p
          className="m-0 mt-4 flex items-center gap-2 text-[15px]"
          style={{ color: T.ink.dim }}
        >
          <Star
            aria-hidden="true"
            className="size-4 shrink-0"
            strokeWidth={1.8}
            style={{ color: T.accent.primary }}
          />
          <span>
            Regular contributors get{" "}
            <GlobalLink
              href="/contribute/membership"
              className="font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              Pro free
            </GlobalLink>
            .
          </span>
        </p>
      </div>
    </section>
  )
}

ContributeSection.displayName = "ContributeSection"

export default ContributeSection
