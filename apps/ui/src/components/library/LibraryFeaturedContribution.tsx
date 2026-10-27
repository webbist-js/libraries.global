"use client"

import { normalizeMobileTimetable, sectionCheckedAt } from "@repo/shared-data"
import { useLocale, useTranslations } from "next-intl"

import { hubHref } from "@/components/contribute/wizard.logic"
import GlobalLink from "@/components/global/GlobalLink"
import type { ChecklistKey } from "@/components/library/library-page.helpers"
import { useCorrectionDrawer } from "@/components/library/LibraryCorrection"
import { LibraryDriveNote } from "@/components/library/LibraryDriveNote"
import {
  translateHref,
  type TranslateLocale,
} from "@/components/library/LibraryHelpPanel"
import { translateTargets } from "@/components/library-editor/translation-mode"
import { timetablePresentation } from "@/components/mobile/timetable-presentation"
import { useMobileClock } from "@/components/mobile/useMobileClock"
import { useMounted } from "@/hooks/useMounted"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"

type Task = {
  key: string
  title: string
  description: string
  href?: string
  category?: string
  verify?: boolean
}

export function LibraryFeaturedContribution({
  library,
  unanswered,
  hasHours,
  hasPhoto,
  path,
  gaps = [],
  translateLocales = [],
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
  readonly gaps?: readonly ChecklistKey[]
  readonly translateLocales?: readonly TranslateLocale[]
}) {
  const t = useTranslations("libraryPage")
  const locale = useLocale()
  const { data: session } = authClient.useSession()
  const mounted = useMounted()
  const { open, verify } = useCorrectionDrawer()
  const mobile = library.libraryType === "Mobile"
  const digital = library.libraryType === "Digital"
  const stamp = sectionCheckedAt(library, "hours")
  const now = useMobileClock()
  const staleHours =
    !stamp ||
    Boolean(now && now.getTime() - Date.parse(stamp) > 730 * 86_400_000)
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
  const hours: Task = {
    key: "hours",
    title: t(
      mobile
        ? hasHours
          ? "tasks.checkStops"
          : "tasks.addStops"
        : hasHours
          ? "tasks.checkHours"
          : "tasks.addHours"
    ),
    description: t("tasks.scheduleNote"),
    category: mobile ? "Stops & times" : "Opening hours",
    verify: hasHours,
  }
  const access: Task = {
    key: "access",
    title: t("tasks.access", { count: unanswered }),
    description: t("tasks.accessNote"),
    href: "#access",
  }
  const photo: Task = {
    key: "photo",
    title: t("tasks.photo"),
    description: t("tasks.photoNote"),
    href: hubHref("photo", library),
  }
  const correction: Task = {
    key: "correction",
    title: t("tasks.correction"),
    description: t("tasks.sourceNote"),
    category: "Something else",
  }
  const ask =
    unanswered && !(mobile && scheduleNeedsWork)
      ? access
      : scheduleNeedsWork
        ? hours
        : !hasPhoto
          ? photo
          : correction
  const tasks: Task[] = [
    ...(!digital ? [hours] : []),
    ...(unanswered ? [access] : []),
    ...(!hasPhoto ? [photo] : []),
    ...gaps
      .filter(
        (key): key is Exclude<ChecklistKey, "photo" | "hours" | "facilities"> =>
          !["photo", "hours", "facilities"].includes(key)
      )
      .map((key) => ({
        key,
        title: t(`tasks.${key}`),
        description: t("tasks.sourceNote"),
        category:
          key === "about"
            ? "Collections"
            : key === "address" || key === "location"
              ? "Address or location"
              : "Something else",
      })),
    ...translateTargets(translateLocales, locale).map((target) => ({
      key: `translate-${target.code}`,
      title: t("tasks.translate", { language: target.name }),
      description: t("tasks.translateNote"),
      href: translateHref(library.slug, target.code),
    })),
    correction,
  ].filter((task) => task.key !== ask.key)
  const activate = (task: Task) =>
    task.verify ? verify(["hours"]) : open(task.category)
  const renderTask = (task: Task) => {
    const content = (
      <>
        <span className="block text-sm font-semibold">
          {task.title} <span aria-hidden="true">→</span>
        </span>
        <span
          className="mt-1 block text-sm leading-relaxed font-normal"
          style={{ color: T.ink.dim }}
        >
          {task.description}
        </span>
      </>
    )
    const className =
      "block min-h-11 w-full rounded-xl border px-4 py-3 text-left no-underline transition-colors hover:bg-(--t-bg-surface)"

    return (
      <li key={task.key}>
        {task.href ? (
          <GlobalLink
            className={className}
            style={{ borderColor: T.border.line }}
            href={task.href}
          >
            {content}
          </GlobalLink>
        ) : (
          <button
            type="button"
            className={className}
            style={{ borderColor: T.border.line }}
            onClick={() => activate(task)}
          >
            {content}
          </button>
        )}
      </li>
    )
  }
  const actionLabel = t(
    ask.key === "access"
      ? "answerQuestion"
      : ask.key === "photo"
        ? "addPhoto"
        : ask.key === "hours"
          ? hasHours
            ? "confirmSchedule"
            : "addSchedule"
          : "suggestCorrection"
  )
  const actionClass =
    "inline-flex min-h-12 items-center rounded-full bg-(--t-accent-primary) px-5 text-sm font-semibold text-white no-underline hover:bg-(--t-accent-primary-hover)"

  return (
    <div id="contribute" className="scroll-mt-(--sticky-content-top)">
      <LibraryDriveNote
        library={{ ...library, href: path }}
        featured
        fallback={
          <section
            aria-labelledby="contribute-heading"
            className="rounded-[28px] border p-6 sm:p-8"
            style={{ background: T.bg.deep, borderColor: T.border.line }}
          >
            <div className="grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,.9fr)] lg:gap-7">
              <div className="flex flex-col items-start gap-3.5">
                <p
                  className="m-0 text-sm font-semibold"
                  style={{ color: T.accent.primary }}
                >
                  {t("helpEyebrow")}
                </p>
                <h2
                  id="contribute-heading"
                  className="type-h2 m-0 max-w-[24ch] text-balance"
                >
                  {ask.title}
                </h2>
                <p
                  className="m-0 max-w-[52ch] text-base leading-relaxed"
                  style={{ color: T.ink.dim }}
                >
                  {ask.description}
                </p>
                {ask.href ? (
                  <GlobalLink className={actionClass} href={ask.href}>
                    {actionLabel}
                  </GlobalLink>
                ) : (
                  <button
                    type="button"
                    className={actionClass}
                    onClick={() => activate(ask)}
                  >
                    {actionLabel}
                  </button>
                )}
              </div>
              {tasks.length ? (
                <div>
                  <h3 className="type-h3 m-0 mb-3">{t("nextTasks")}</h3>
                  <ul className="m-0 grid list-none gap-2 p-0">
                    {tasks.slice(0, 3).map(renderTask)}
                  </ul>
                  {tasks.length > 3 ? (
                    <details className="mt-2">
                      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold underline underline-offset-4">
                        {t("allTasks", { count: tasks.length + 1 })}
                      </summary>
                      <ul className="m-0 grid list-none gap-2 p-0">
                        {tasks.slice(3).map(renderTask)}
                      </ul>
                    </details>
                  ) : null}
                </div>
              ) : null}
              <div
                className="border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
                style={{ borderColor: T.border.line }}
              >
                <h3 className="type-h3 m-0">{t("whatNext")}</h3>
                <ol
                  className="m-0 mt-3 grid list-none gap-3 p-0 text-sm leading-relaxed"
                  style={{ color: T.ink.dim }}
                >
                  {(["source", "signIn", "review"] as const).map(
                    (key, index) => (
                      <li key={key} className="flex gap-2">
                        <span
                          className="font-bold"
                          style={{ color: T.ink.base }}
                        >
                          {index + 1}
                        </span>
                        {t(
                          key === "signIn" && mounted && session?.user
                            ? "next.signedIn"
                            : `next.${key}`
                        )}
                      </li>
                    )
                  )}
                </ol>
              </div>
            </div>
          </section>
        }
      />
    </div>
  )
}
