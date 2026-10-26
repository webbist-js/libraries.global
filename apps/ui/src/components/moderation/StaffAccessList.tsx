"use client"
import { Icon } from "@iconify/react"
import { useLocale } from "next-intl"
import { useState } from "react"

import { Avatar, Badge, NOTICE_TONES, Sheet } from "@/components/ds"
import { T } from "@/lib/design-tokens"
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
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-4 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:opacity-50"
const PRIMARY_DANGER =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-[14px] font-semibold text-white disabled:opacity-50"

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
      <h2
        id="staff-access-heading"
        className="m-0 text-[24px]"
        style={{ fontFamily: T.font.serif, fontWeight: 500 }}
      >
        Staff ({rows.length})
      </h2>
      <p className="m-0 mt-1 text-[14px]" style={{ color: T.ink.dim }}>
        Everyone who can publish to this record. Removing someone ends their
        access now and is recorded in the library’s staff audit.
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      {announce ? (
        <p
          className="m-0 mt-4 flex items-start gap-2 rounded-[16px] px-4 py-3 text-[14px]"
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
          className="m-0 mt-4 text-[14px]"
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
                  <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
                    {row.source === "team"
                      ? "Assigned by a Team"
                      : row.source === "network"
                        ? "Service mandate"
                        : row.source === "claim"
                          ? "Approved claim"
                          : "Staff"}
                    {row.approvedAt ? ` · since ${date(row.approvedAt)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  label={row.staffRole === "owner" ? "Owner" : "Editor"}
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
                    Remove from staff
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-4 text-[15px]" style={{ color: T.ink.dim }}>
          Nobody has staff access to this library.
        </p>
      )}
      <Sheet
        open={removing !== null}
        onClose={() => !busy && setRemoving(null)}
        side="bottom"
        title={
          removing
            ? `Remove ${removing.name} from ${libraryName}?`
            : "Remove from staff"
        }
      >
        <p className="m-0 mb-5 text-[15px]" style={{ color: T.ink.dim }}>
          Their staff access ends now, any live session they started stops, and
          they’re emailed. They can claim the library again later, and a
          moderator will check that claim.
        </p>
        {error ? (
          <p
            role="alert"
            className="m-0 mb-4 text-[14px]"
            style={{ color: T.accent.danger }}
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={PRIMARY_DANGER}
            style={{ background: T.accent.danger }}
            disabled={busy}
            onClick={() => removing && void remove(removing)}
          >
            {busy ? "Removing…" : "Remove from staff"}
          </button>
          <button
            type="button"
            className={PILL}
            style={{ borderColor: T.border.hi, color: T.ink.base }}
            disabled={busy}
            onClick={() => setRemoving(null)}
          >
            Keep
          </button>
        </div>
      </Sheet>
    </section>
  )
}
