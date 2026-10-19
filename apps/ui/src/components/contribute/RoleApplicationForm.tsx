"use client"

import { Icon } from "@iconify/react"
import { findUnsafeContent } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"

import { Badge, ChoiceCard, Notice } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import {
  type AcceptedChange,
  APPLICATION_QUEUE_LABEL,
  APPLICATION_QUEUES,
  APPLICATION_ROLE_LABEL,
  APPLICATION_ROLES,
  APPLICATION_SAMPLES_MAX,
  APPLICATION_SECTIONS_MAX,
  APPLICATION_STATEMENT_MAX,
  type ApplicationQueue,
  type ApplicationRole,
  applicationFields,
  applicationProblem,
  cooldownEnds,
  formatLongDate,
  OPEN_APPLICATION_STATES,
  ROLE_APPLICATION_COOLDOWN_DAYS,
  ROLE_APPLICATION_MIN_ACCEPTED,
  type RoleApplicationSummary,
  sectionKindOf,
} from "@/lib/role-application"

import { RoleApplicationAside } from "./RoleApplicationAside"

export type LocaleOption = { code: string; label: string }
export type SectionOption = { slug: string; name: string }
/** Locales a role is already held in: every one, or these. */
export type Held = "all" | string[]
export type HeldRoles = {
  wiki_editor: Held
  journal_editor: Held
  moderator: Record<ApplicationQueue, Held>
}

const ROLE_CARD: Record<
  ApplicationRole,
  { hint: string; icon: string; bg: string; fg: string }
> = {
  wiki_editor: {
    hint: "Your approved Knowledge edits and translations publish.",
    icon: "mdi:book-open-page-variant-outline",
    bg: "var(--tint-academic-bg)",
    fg: "var(--tint-academic-fg)",
  },
  journal_editor: {
    hint: "Your approved Journal articles and edits publish.",
    icon: "mdi:newspaper-variant-outline",
    bg: "var(--tint-special-bg)",
    fg: "var(--tint-special-fg)",
  },
  moderator: {
    hint: "Review submissions in a queue and language you choose.",
    icon: "mdi:shield-check-outline",
    bg: "var(--tint-national-bg)",
    fg: "var(--tint-national-fg)",
  },
}

/** Where someone who already holds the role goes instead. */
const ROLE_HOME: Record<ApplicationRole, { href: string; label: string }> = {
  wiki_editor: {
    href: "/contribute/knowledge",
    label: "Open the Knowledge editor",
  },
  journal_editor: {
    href: "/contribute/knowledge?type=journal",
    label: "Open the Journal editor",
  },
  moderator: { href: "/contribute/moderation", label: "Go to Moderation" },
}

type StatusMeta = { label: string; icon: string; fg: string; bg: string }

const PENDING_META: StatusMeta = {
  label: "Waiting for review",
  icon: "mdi:clock-outline",
  fg: "var(--t-accent-primary-hover)",
  bg: "var(--t-accent-chip)",
}

const STATUS_META: Record<string, StatusMeta> = {
  draft: {
    label: "Not sent yet",
    icon: "mdi:file-document-edit-outline",
    fg: T.ink.dim,
    bg: T.bg.muted,
  },
  pending: PENDING_META,
  needs_info: {
    label: "Needs more information",
    icon: "mdi:help-circle-outline",
    fg: "#6B5420",
    bg: "#F5EEDC",
  },
}

const input: React.CSSProperties = {
  padding: "12px 16px",
  minHeight: 48,
  borderRadius: 14,
  border: `1px solid ${T.border.hi}`,
  background: T.bg.deep,
  color: T.ink.base,
  fontSize: 16,
  fontFamily: T.font.sans,
  width: "100%",
  boxSizing: "border-box",
}

const card = "rounded-[24px] p-6 sm:p-7"
const cardStyle: React.CSSProperties = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
}
const cardTitle: React.CSSProperties = {
  fontFamily: T.font.serif,
  fontSize: 26,
  fontWeight: 500,
  letterSpacing: "-0.01em",
  color: T.ink.base,
}
const legendClass = "m-0 p-0 text-[15px] font-semibold"
const hintClass = "mt-0.5 mb-3 text-[14px]"

