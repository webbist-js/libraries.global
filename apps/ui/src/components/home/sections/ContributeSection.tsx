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
  Sparkles,
} from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
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

const ROW =
  "group flex items-center gap-4 rounded-[16px] border bg-white px-4 py-3.5 no-underline transition-colors hover:border-(--t-accent-primary)"

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
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(64px,8vw,104px)] sm:px-8"
    >
      <div
        className="grid gap-[clamp(28px,4vw,56px)] rounded-[28px] border bg-white p-[clamp(24px,4vw,48px)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        style={{ borderColor: T.border.line }}
      >
        <div>
          <p
            className="m-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-semibold"
            style={{ background: "#E6EFE6", color: "#2F5D3A" }}
          >
            <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
            Contribute
          </p>
          <h2
            id="contribute-title"
            className="m-0 mt-4 text-balance"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(32px,3.6vw,46px)",
              lineHeight: 1.08,
              letterSpacing: "-0.015em",
              color: T.ink.base,
            }}
          >
            <Emphasis
              text={band.title ?? ""}
              emStyle={{ color: T.accent.primary }}
            />
          </h2>
          {band.text ? (
            <p
              className="mt-3 max-w-[480px] text-[17px] leading-[1.6] text-pretty"
              style={{ color: T.ink.dim }}
            >
              {band.text}
            </p>
          ) : null}

          {steps.length > 0 ? (
            <ol className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
              {steps.map((step, i) => (
                <li
                  key={step.title}
                  className="flex items-center gap-3 text-[16px]"
                  style={{ color: T.ink.dim }}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full border text-[14px] font-semibold"
                    style={{
                      borderColor: T.accent.primary,
                      color: T.accent.primary,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <strong style={{ color: T.ink.base }}>{step.title}</strong>
                    {step.text ? ` ${step.text}` : null}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}

          <div className="mt-7 flex flex-wrap gap-2.5">
            {band.primaryLabel && band.primaryHref ? (
              <GlobalLink
                href={band.primaryHref}
                className="rounded-full px-5 py-3 font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
                style={{ background: T.accent.primary }}
              >
                {band.primaryLabel}
              </GlobalLink>
            ) : null}
            {band.secondaryLabel && band.secondaryHref ? (
              <GlobalLink
                href={band.secondaryHref}
                className="rounded-full border bg-white px-5 py-3 font-semibold no-underline transition-colors hover:border-(--t-accent-primary)"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
              >
                {band.secondaryLabel}
              </GlobalLink>
            ) : null}
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h3
              className="m-0 text-[16px] font-bold"
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

          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {tasks.map((task) => {
              const { label, action, Icon, tint } = TASK_COPY[task.missingKey]!

              return (
                <li key={task.documentId}>
                  <GlobalLink
                    href={taskHref(task)}
                    className={ROW}
                    style={{ borderColor: T.border.line }}
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full"
                      style={{ background: tint.bg, color: tint.fg }}
                    >
                      <Icon className="size-4" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block text-[13.5px] font-semibold"
                        style={{ color: tint.fg }}
                      >
                        {label}
                      </span>
                      <span
                        className="block truncate text-[20px] leading-[1.25]"
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
              <li>
                <GlobalLink
                  href="/contribute/index/new"
                  className={ROW}
                  style={{ borderColor: T.border.hi, background: T.bg.surface }}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: T.accent.chip,
                      color: T.accent.primary,
                    }}
                  >
                    <Plus className="size-4" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-[20px] leading-[1.25]"
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
            className="m-0 mt-4 flex items-center gap-1.5 text-[15px]"
            style={{ color: T.ink.dim }}
          >
            <Sparkles
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
      </div>
    </section>
  )
}

ContributeSection.displayName = "ContributeSection"

export default ContributeSection
