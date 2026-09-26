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
} from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import type {
  ContributionTask,
  SectionIntro,
} from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"
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

const CARD =
  "group flex h-full flex-col gap-2 rounded-[20px] border bg-white p-5 no-underline transition-colors hover:border-(--t-accent-primary)"

export function TasksSection({
  intro,
  tasks,
}: {
  readonly intro: SectionIntro
  readonly tasks: readonly ContributionTask[]
}) {
  return (
    <section
      aria-labelledby="tasks-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(64px,8vw,104px)] sm:px-8"
    >
      <SectionHeader
        id="tasks-title"
        intro={intro}
        action={
          tasks.length > 0 ? (
            <GlobalLink
              href="/contribute"
              className="font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              See all open tasks
            </GlobalLink>
          ) : null
        }
      />

      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3.5 p-0">
        {tasks.map((task) => {
          const { label, action, Icon, tint } = TASK_COPY[task.missingKey]!

          return (
            <li key={task.documentId}>
              <GlobalLink
                href={`/contribute/edit/${task.slug}`}
                className={CARD}
                style={{ borderColor: T.border.line }}
              >
                <span
                  className="flex items-center gap-2 text-[13.5px] font-semibold"
                  style={{ color: tint.fg }}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: tint.bg }}
                  >
                    <Icon className="size-3.5" strokeWidth={1.9} />
                  </span>
                  {label}
                </span>
                <span
                  className="mt-1 text-[21px] leading-[1.2]"
                  style={{
                    fontFamily: T.font.serif,
                    fontWeight: 500,
                    color: T.ink.base,
                  }}
                >
                  {task.name}
                </span>
                {task.place ? (
                  <span className="text-[14px]" style={{ color: T.ink.dim }}>
                    {task.place}
                  </span>
                ) : null}
                <span
                  className="mt-auto pt-2 text-[15px] font-semibold"
                  style={{ color: T.accent.primary }}
                >
                  {action} <span aria-hidden="true">→</span>
                </span>
              </GlobalLink>
            </li>
          )
        })}

        <li>
          <GlobalLink
            href="/contribute/add"
            className={CARD}
            style={{ borderColor: T.border.hi, background: T.bg.surface }}
          >
            <span
              className="flex items-center gap-2 text-[13.5px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full"
                style={{ background: T.accent.chip, color: T.accent.primary }}
              >
                <Plus className="size-3.5" strokeWidth={2} />
              </span>
              Three fields to start
            </span>
            <span
              className="mt-1 text-[21px] leading-[1.2]"
              style={{
                fontFamily: T.font.serif,
                fontWeight: 500,
                color: T.ink.base,
              }}
            >
              Your local library missing?
            </span>
            <span className="text-[14px]" style={{ color: T.ink.dim }}>
              Only a name, library type and one source are required.
            </span>
            <span
              className="mt-auto pt-2 text-[15px] font-semibold"
              style={{ color: T.accent.primary }}
            >
              Add a library <span aria-hidden="true">→</span>
            </span>
          </GlobalLink>
        </li>
      </ul>
    </section>
  )
}

TasksSection.displayName = "TasksSection"

export default TasksSection