/** "Optional" / "Required" after a field's name. */
function Tag({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="font-normal" style={{ color: T.ink.dim }}>
      {" "}
      {children}
    </span>
  )
}

const shortDate = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const sameYear = d.getFullYear() === new Date().getFullYear()

  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}

async function readError(res: Response): Promise<string> {
  const fallback = "Couldn’t send your application. Please try again."
  try {
    const json = (await res.json()) as { error?: { message?: string } | string }
    if (typeof json.error === "string") return json.error

    return json.error?.message ?? fallback
  } catch {
    return fallback
  }
}

function languagesLabel(codes: string[], locales: readonly LocaleOption[]) {
  if (codes.length === 0) return "Any language"

  return codes
    .map((c) => locales.find((l) => l.code === c)?.label ?? c)
    .join(", ")
}

/** A toggle chip: a real checkbox or radio, styled as a pill. */
function Chip({
  type,
  name,
  checked,
  onChange,
  children,
}: {
  readonly type: "checkbox" | "radio"
  readonly name: string
  readonly checked: boolean
  readonly onChange: () => void
  readonly children: React.ReactNode
}) {
  return (
    <label
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-[14px] font-medium transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--t-accent-primary) has-[:focus-visible]:outline-solid"
      style={{
        background: checked ? T.accent.chip : T.bg.deep,
        borderColor: checked ? T.accent.primary : T.border.hi,
        color: checked ? T.accent.primaryHover : T.ink.base,
      }}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {checked ? (
        <Icon aria-hidden="true" icon="mdi:check" width={15} height={15} />
      ) : null}
      {children}
    </label>
  )
}

function EligibilityCard({
  acceptedCount,
}: {
  readonly acceptedCount: number
}) {
  const tUi = useUiTranslations("ui")

  const eligible = acceptedCount >= ROLE_APPLICATION_MIN_ACCEPTED
  const shown = Math.min(acceptedCount, ROLE_APPLICATION_MIN_ACCEPTED)
  const percent = (shown / ROLE_APPLICATION_MIN_ACCEPTED) * 100

  return (
    <section
      aria-labelledby="apply-eligibility"
      className={card}
      style={cardStyle}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="apply-eligibility" className="m-0" style={cardTitle}>
          Who can apply
        </h2>
        {eligible ? (
          <Badge label="You can apply" color="ok" icon="mdi:check" />
        ) : (
          <Badge label={tUi("not_yet")} color="dim" icon="mdi:progress-clock" />
        )}
      </div>
      <p
        className="mt-3 mb-5 text-[15px] leading-[1.6]"
        style={{ color: T.ink.dim }}
      >
        Editor and moderator roles go to people whose changes have already been
        accepted by a reviewer. Any kind of change counts: records, photos,
        sources or articles.
      </p>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-[15px]">
        <span className="font-semibold" style={{ color: T.ink.base }}>
          {acceptedCount} accepted {acceptedCount === 1 ? "change" : "changes"}
        </span>
        <span style={{ color: T.ink.dim }}>
          {ROLE_APPLICATION_MIN_ACCEPTED} needed
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={tUi("accepted_changes")}
        aria-valuemin={0}
        aria-valuemax={ROLE_APPLICATION_MIN_ACCEPTED}
        aria-valuenow={shown}
        aria-valuetext={`${acceptedCount} of ${ROLE_APPLICATION_MIN_ACCEPTED} accepted changes`}
        className="h-2 w-full rounded-full"
        style={{ background: T.bg.muted2 }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: eligible ? T.accent.ok : T.accent.primary,
          }}
        />
      </div>
      {eligible ? null : (
        <p className="mt-4 mb-0 text-[15px]" style={{ color: T.ink.dim }}>
          Keep contributing: corrections, new libraries and photos all count.{" "}
          <Link
            href="/contribute"
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Go to Contribute
          </Link>
        </p>
      )}
    </section>
  )
}

const linkStyle: React.CSSProperties = { color: T.accent.primary }
const linkClass = "font-semibold underline underline-offset-[3px]"

