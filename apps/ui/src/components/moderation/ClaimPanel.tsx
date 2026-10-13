"use client"
import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import { useState } from "react"

import { NOTICE_TONES } from "@/components/ds"
import { useCapabilities } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"

import { KeyValueList } from "./KeyValueList"

type ClaimReview = {
  affiliation: {
    documentId: string
    staffRole: "owner" | "editor"
    source: "claim" | "team" | null
    approvedAt: string | null
  } | null
  team: { name: string; staffRole: "owner" | "editor" } | null
}

function parseReview(v: unknown): ClaimReview {
  const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>
  const a = (
    r.affiliation && typeof r.affiliation === "object" ? r.affiliation : null
  ) as Record<string, unknown> | null
  const t = (r.team && typeof r.team === "object" ? r.team : null) as Record<
    string,
    unknown
  > | null

  return {
    affiliation:
      a && typeof a.documentId === "string"
        ? {
            documentId: a.documentId,
            staffRole: a.staffRole === "owner" ? "owner" : "editor",
            source:
              a.source === "team" || a.source === "claim" ? a.source : null,
            approvedAt: typeof a.approvedAt === "string" ? a.approvedAt : null,
          }
        : null,
    team:
      t && typeof t.name === "string"
        ? {
            name: t.name,
            staffRole: t.staffRole === "owner" ? "owner" : "editor",
          }
        : null,
  }
}

const formatDate = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso))

const PILL =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-4 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface) disabled:opacity-50"

/**
 * A Library Claim: who the claimant says they are, whether their email
 * domain matches the library's website (the domain check), the Team that
 * filed it (an unverified Team's organiser assigning a member) and, when
 * the claimant already holds staff access, a "Remove from staff" action
 * for Moderators of the index queue (1.3).
 */
