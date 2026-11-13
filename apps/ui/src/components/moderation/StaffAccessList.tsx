"use client"
import { Icon } from "@iconify/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { Avatar, Badge, NOTICE_TONES, Sheet } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { redirectForReauthentication } from "@/lib/fresh-auth"
import { useRouter } from "@/lib/navigation"

/** One person with staff access: `GET /api/moderation/staff/[libraryId]`. */
export type StaffAccessRow = {
  affiliationDocumentId: string
  name: string
  staffRole: "owner" | "editor"
  source: "claim" | "team" | "network" | null
  approvedAt: string | null
  canRemove: boolean
}

const PILL =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-(--t-bg-deep) px-4 text-sm font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:opacity-50"
const PRIMARY_DANGER =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-white disabled:opacity-50"

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?"

/**
 * Everyone with staff access to one library, for a Moderator: level, how
 * they got it and since when, with "Remove from staff" behind a confirm
 * sheet. Removal goes through the existing moderation route; Strapi
 * re-checks the scope, ends any live session and emails the person.
 */
export function StaffAccessList({
  libraryName,
  rows: initialRows,
}: {
  readonly libraryName: string
  readonly rows: StaffAccessRow[]
}) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const router = useRouter()
  const locale = useLocale()
  const [rows, setRows] = useState(initialRows)
  const [removing, setRemoving] = useState<StaffAccessRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [announce, setAnnounce] = useState("")
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(iso))

  async function remove(row: StaffAccessRow) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(
        `/api/moderation/staff/${encodeURIComponent(row.affiliationDocumentId)}/remove`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string } | string
        } | null
        if (body && redirectForReauthentication(body)) return
        const message =
          typeof body?.error === "string" ? body.error : body?.error?.message
        throw new Error(
          res.status === 429
            ? "Too many changes in a short time. Wait a moment, then try again."
            : (message ?? "The removal could not be saved.")
        )
      }
      setRows((all) =>
        all.filter((r) => r.affiliationDocumentId !== row.affiliationDocumentId)
      )
      setRemoving(null)
      setAnnounce(
        `${row.name} removed from ${libraryName}’s staff. They’ve been emailed and any live session they started has stopped.`
      )
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="staff-access-heading"
      className="rounded-[20px] border p-6"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <h2 id="staff-access-heading" className="type-h2 m-0">
        Staff ({rows.length})
      </h2>
      <p className="m-0 mt-1 text-sm" style={{ color: T.ink.dim }}>
        {tStatic(
          "moderation.everyone_who_can_publish_to_this_record_removing_someone_ends_their_access_now_and_is_recorded_in_th"
        )}
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      {announce ? (
        <p
          className="m-0 mt-4 flex items-start gap-2 rounded-[16px] px-4 py-3 text-sm"
          style={{ background: NOTICE_TONES.ok.bg, color: NOTICE_TONES.ok.fg }}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:check-circle-outline"
            width={18}
            height={18}
            className="mt-0.5 shrink-0"
          />
          {announce}
        </p>
      ) : null}
      {error && !removing ? (
        <p
          role="alert"
          className="m-0 mt-4 text-sm"
          style={{ color: T.accent.danger }}
        >
          {error}
        </p>
      ) : null}
      {rows.length ? (
        <ul
          className="m-0 mt-4 list-none divide-y p-0"
          style={{ borderColor: T.border.divider }}
        >
          {rows.map((row, index) => (
            <li
              key={row.affiliationDocumentId}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
              style={{ borderColor: T.border.divider }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  initials={initialsOf(row.name)}
                  index={index}
                  size="lg"
                  title={row.name}
                />
                <div className="min-w-0">
                  <p
                    className="m-0 font-semibold break-words"
                    style={{ color: T.ink.base }}
                  >
                    {row.name}
                  </p>
                  <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
                    {row.source === "team"
                      ? "Assigned by a Team"
                      : row.source === "network"
                        ? "Service mandate"
                        : row.source === "claim"
                          ? "Approved claim"
                          : tExisting("dashboard.staff")}
                    {row.approvedAt ? ` · since ${date(row.approvedAt)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  label={
                    row.staffRole === "owner"
                      ? tExisting("teamInvitation.owner")
                      : tExisting("authorBadges.editor")
                  }
                  color="dim"
                />
                {row.canRemove ? (
                  <button
                    type="button"
                    className={PILL}
                    style={{ borderColor: T.border.hi, color: T.accent.danger }}
                    disabled={busy}
                    onClick={() => {
                      setError("")
                      setRemoving(row)
                    }}
                  >
                    <Icon
                      aria-hidden="true"
                      icon="mdi:account-minus-outline"
                      width={16}
                      height={16}
                    />
                    {tStatic("moderation.remove_from_staff")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-4 text-base" style={{ color: T.ink.dim }}>
          {tStatic("moderation.nobody_has_staff_access_to_this_library")}
        </p>
      )}
      <Sheet
        open={removing !== null}
        onClose={() => !busy && setRemoving(null)}
        side="bottom"
        title={
          removing
            ? `Remove ${removing.name} from ${libraryName}?`
            : tStatic("moderation.remove_from_staff")
        }
      >
        <p className="m-0 mb-5 text-base" style={{ color: T.ink.dim }}>
          {tStatic(
            "moderation.their_staff_access_ends_now_any_live_session_they_started_stops_and_they_re_emailed_they_can_claim_t"
          )}
        </p>
        {error ? (
          <p
            role="alert"
            className="m-0 mb-4 text-sm"
            style={{ color: T.accent.danger }}
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={PRIMARY_DANGER}
            style={{ background: T.action.danger }}
            disabled={busy}
            onClick={() => removing && void remove(removing)}
          >
            {busy ? "Removing…" : tStatic("moderation.remove_from_staff")}
          </button>
          <button
            type="button"
            className={PILL}
            style={{ borderColor: T.border.hi, color: T.ink.base }}
            disabled={busy}
            onClick={() => setRemoving(null)}
          >
            {tStatic("moderation.keep")}
          </button>
        </div>
      </Sheet>
    </section>
  )
}
