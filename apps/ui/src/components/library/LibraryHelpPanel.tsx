"use client"

import { Icon } from "@iconify/react"
import { useLocale } from "next-intl"

import { translateTargets } from "@/app/[locale]/contribute/index/_components/translation-mode"
import { hubHref } from "@/components/contribute/wizard.logic"
import type { ChecklistKey } from "@/components/library/library-page.helpers"
import { useCorrectionDrawer } from "@/components/library/LibraryCorrection"
import { useCapabilities } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

/** One of Strapi's configured locales. */
export type TranslateLocale = {
  code: string
  name: string
  isDefault?: boolean
}

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

function TaskBody({
  task,
}: {
  readonly task: Pick<Task, "title" | "meta" | "icon" | "tint">
}) {
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

/** The Index editor in translation mode for `code`. */
export function translateHref(slug: string, code: string): string {
  return `/contribute/index/${slug}?locale=${encodeURIComponent(code)}`
}

/**
 * "Translate this record": a link into the Index editor's translation mode,
 * with a choice of language when more than one can be translated into.
 */
function TranslateRecord({
  librarySlug,
  locales,
  divided,
}: {
  readonly librarySlug: string
  readonly locales: readonly TranslateLocale[]
  /** Rule it off from tasks above it. */
  readonly divided: boolean
}) {
  const [first, ...rest] = locales
  if (!first) return null

  return (
    <div
      className={
        divided
          ? "mt-3 flex flex-col gap-2 border-t pt-3"
          : "flex flex-col gap-2"
      }
      style={{ borderColor: T.border.divider }}
    >
      <Link
        href={translateHref(librarySlug, first.code)}
        className={ROW}
        style={{ borderColor: T.border.line }}
      >
        <TaskBody
          task={{
            title: "Translate this record",
            meta: rest.length > 0 ? `Into ${first.name}` : first.name,
            icon: "mdi:translate",
            tint: INDIGO,
          }}
        />
      </Link>
      {rest.length > 0 ? (
        <nav aria-label="Translate into another language">
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {rest.map((l) => (
              <li key={l.code}>
                <Link
                  href={translateHref(librarySlug, l.code)}
                  className="inline-flex items-center rounded-full border bg-white px-3 py-1 text-[13px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
                  style={{ borderColor: T.border.hi, color: T.ink.base }}
                >
                  {l.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
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
  translateLocales = [],
}: {
  readonly gaps: readonly ChecklistKey[]
  readonly librarySlug: string
  readonly libraryName: string
  readonly libraryDocumentId: string
  /** Unanswered accessibility questions on the page. */
  readonly facilityQuestions: number
  /**
   * Strapi's configured locales. With more than one, the panel offers
   * "Translate this record" into each non-default locale.
   */
  readonly translateLocales?: readonly TranslateLocale[]
}) {
  const routeLocale = useLocale()
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

  const targets = translateTargets(translateLocales, routeLocale)

  if (!steward && tasks.length === 0 && targets.length === 0) return null

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
      {tasks.length > 0 ? (
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
      ) : null}
      <TranslateRecord
        divided={tasks.length > 0}
        librarySlug={librarySlug}
        locales={targets}
      />
    </section>
  )
}