function OpenApplication({
  app,
  locales,
}: {
  readonly app: RoleApplicationSummary
  readonly locales: readonly LocaleOption[]
}) {
  const tUi = useUiTranslations("ui")

  const status = STATUS_META[app.status] ?? PENDING_META

  return (
    <div
      className="flex flex-col gap-2 rounded-[16px] p-4"
      style={{ border: `1px solid ${T.border.line}`, background: T.bg.surface }}
    >
      <p
        className="m-0 text-[15px] font-semibold"
        style={{ color: T.ink.base }}
      >
        You already have an application for this role.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <span style={{ color: T.ink.base }}>
          {APPLICATION_ROLE_LABEL[app.role]}
          {app.queue ? ` · ${APPLICATION_QUEUE_LABEL[app.queue]}` : ""}
        </span>
        <span style={{ color: T.ink.dim }}>
          · {languagesLabel(app.locales, locales)}
        </span>
        {app.createdAt ? (
          <span style={{ color: T.ink.dim }}>
            · Sent {shortDate(app.createdAt)}
          </span>
        ) : null}
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
          style={{ background: status.bg, color: status.fg }}
        >
          <Icon aria-hidden="true" icon={status.icon} width={14} />
          {status.label}
        </span>
      </div>
      {app.status === "needs_info" && app.reviewNote ? (
        <p
          className="m-0 text-[15px] leading-[1.55]"
          style={{ color: T.ink.base }}
        >
          <span style={{ color: T.ink.dim }}>Moderator’s question: </span>
          {app.reviewNote}
        </p>
      ) : null}
      <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
        {app.status === "needs_info" ? "Reply from " : "Follow it in "}
        <Link
          href="/contribute/submissions"
          className={linkClass}
          style={linkStyle}
        >
          {tUi("my_submissions")}{" "}
        </Link>
        .
      </p>
    </div>
  )
}

