"use client"

import { Icon } from "@iconify/react"
import { findUnsafeContent } from "@repo/shared-data"
import { useId, useState } from "react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import {
  APPLICATION_ROLE_LABEL,
  APPLICATION_ROLES,
  APPLICATION_SAMPLES_MAX,
  APPLICATION_STATEMENT_MAX,
  type ApplicationRole,
  applicationFields,
  applicationProblem,
  OPEN_APPLICATION_STATES,
  ROLE_APPLICATION_MIN_ACCEPTED,
  type RoleApplicationSummary,
} from "@/lib/role-application"

type LocaleOption = { code: string; name: string }

const ROLE_HINT: Record<ApplicationRole, string> = {
  wiki_editor:
    "Your approved Knowledge edits and translations publish straight away.",
  journal_editor: "Your approved Journal edits publish straight away.",
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
  approved: {
    label: "Accepted",
    icon: "mdi:check-circle-outline",
    fg: "var(--tint-public-fg)",
    bg: "var(--tint-public-bg)",
  },
  rejected: {
    label: "Not accepted",
    icon: "mdi:close-circle-outline",
    fg: T.accent.danger,
    bg: "var(--tint-special-bg)",
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

const card = "rounded-[24px] p-6 sm:p-8"
const cardStyle: React.CSSProperties = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
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

function localesLabel(codes: string[], locales: readonly LocaleOption[]) {
  if (codes.length === 0) return "All languages"

  return codes
    .map((c) => locales.find((l) => l.code === c)?.name ?? c)
    .join(", ")
}

function EligibilityCard({ acceptedCount }: { acceptedCount: number }) {
  const shown = Math.min(acceptedCount, ROLE_APPLICATION_MIN_ACCEPTED)
  const eligible = acceptedCount >= ROLE_APPLICATION_MIN_ACCEPTED
  const percent = (shown / ROLE_APPLICATION_MIN_ACCEPTED) * 100

  return (
    <section
      aria-labelledby="apply-eligibility"
      className={card}
      style={cardStyle}
    >
      <h2
        id="apply-eligibility"
        className="m-0"
        style={{ fontFamily: T.font.serif, fontSize: 24, fontWeight: 500 }}
      >
        Who can apply
      </h2>
      <p className="mt-2 mb-4 text-[15px]" style={{ color: T.ink.dim }}>
        Editor roles go to people whose changes have already been accepted.
      </p>
      <p className="m-0 mb-2 text-[16px] font-semibold">
        {acceptedCount} of {ROLE_APPLICATION_MIN_ACCEPTED} accepted changes
      </p>
      <div
        role="progressbar"
        aria-label="Accepted changes"
        aria-valuemin={0}
        aria-valuemax={ROLE_APPLICATION_MIN_ACCEPTED}
        aria-valuenow={shown}
        className="h-2.5 w-full rounded-full"
        style={{ background: T.bg.muted2 }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: eligible ? "var(--tint-public-fg)" : T.accent.primary,
          }}
        />
      </div>
      {eligible ? (
        <p
          className="mt-3 mb-0 flex items-center gap-1.5 text-[15px] font-semibold"
          style={{ color: "var(--tint-public-fg)" }}
        >
          <Icon aria-hidden="true" icon="mdi:check-circle-outline" width={18} />
          You can apply.
        </p>
      ) : (
        <p className="mt-3 mb-0 text-[15px]" style={{ color: T.ink.dim }}>
          Keep contributing: corrections and new libraries all count.{" "}
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

function ApplicationsList({
  applications,
  locales,
}: {
  applications: RoleApplicationSummary[]
  locales: readonly LocaleOption[]
}) {
  return (
    <section aria-labelledby="apply-yours" className={card} style={cardStyle}>
      <h2
        id="apply-yours"
        className="m-0"
        style={{ fontFamily: T.font.serif, fontSize: 24, fontWeight: 500 }}
      >
        Your applications
      </h2>
      <ul
        aria-label="Your applications"
        className="m-0 mt-4 flex list-none flex-col gap-3 p-0"
      >
        {applications.map((a) => {
          const status = STATUS_META[a.status] ?? PENDING_META
          const decidedOrAsked =
            a.status === "approved" ||
            a.status === "rejected" ||
            a.status === "needs_info"

          return (
            <li
              key={a.documentId}
              className="rounded-[16px] p-4"
              style={{ border: `1px solid ${T.border.line}` }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[16px] font-semibold">
                  {APPLICATION_ROLE_LABEL[a.role]}
                </span>
                <span className="text-[14px]" style={{ color: T.ink.dim }}>
                  · {localesLabel(a.locales, locales)}
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
                  style={{ background: status.bg, color: status.fg }}
                >
                  <Icon aria-hidden="true" icon={status.icon} width={14} />
                  {status.label}
                </span>
              </div>
              {decidedOrAsked && a.reviewNote ? (
                <p
                  className="mt-2 mb-0 text-[15px] leading-[1.55]"
                  style={{ color: T.ink.base }}
                >
                  <span style={{ color: T.ink.dim }}>Moderator’s note: </span>
                  {a.reviewNote}
                </p>
              ) : null}
              {a.status === "needs_info" ? (
                <p
                  className="mt-2 mb-0 text-[14px]"
                  style={{ color: T.ink.dim }}
                >
                  Reply from{" "}
                  <Link
                    href="/contribute/submissions"
                    className="underline underline-offset-[3px]"
                    style={{ color: T.accent.primary }}
                  >
                    My submissions
                  </Link>
                  .
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Apply for an editor role (Knowledge or Journal). Eligibility, open
 * applications and existing grants are checked again by Strapi on submit;
 * the form explains them early and never decides.
 */
export function RoleApplicationForm({
  acceptedCount,
  locales,
  initialRole,
  applications: initialApplications,
}: {
  readonly acceptedCount: number
  readonly locales: readonly LocaleOption[]
  readonly initialRole: ApplicationRole | null
  readonly applications: RoleApplicationSummary[]
}) {
  const ids = useId()
  const [role, setRole] = useState<ApplicationRole | null>(initialRole)
  const [chosenLocales, setChosenLocales] = useState<string[]>([])
  const [statement, setStatement] = useState("")
  const [samples, setSamples] = useState<string[]>([""])
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [applications, setApplications] = useState(initialApplications)

  const eligible = acceptedCount >= ROLE_APPLICATION_MIN_ACCEPTED
  const openForRole = applications.some(
    (a) => a.role === role && OPEN_APPLICATION_STATES.has(a.status)
  )
  const disabled = !eligible || state === "sending"
  const configured = locales.map((l) => l.code)

  const toggleLocale = (code: string) =>
    setChosenLocales((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled || openForRole) return
    const form = { role, locales: chosenLocales, statement, samples }
    const problem = applicationProblem(form, configured)
    if (problem || !role) {
      setError(problem ?? "Choose Knowledge editor or Journal editor.")

      return
    }
    const fields = applicationFields({ ...form, role })
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
          status: "pending",
          locales: fields.locales,
          reviewNote: null,
          createdAt: new Date().toISOString(),
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
  const legend = "text-[15px] font-semibold p-0 mb-2"

  return (
    <div className="flex flex-col gap-6">
      <EligibilityCard acceptedCount={acceptedCount} />

      {applications.length > 0 ? (
        <ApplicationsList applications={applications} locales={locales} />
      ) : null}

      {state === "sent" ? (
        <section className={`${card} text-center`} style={cardStyle}>
          <h2
            className="m-0"
            style={{ fontFamily: T.font.serif, fontSize: 28, fontWeight: 500 }}
          >
            Application sent
          </h2>
          <p className="mt-2 mb-0 text-[16px]" style={{ color: T.ink.dim }}>
            A moderator will review it and email you their decision. Follow it
            in{" "}
            <Link
              href="/contribute/submissions"
              className="underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              My submissions
            </Link>
            .
          </p>
        </section>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-labelledby={`${ids}-title`}
          className={`${card} flex flex-col gap-6`}
          style={cardStyle}
        >
          <h2
            id={`${ids}-title`}
            className="m-0"
            style={{ fontFamily: T.font.serif, fontSize: 24, fontWeight: 500 }}
          >
            Your application
          </h2>

          <fieldset className="m-0 border-0 p-0">
            <legend className={legend}>Role</legend>
            <div className="flex flex-col gap-2">
              {APPLICATION_ROLES.map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-start gap-3 rounded-[14px] p-3"
                  style={{
                    border: `1px solid ${role === r ? T.accent.primary : T.border.line}`,
                  }}
                >
                  <input
                    type="radio"
                    name={`${ids}-role`}
                    value={r}
                    checked={role === r}
                    disabled={disabled}
                    onChange={() => setRole(r)}
                    className="mt-1"
                  />
                  <span className="flex flex-col">
                    <span className="text-[16px] font-semibold">
                      {APPLICATION_ROLE_LABEL[r]}
                    </span>
                    <span className="text-[14px]" style={{ color: T.ink.dim }}>
                      {ROLE_HINT[r]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="m-0 border-0 p-0">
            <legend className={legend}>Languages</legend>
            <p className="mt-0 mb-2 text-[14px]" style={{ color: T.ink.dim }}>
              The languages you’d edit in. Leave it at all languages if you
              aren’t sure.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <label className="flex items-center gap-2 text-[15px]">
                <input
                  type="checkbox"
                  checked={chosenLocales.length === 0}
                  disabled={disabled}
                  onChange={() => setChosenLocales([])}
                />
                All languages
              </label>
              {locales.map((l) => (
                <label
                  key={l.code}
                  className="flex items-center gap-2 text-[15px]"
                >
                  <input
                    type="checkbox"
                    checked={chosenLocales.includes(l.code)}
                    disabled={disabled}
                    onChange={() => toggleLocale(l.code)}
                  />
                  {l.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <label
              htmlFor={`${ids}-statement`}
              className="text-[15px] font-semibold"
            >
              Why you’re applying
            </label>
            <span
              id={`${ids}-statement-hint`}
              className="text-[14px]"
              style={{ color: T.ink.dim }}
            >
              What you’d like to work on and what you’ve done so far.
            </span>
            <textarea
              id={`${ids}-statement`}
              rows={6}
              value={statement}
              disabled={disabled}
              aria-describedby={`${ids}-statement-hint ${ids}-statement-count`}
              onChange={(e) => setStatement(e.target.value)}
              style={{ ...input, resize: "vertical", lineHeight: 1.6 }}
            />
            <span
              id={`${ids}-statement-count`}
              className="self-end text-[13px]"
              style={{
                color:
                  statementLength > APPLICATION_STATEMENT_MAX
                    ? T.accent.danger
                    : T.ink.dim,
              }}
            >
              {statementLength} / {APPLICATION_STATEMENT_MAX}
            </span>
          </div>

          <fieldset className="m-0 border-0 p-0">
            <legend className={legend}>
              Samples of your work{" "}
              <span className="font-normal" style={{ color: T.ink.dim }}>
                · Optional, up to {APPLICATION_SAMPLES_MAX}
              </span>
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
                  disabled={disabled}
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
                disabled={disabled}
                onClick={() => setSamples((prev) => [...prev, ""])}
                className="mt-2 inline-flex items-center gap-1 rounded-full px-4 py-2 text-[14px] font-semibold disabled:opacity-60"
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

          {openForRole ? (
            <p
              className="m-0 flex items-center gap-1.5 text-[15px]"
              style={{ color: T.ink.dim }}
            >
              <Icon aria-hidden="true" icon="mdi:clock-outline" width={18} />
              You already have an application for this role. Wait for a
              moderator to decide on it.
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="m-0 text-[14px] font-semibold"
              style={{ color: T.accent.danger }}
            >
              {error}
            </p>
          ) : null}

          <div>
            <button
              type="submit"
              disabled={disabled || openForRole}
              className="rounded-full bg-(--t-accent-primary) px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
              style={{ border: "none", fontFamily: T.font.sans }}
            >
              {state === "sending" ? "Sending…" : "Send application"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