export function ClaimPanel({
  fields: raw,
  targetSlug,
  libraryDocumentId,
  review,
  invite,
}: {
  readonly fields: unknown
  readonly targetSlug: string | null
  /** The claimed library, for "See everyone with staff access". */
  readonly libraryDocumentId?: string | null
  /** The service's `review` for a claim (`claimReview`). */
  readonly review?: unknown
  /** @deprecated The review page's old prop name; read as `review`. */
  readonly invite?: unknown
}) {
  const tUi = useUiTranslations("ui")

  const router = useRouter()
  const locale = useLocale()
  const date = (iso: string) => formatDate(iso, locale)
  const { moderationScopes } = useCapabilities()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [removed, setRemoved] = useState(false)
  const f = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >
  const { affiliation, team } = parseReview(review ?? invite)
  const canRemove = moderationScopes.some(
    (m) => m.queue === "all" || m.queue === "index"
  )
  const userDomain =
    typeof f.userEmailDomain === "string" ? f.userEmailDomain : ""
  const siteDomain =
    typeof f.libraryWebsiteDomain === "string" ? f.libraryWebsiteDomain : ""
  const hasDomains = !!(userDomain && siteDomain)
  const match =
    hasDomains && userDomain.toLowerCase() === siteDomain.toLowerCase()

  async function remove() {
    if (!affiliation) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(
        `/api/moderation/staff/${affiliation.documentId}/remove`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string } | string
        } | null
        const message =
          typeof body?.error === "string" ? body.error : body?.error?.message
        throw new Error(message ?? "The removal could not be saved.")
      }
      setRemoved(true)
      setConfirming(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {team && (
        <p
          className="m-0 rounded-[14px] border px-4 py-3 text-[14px]"
          style={{ borderColor: T.border.line }}
        >
          Filed by <strong>{team.name}</strong>’s organiser, who assigned the
          claimant as {team.staffRole}. The Team isn’t verified yet, so check
          the claimant’s relationship to the library before approving.
        </p>
      )}
      {hasDomains ? (
        <div
          className="flex items-start gap-2.5 rounded-[14px] px-4 py-3 text-[14px] leading-[1.55]"
          style={{
            background: match ? NOTICE_TONES.ok.bg : NOTICE_TONES.warn.bg,
            color: match ? NOTICE_TONES.ok.fg : NOTICE_TONES.warn.fg,
          }}
        >
          <Icon
            aria-hidden="true"
            icon={match ? "mdi:check-decagram-outline" : "mdi:alert-outline"}
            width={20}
            height={20}
            className="mt-0.5 shrink-0"
          />
          <div>
            <p className="m-0 font-semibold">
              {match ? "Domain match" : "Domain mismatch"}
            </p>
            <p className="m-0">
              {match
                ? `The claimant's email domain (${userDomain}) matches the library's website.`
                : `The claimant's email domain (${userDomain}) doesn't match the library's website (${siteDomain}). Verify by another route before approving.`}
            </p>
          </div>
        </div>
      ) : (
        <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
          No domain check: the claim has no email or website domain to compare.
        </p>
      )}
      <KeyValueList
        rows={[
          { label: tUi("library"), value: f.name ?? targetSlug ?? "" },
          { label: "Entity ref", value: f.entityRef ?? "" },
          {
            label: "Role",
            value:
              typeof f.role === "string" ? f.role.replaceAll("_", " ") : "",
          },
          { label: "Department", value: f.department ?? "" },
          { label: "Verification method", value: f.verificationMethod ?? "" },
          { label: "User email domain", value: userDomain },
          {
            label: "Website given by claimant (unverified)",
            value: siteDomain || (f.claimedWebsiteDomain ?? ""),
          },
        ].filter((r) => r.value)}
      />
      {affiliation && !removed ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-4 py-3 text-[14px]"
          style={{ borderColor: T.border.line, background: T.bg.surface }}
        >
          <p className="m-0">
            <strong>Currently staff</strong> ·{" "}
            {affiliation.staffRole === "owner" ? "Owner" : "Editor"}
            {affiliation.approvedAt
              ? ` since ${date(affiliation.approvedAt)}`
              : ""}
            {affiliation.source === "team" ? " · assigned by a Team" : ""}
          </p>
          {canRemove ? (
            confirming ? (
              <span className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold text-white disabled:opacity-50"
                  style={{ background: T.accent.danger }}
                  onClick={() => void remove()}
                >
                  {busy ? "Removing…" : "Confirm removal"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={PILL}
                  style={{ borderColor: T.border.hi, color: T.ink.base }}
                  onClick={() => setConfirming(false)}
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                className={PILL}
                style={{ borderColor: T.border.hi, color: T.accent.danger }}
                onClick={() => setConfirming(true)}
              >
                <Icon
                  aria-hidden="true"
                  icon="mdi:account-minus-outline"
                  width={16}
                  height={16}
                />
                Remove from staff
              </button>
            )
          ) : null}
        </div>
      ) : null}
      <p
        role="status"
        aria-live="polite"
        className={removed ? "m-0 text-[14px]" : "sr-only"}
        style={{ color: T.accent.ok }}
      >
        {removed
          ? "Removed from the library’s staff. They’ve been emailed and any live session they started has stopped."
          : ""}
      </p>
      {libraryDocumentId && canRemove ? (
        <p className="m-0">
          <Link
            href={`/contribute/moderation/staff/${encodeURIComponent(libraryDocumentId)}`}
            className="inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            See everyone with staff access
            <Icon
              aria-hidden="true"
              icon="mdi:arrow-right"
              width={15}
              height={15}
            />
          </Link>
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="m-0 text-[14px]"
          style={{ color: T.accent.danger }}
        >
          {error}
        </p>
      ) : null}
      <p
        className="m-0 text-[14px] leading-[1.55]"
        style={{ color: T.ink.dim }}
      >
        Approving records the affiliation and raises the claimant to Verified
        librarian. Roles are never lowered.
      </p>
    </div>
  )
}