function AcceptedList({
  accepted,
  total,
  username,
}: {
  readonly accepted: readonly AcceptedChange[]
  readonly total: number
  readonly username: string | null
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className={legendClass} style={{ color: T.ink.base }}>
        Your accepted changes<Tag>Attached automatically</Tag>
      </p>
      {accepted.length === 0 ? (
        <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
          None yet. Your accepted changes will be attached here.
        </p>
      ) : (
        <ul
          className="m-0 list-none overflow-hidden rounded-[14px] p-0"
          style={{
            border: `1px solid ${T.border.line}`,
            background: T.bg.surface,
          }}
        >
          {accepted.map((c, i) => (
            <li
              key={c.documentId}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-[14px]"
              style={
                i > 0
                  ? { borderTop: `1px solid ${T.border.divider}` }
                  : undefined
              }
            >
              <Icon
                aria-hidden="true"
                icon="mdi:check"
                width={16}
                height={16}
                className="shrink-0"
                style={{ color: T.accent.ok }}
              />
              <span
                className="min-w-0 flex-1 truncate"
                style={{ color: T.ink.base }}
              >
                <span className="font-semibold">{c.action}</span>
                {c.target ? (
                  <span style={{ color: T.ink.dim }}> · {c.target}</span>
                ) : null}
              </span>
              <span
                className="shrink-0 text-[13px]"
                style={{ color: T.ink.dim }}
              >
                {shortDate(c.decidedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {username && total > 0 ? (
        <Link
          href={`/profile/${encodeURIComponent(username)}/contributions`}
          className="self-start text-[14px] underline underline-offset-[3px]"
          style={linkStyle}
        >
          See all {total} on your profile
        </Link>
      ) : null}
    </div>
  )
}

/**
 * Apply for a Contributor Role: Knowledge editor, Journal editor or
 * Moderator. Eligibility, open applications, held roles and the cooldown
 * are checked again by Strapi on submit; the form explains them early and
 * never decides.
 */
export function RoleApplicationForm({
  acceptedCount,
  locales,
  initialLocales,
  initialRole,
  applications: initialApplications,
  accepted,
  acceptedTotal,
  username,
  wikiSections,
  blogSections,
  held,
  guidelines,
}: {
  readonly acceptedCount: number
  readonly locales: readonly LocaleOption[]
  /** Profile languages that are configured locales; [] = Any language. */
  readonly initialLocales: readonly string[]
  readonly initialRole: ApplicationRole
  readonly applications: RoleApplicationSummary[]
  /** The newest accepted changes (up to three). */
  readonly accepted: readonly AcceptedChange[]
  readonly acceptedTotal: number
  readonly username: string | null
  readonly wikiSections: readonly SectionOption[]
  readonly blogSections: readonly SectionOption[]
  readonly held: HeldRoles
  readonly guidelines: { editor: string; moderator: string }
}) {
  const tUi = useUiTranslations("ui")

  const ids = useId()
  const [role, setRole] = useState<ApplicationRole>(initialRole)
  const [queue, setQueue] = useState<ApplicationQueue | null>(null)
  const [chosenLocales, setChosenLocales] = useState<string[]>([
    ...initialLocales,
  ])
  const [sections, setSections] = useState<string[]>([])
  const [statement, setStatement] = useState("")
  const [samples, setSamples] = useState<string[]>([""])
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [applications, setApplications] = useState(initialApplications)
  const sentRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (state === "sent") sentRef.current?.focus()
  }, [state])

  const eligible = acceptedCount >= ROLE_APPLICATION_MIN_ACCEPTED
  const isModerator = role === "moderator"
  const configured = locales.map((l) => l.code)

  // What already stands in the way for this role, in the order Strapi checks.
  const heldNow: Held =
    role === "moderator"
      ? queue
        ? held.moderator[queue]
        : APPLICATION_QUEUES.every((q) => held.moderator[q] === "all")
          ? "all"
          : []
      : held[role]
  const holdsAll = heldNow === "all"
  const heldSome = Array.isArray(heldNow) && heldNow.length > 0 ? heldNow : null
  const latest = applications.find((a) => a.role === role) ?? null
  const open =
    latest && OPEN_APPLICATION_STATES.has(latest.status) ? latest : null
  const cooldown = latest
    ? cooldownEnds(latest, ROLE_APPLICATION_COOLDOWN_DAYS)
    : null
  const blocked = holdsAll || !!open || !!cooldown
  const disabled = !eligible || state === "sending"

  const sectionKind = sectionKindOf(role, queue)
  const sectionOptions =
    sectionKind === "knowledge"
      ? wikiSections
      : sectionKind === "journal"
        ? blogSections
        : []

  const chooseRole = (r: ApplicationRole) => {
    if (r === role) return
    setRole(r)
    setSections([])
    setError(null)
  }
  const chooseQueue = (q: ApplicationQueue) => {
    if (q === queue) return
    setQueue(q)
    setSections([])
  }
  const toggleLocale = (code: string) =>
    setChosenLocales((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  const toggleSection = (slug: string) =>
    setSections((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= APPLICATION_SECTIONS_MAX
          ? prev
          : [...prev, slug]
    )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled || blocked) return
    const form = {
      role,
      queue,
      locales: chosenLocales,
      sections,
      statement,
      samples,
      acceptedGuidelines: agreed,
    }
    const problem = applicationProblem(form, configured)
    if (problem) {
      setError(problem)

      return
    }
    const fields = applicationFields(form)
    const unsafe = findUnsafeContent(fields)
    if (unsafe) {
      setError(unsafe.message)

      return
    }

    setError(null)
    setState("sending")
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionType: "role_application",
          targetEntityType: "user_profile",
          fields,
        }),
      })
      if (!res.ok) {
        setError(await readError(res))
        setState("idle")

        return
      }
      const json = (await res.json().catch(() => ({}))) as {
        data?: { documentId?: string }
      }
      setApplications((prev) => [
        {
          documentId: json.data?.documentId ?? `new-${role}`,
          role,
          queue: fields.queue ?? null,
          status: "pending",
          locales: fields.locales,
          reviewNote: null,
          createdAt: new Date().toISOString(),
          decidedAt: null,
        },
        ...prev.filter((a) => a.role !== role),
      ])
      setState("sent")
    } catch {
      setError("Couldn’t send your application. Please try again.")
      setState("idle")
    }
  }

  const statementLength = statement.trim().length
  const reviewer = isModerator ? "The editorial board" : "A moderator"

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:gap-6">
      <div className="flex min-w-0 flex-col gap-5">
        <EligibilityCard acceptedCount={acceptedCount} />

        {state === "sent" ? (
          <section
            aria-labelledby={`${ids}-sent`}
            className={`${card} flex flex-col items-start gap-3`}
            style={cardStyle}
          >
            <Notice
              icon="mdi:check-circle-outline"
              tone="ok"
              title={tUi("application_sent")}
            />
            <h2
              id={`${ids}-sent`}
              ref={sentRef}
              tabIndex={-1}
              className="m-0 outline-none"
              style={cardTitle}
            >
              Thanks. We’ve got your application.
            </h2>
            <p
              className="m-0 text-[16px] leading-[1.6]"
              style={{ color: T.ink.dim }}
            >
              {reviewer} will read it and email you their decision, usually
              within 7 days. Follow it in{" "}
              <Link
                href="/contribute/submissions"
                className={linkClass}
                style={linkStyle}
              >
                {tUi("my_submissions")}{" "}
              </Link>
              .
            </p>
            <button
              type="button"
              onClick={() => setState("idle")}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-semibold"
              style={{
                background: T.bg.deep,
                border: `1px solid ${T.border.hi}`,
                color: T.ink.base,
                cursor: "pointer",
              }}
            >
              Back to the form
            </button>
          </section>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            aria-labelledby={`${ids}-title`}
            className={card}
            style={cardStyle}
          >
            <h2 id={`${ids}-title`} className="m-0 mb-6" style={cardTitle}>
              Your application
            </h2>

            <fieldset
              disabled={disabled}
              className="m-0 flex min-w-0 flex-col gap-7 border-0 p-0"
            >
              <fieldset className="m-0 min-w-0 border-0 p-0">
                <legend
                  className={`${legendClass} mb-3`}
                  style={{ color: T.ink.base }}
                >
                  Role<Tag>{tUi("required")}</Tag>
                </legend>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {APPLICATION_ROLES.map((r) => {
                    const meta = ROLE_CARD[r]

                    return (
                      <ChoiceCard
                        key={r}
                        name={`${ids}-role`}
                        value={r}
                        checked={role === r}
                        onChange={() => chooseRole(r)}
                        icon={meta.icon}
                        tint={{ bg: meta.bg, fg: meta.fg }}
                        title={APPLICATION_ROLE_LABEL[r]}
                        hint={meta.hint}
                      />
                    )
                  })}
                </div>
              </fieldset>

              {isModerator ? (
                <fieldset className="m-0 min-w-0 border-0 p-0">
                  <legend className={legendClass} style={{ color: T.ink.base }}>
                    Queue you’d review<Tag>{tUi("required")}</Tag>
                  </legend>
                  <p className={hintClass} style={{ color: T.ink.dim }}>
                    You can ask for another queue later.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {APPLICATION_QUEUES.map((q) => (
                      <Chip
                        key={q}
                        type="radio"
                        name={`${ids}-queue`}
                        checked={queue === q}
                        onChange={() => chooseQueue(q)}
                      >
                        {APPLICATION_QUEUE_LABEL[q]}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {holdsAll ? (
                <Notice
                  icon="mdi:check-decagram-outline"
                  tone="ok"
                  title={`You’re already a ${APPLICATION_ROLE_LABEL[role]}.`}
                >
                  <p className="m-0">
                    <Link
                      href={ROLE_HOME[role].href}
                      className={linkClass}
                      style={linkStyle}
                    >
                      {ROLE_HOME[role].label}
                    </Link>
                  </p>
                </Notice>
              ) : open ? (
                <OpenApplication app={open} locales={locales} />
              ) : cooldown ? (
                <Notice
                  icon="mdi:calendar-clock-outline"
                  tone="warn"
                  title={`You can apply for this role again on ${formatLongDate(cooldown)}.`}
                >
                  {latest?.reviewNote ? (
                    <p className="m-0" style={{ color: T.ink.base }}>
                      <span style={{ color: T.ink.dim }}>
                        {isModerator
                          ? "The editorial board’s"
                          : "The moderator’s"}{" "}
                        note:{" "}
                      </span>
                      {latest.reviewNote}
                    </p>
                  ) : null}
                </Notice>
              ) : (
                <>
                  {heldSome ? (
                    <Notice
                      icon="mdi:information-outline"
                      tone="info"
                      title={`You already ${isModerator ? "review" : "edit"} in ${languagesLabel(heldSome, locales)}.`}
                    >
                      <p className="m-0" style={{ color: T.ink.base }}>
                        Apply to add another language.
                      </p>
                    </Notice>
                  ) : null}

                  {sectionKind && sectionOptions.length > 0 ? (
                    <fieldset className="m-0 min-w-0 border-0 p-0">
                      <legend
                        className={legendClass}
                        style={{ color: T.ink.base }}
                      >
                        {sectionKind === "knowledge"
                          ? "Knowledge sections you’d work on"
                          : "Journal sections you’d work on"}
                        <Tag>{tUi("optional_59be71")}</Tag>
                      </legend>
                      <p className={hintClass} style={{ color: T.ink.dim }}>
                        Helps{" "}
                        {isModerator ? "the editorial board" : "the moderator"}{" "}
                        see where you’d fit.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {sectionOptions.map((s) => (
                          <Chip
                            key={s.slug}
                            type="checkbox"
                            name={`${ids}-sections`}
                            checked={sections.includes(s.slug)}
                            onChange={() => toggleSection(s.slug)}
                          >
                            {s.name}
                          </Chip>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}

                  <fieldset className="m-0 min-w-0 border-0 p-0">
                    <legend
                      className={legendClass}
                      style={{ color: T.ink.base }}
                    >
                      {isModerator
                        ? "Languages you’d review in"
                        : "Languages you’d edit in"}
                    </legend>
                    <p className={hintClass} style={{ color: T.ink.dim }}>
                      {initialLocales.length > 0
                        ? "Taken from your profile. "
                        : ""}
                      Choose “Any language” if you’re not sure.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Chip
                        type="checkbox"
                        name={`${ids}-locales`}
                        checked={chosenLocales.length === 0}
                        onChange={() => setChosenLocales([])}
                      >
                        Any language
                      </Chip>
                      {locales.map((l) => (
                        <Chip
                          key={l.code}
                          type="checkbox"
                          name={`${ids}-locales`}
                          checked={chosenLocales.includes(l.code)}
                          onChange={() => toggleLocale(l.code)}
                        >
                          {l.label}
                        </Chip>
                      ))}
                    </div>
                  </fieldset>

                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <label
                        htmlFor={`${ids}-statement`}
                        className={legendClass}
                        style={{ color: T.ink.base }}
                      >
                        Why you’re applying
                        <Tag>{tUi("required")}</Tag>
                      </label>
                      <span
                        id={`${ids}-statement-count`}
                        className="text-[13px] font-semibold"
                        style={{
                          color:
                            statementLength > APPLICATION_STATEMENT_MAX
                              ? T.accent.danger
                              : T.ink.dim,
                        }}
                      >
                        {statementLength.toLocaleString("en-GB")} of{" "}
                        {APPLICATION_STATEMENT_MAX.toLocaleString("en-GB")}
                      </span>
                    </div>
                    <p
                      id={`${ids}-statement-hint`}
                      className={hintClass}
                      style={{ color: T.ink.dim }}
                    >
                      What you’d like to work on, and anything you’ve done that
                      shows how you’d {isModerator ? "review" : "edit"}. A few
                      sentences is plenty.
                    </p>
                    <textarea
                      id={`${ids}-statement`}
                      rows={5}
                      required
                      value={statement}
                      placeholder={
                        isModerator
                          ? "e.g. I’ve added and corrected dozens of library records in Wales and would like to help check new ones."
                          : "e.g. I’ve been fixing opening hours for Hertfordshire libraries and would like to keep the Visiting guides up to date."
                      }
                      aria-describedby={`${ids}-statement-hint ${ids}-statement-count`}
                      onChange={(e) => setStatement(e.target.value)}
                      style={{ ...input, resize: "vertical", lineHeight: 1.6 }}
                    />
                  </div>

                  <AcceptedList
                    accepted={accepted}
                    total={acceptedTotal}
                    username={username}
                  />

                  <fieldset className="m-0 min-w-0 border-0 p-0">
                    <legend
                      className={`${legendClass} mb-2`}
                      style={{ color: T.ink.base }}
                    >
                      Other samples of your work
                      <Tag>Optional, up to {APPLICATION_SAMPLES_MAX}</Tag>
                    </legend>
                    <div className="flex flex-col gap-2">
                      {samples.map((s, i) => (
                        <input
                          key={i}
                          type="url"
                          inputMode="url"
                          aria-label={`Sample link ${i + 1}`}
                          placeholder="https://"
                          value={s}
                          onChange={(e) =>
                            setSamples((prev) =>
                              prev.map((v, j) => (j === i ? e.target.value : v))
                            )
                          }
                          style={input}
                        />
                      ))}
                    </div>
                    {samples.length < APPLICATION_SAMPLES_MAX ? (
                      <button
                        type="button"
                        onClick={() => setSamples((prev) => [...prev, ""])}
                        className="mt-3 inline-flex items-center gap-1 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:opacity-60"
                        style={{
                          background: T.bg.deep,
                          border: `1px solid ${T.border.hi}`,
                          color: T.ink.base,
                          cursor: "pointer",
                        }}
                      >
                        <Icon aria-hidden="true" icon="mdi:plus" width={16} />
                        Add another link
                      </button>
                    ) : null}
                  </fieldset>

                  <label
                    className="flex items-start gap-3 text-[15px] leading-[1.55]"
                    style={{ color: T.ink.base }}
                  >
                    <input
                      type="checkbox"
                      required
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-1 size-[18px] shrink-0"
                      style={{ accentColor: T.accent.primary }}
                    />
                    <span>
                      I’ve read the{" "}
                      <Link
                        href={
                          isModerator ? guidelines.moderator : guidelines.editor
                        }
                        className="underline underline-offset-[3px]"
                        style={linkStyle}
                      >
                        {isModerator
                          ? "review guidelines"
                          : "editor guidelines"}
                      </Link>{" "}
                      and will follow them,{" "}
                      {isModerator
                        ? "including giving a reason for every decision and never reviewing my own submissions."
                        : "including citing sources and keeping official library names unchanged."}
                    </span>
                  </label>
                </>
              )}

              {error ? (
                <p
                  role="alert"
                  className="m-0 flex items-start gap-1.5 text-[14px] font-semibold"
                  style={{ color: T.accent.danger }}
                >
                  <Icon
                    aria-hidden="true"
                    icon="mdi:alert-circle-outline"
                    width={18}
                    className="mt-px shrink-0"
                  />
                  {error}
                </p>
              ) : null}

              {blocked ? null : (
                <div
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-5"
                  style={{ borderColor: T.border.divider }}
                >
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-full bg-(--t-accent-primary) px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ border: "none", fontFamily: T.font.sans }}
                  >
                    {state === "sending" ? tUi("sending") : "Send application"}
                    {state === "sending" ? null : (
                      <Icon
                        aria-hidden="true"
                        icon="mdi:arrow-right"
                        width={18}
                      />
                    )}
                  </button>
                  <span className="text-[14px]" style={{ color: T.ink.dim }}>
                    {reviewer} usually replies within 7 days.
                  </span>
                </div>
              )}
            </fieldset>
          </form>
        )}
      </div>

      <aside
        aria-label={tUi("about_this_role")}
        className="flex flex-col gap-4 self-start lg:sticky lg:top-(--sticky-content-top) lg:max-h-(--sticky-content-max-height) lg:overflow-y-auto lg:overscroll-contain"
      >
        <RoleApplicationAside role={role} />
      </aside>
    </div>
  )
}
