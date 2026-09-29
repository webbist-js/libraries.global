"use client"

import { Icon } from "@iconify/react"

import { hubHref } from "@/components/contribute/wizard.logic"
import type { ChecklistKey } from "@/components/library/library-page.helpers"
import { useCorrectionDrawer } from "@/components/library/LibraryCorrection"
import { useCapabilities } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

type Task = {
  key: ChecklistKey
  title: string
  meta: string
  icon: string
  tint: { bg: string; fg: string }
} & ({ href: string } | { category: string })

const PUBLIC = { bg: "var(--tint-public-bg)", fg: "var(--tint-public-fg)" }
const SPECIAL = { bg: "var(--tint-special-bg)", fg: "var(--tint-special-fg)" }
const ACADEMIC = {
  bg: "var(--tint-academic-bg)",
  fg: "var(--tint-academic-fg)",
}
const INDIGO = { bg: T.accent.chip, fg: T.accent.primary }

/** Tasks by gap, in the order they're offered. */
function tasksFor(
  gaps: readonly ChecklistKey[],
  library: { slug: string; name: string },
  questions: number
): Task[] {
  const all: Task[] = [
    {
      key: "accessibility",
      title: "Add accessibility details",
      meta: `About 2 minutes · ${questions} ${questions === 1 ? "question" : "questions"}`,
      icon: "mdi:human",
      tint: ACADEMIC,
      href: "#access",
    },
    {
      key: "collections",
      title: "Describe the collections",
      meta: "About 5 minutes",
      icon: "mdi:bookshelf",
      tint: SPECIAL,
      category: "Collections",
    },
    {
      key: "photos",
      title: "Share a photo",
      meta: "Your own, or one you may share",
      icon: "mdi:camera-outline",
      tint: PUBLIC,
      href: hubHref("photo", library),
    },
    {
      key: "hours",
      title: "Add the opening hours",
      meta: "About 3 minutes",
      icon: "mdi:clock-outline",
      tint: INDIGO,
      category: "Opening hours",
    },
    {
      key: "address",
      title: "Add the address",
      meta: "About 1 minute",
      icon: "mdi:map-marker-outline",
      tint: INDIGO,
      category: "Address or location",
    },
    {
      key: "history",
      title: "Add a date from its history",
      meta: "About 2 minutes",
      icon: "mdi:history",
      tint: SPECIAL,
      category: "Something else",
    },
    {
      key: "links",
      title: "Add the official website",
      meta: "About 1 minute",
      icon: "mdi:web",
      tint: INDIGO,
      category: "Something else",
    },
  ]

  return all.filter((t) => gaps.includes(t.key)).slice(0, 3)
}

const ROW =
  "group flex w-full items-center gap-3 rounded-2xl border bg-white px-3 py-2.5 text-left no-underline transition-colors hover:bg-(--t-bg-surface)"

function TaskBody({ task }: { readonly task: Task }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: task.tint.bg, color: task.tint.fg }}
      >
        <Icon height={17} icon={task.icon} width={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-[14px] leading-snug font-semibold"
          style={{ color: T.ink.base }}
        >
          {task.title}
        </span>
        <span className="block text-[12.5px]" style={{ color: T.ink.dim }}>
          {task.meta}
        </span>
      </span>
      <Icon
        aria-hidden="true"
        className="shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
        height={18}
        icon="mdi:chevron-right"
        style={{ color: T.ink.low }}
        width={18}
      />
    </>
  )
}

/**
 * "Help finish this record": up to three quick tasks for the record's gaps.
 * The library's own stewards get an edit link first. UI only: every route
 * behind these re-checks access, and signed-out readers are asked to sign
 * in by the form they open.
 */
export function LibraryHelpPanel({
  gaps,
  librarySlug,
  libraryName,
  libraryDocumentId,
  facilityQuestions,
}: {
  readonly gaps: readonly ChecklistKey[]
  readonly librarySlug: string
  readonly libraryName: string
  readonly libraryDocumentId: string
  /** Unanswered accessibility questions on the page. */
  readonly facilityQuestions: number
}) {
  const { open } = useCorrectionDrawer()
  const { has, claimedLibraryIds, ready } = useCapabilities()
  const steward =
    ready &&
    has("submit.libraryEdit") &&
    claimedLibraryIds.includes(libraryDocumentId)
  const tasks = tasksFor(
    gaps,
    { slug: librarySlug, name: libraryName },
    facilityQuestions
  )

  if (!steward && tasks.length === 0) return null

  return (
    <section
      aria-labelledby="help-h"
      className="rounded-3xl p-5"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <h2
        id="help-h"
        className="m-0 mb-3 text-[15px] font-bold"
        style={{ color: T.ink.base }}
      >
        {steward ? "You look after this library" : "Help finish this record"}
      </h2>
      {steward ? (
        <div className="mb-3 flex flex-col gap-2">
          <Link
            href={`/contribute/index/${librarySlug}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-(--t-accent-primary) px-4 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
          >
            <Icon
              aria-hidden="true"
              height={16}
              icon="mdi:pencil-outline"
              width={16}
            />
            Edit this record
          </Link>
          {has("events.feed") ? (
            <Link
              href="/contribute/events"
              className="inline-flex h-10 items-center justify-center rounded-full border bg-white px-4 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
              style={{ borderColor: T.border.hi, color: T.ink.base }}
            >
              Connect an event feed
            </Link>
          ) : null}
          <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
            Your edits go to a reviewer first.
          </p>
        </div>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {tasks.map((task) => (
          <li key={task.key}>
            {"href" in task ? (
              task.href.startsWith("#") ? (
                <a
                  href={task.href}
                  className={ROW}
                  style={{ borderColor: T.border.line }}
                >
                  <TaskBody task={task} />
                </a>
              ) : (
                <Link
                  href={task.href}
                  className={ROW}
                  style={{ borderColor: T.border.line }}
                >
                  <TaskBody task={task} />
                </Link>
              )
            ) : (
              <button
                type="button"
                onClick={() => open(task.category)}
                className={ROW}
                style={{ borderColor: T.border.line }}
              >
                <TaskBody task={task} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
