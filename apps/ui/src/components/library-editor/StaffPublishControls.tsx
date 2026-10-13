"use client"

import { Icon } from "@iconify/react"
import {
  isModeratedLibraryChange,
  timetableHash,
  normalizeMobileTimetable,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import { Sheet, PublishBar } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { primaryCtaSm } from "@/lib/styles"

import { recordChangesPayload, stepFields } from "./wizard.changes"
import { fieldInputStyle } from "./wizard.constants"
import { wizardSteps, wizardStepCopy } from "./wizard.steps"
import type { FormData } from "./wizard.types"

const OUTLINED_PILL =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-4 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface) disabled:opacity-60"

type StaleField = { field: string; byName?: string | null; changedAt: string }

/** The form keys a stale library field maps onto (coordinates travel as a pair). */
function formKeysOf(field: string): (keyof FormData)[] {
  if (field === "location") return ["lat", "lng"]
  if (
    ["continent", "country", "region", "area"].includes(field) &&
    !field.endsWith("DocumentId")
  )
    return [`${field}DocumentId` as keyof FormData]

  return [field as keyof FormData]
}

export function StaffPublishControls({
  id,
  slug,
  initial,
  current,
  draftId,
  locale,
  onPublished,
  onDiscard,
  onStale,
  publicPath,
}: {
  id: string
  /** The record's slug, to reload a field another staff member changed. */
  slug?: string
  initial: FormData
  current: FormData
  draftId: string | null
  locale?: string
  onPublished: () => void
  onDiscard: () => void
  /** Called with the live values of only the fields that were stale. */
  onStale?: (fresh: Partial<FormData>) => void
  publicPath?: string
}) {
  const tUi = useUiTranslations("ui")

  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState("")
  const mobile = current.libraryType === "Mobile"
  const payload = recordChangesPayload(initial, current)
  const fields = Object.fromEntries(
    Object.entries(payload).filter(
      ([k]) => k !== "kind" && k !== "previous" && k !== "previousHash"
    )
  )
  const keys = Object.keys(fields),
    requested = keys.filter((k) => isModeratedLibraryChange(k, fields[k])),
    published = keys.filter((k) => !requested.includes(k))
  const label = (key: string) =>
    key
      .replace(/DocumentId$/, "")
      .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (c) => c.toUpperCase())
  /** Loads only the stale fields' live values into the form. */
  async function reloadStale(stale: StaleField[]): Promise<boolean> {
    if (!slug || !onStale || !stale.length) return false
    try {
      const query = new URLSearchParams({ shape: "wizard" })
      if (locale) query.set("locale", locale)
      const r = await fetch(`/api/contribute/library/${slug}?${query}`, {
        cache: "no-store",
      })
      if (!r.ok) return false
      const { data } = (await r.json()) as { data: Partial<FormData> }
      const fresh: Partial<FormData> = {}
      for (const { field } of stale)
        for (const key of formKeysOf(field))
          if (key in data) (fresh as Record<string, unknown>)[key] = data[key]
      if (!Object.keys(fresh).length) return false
      onStale(fresh)

      return true
    } catch {
      return false
    }
  }
  async function publish() {
    setBusy(true)
    setError("")
    try {
      const previous = { ...(payload.previous as Record<string, unknown>) }
      if ("mobileTimetable" in fields)
        previous.mobileTimetable = timetableHash(
          normalizeMobileTimetable(previous.mobileTimetable)
        )
      const response = await fetch(`/api/staff/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields,
          previous,
          draftDocumentId: draftId ?? undefined,
          locale,
          note: note.trim() || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        if (data.error?.code === "stale") {
          const stale: StaleField[] = data.error.fields ?? []
          const who = stale
            .map(
              (f) =>
                `${f.byName ?? "Another staff member"} published a change to ${label(f.field)} at ${new Date(f.changedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
            )
            .join(" ")
          const reloaded = await reloadStale(stale)
          throw new Error(
            reloaded
              ? `${who} Their value is now shown in the form. Check it, then publish again.`
              : `${who} Reload to see their version.`
          )
        }
        throw new Error(
          data.error?.message ?? "Your changes could not be published."
        )
      }
      setStatus(
        `${data.published.length ? `Published ${data.published.length} change${data.published.length === 1 ? "" : "s"}` : "Changes sent"}${data.requested.length ? ` · ${data.requested.length} sent to a moderator` : ""} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      )
      setOpen(false)
      setNote("")
      onPublished()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Your changes could not be published."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PublishBar
        count={keys.length}
        status={
          status ? (
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{status}</span>
              {publicPath ? (
                <Link
                  href={publicPath}
                  className="inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-[3px]"
                  style={{ color: T.accent.primary }}
                >
                  {tUi("view_public_page")}{" "}
                  <Icon
                    aria-hidden="true"
                    icon="mdi:arrow-top-right"
                    width={14}
                    height={14}
                  />
                </Link>
              ) : null}
            </span>
          ) : undefined
        }
        busy={busy}
        onDiscard={() => {
          setStatus("")
          onDiscard()
        }}
        onPublish={() => {
          setError("")
          setOpen(true)
        }}
      />
      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        side="right"
        title={tUi("publish_your_changes")}
        footer={
          <button
            type="button"
            className={primaryCtaSm}
            onClick={publish}
            disabled={busy}
          >
            {busy ? "Publishing…" : "Publish changes"}
          </button>
        }
      >
        <p>
          {tUi(
            "these_changes_appear_immediately_with_your_name_in_the_record_s_history"
          )}{" "}
        </p>
        {wizardSteps(mobile)
          .filter((step) => step.n > 0)
          .map((step) => {
            const list = published.filter((key) =>
              stepFields(step.n, mobile).includes(key as keyof FormData)
            )

            return list.length ? (
              <section key={step.n}>
                <h3>{wizardStepCopy(step.n, mobile, true).label}</h3>
                <ul>
                  {list.map((key) => (
                    <li key={key}>{label(key)}</li>
                  ))}
                </ul>
              </section>
            ) : null
          })}
        {requested.length > 0 && (
          <section>
            <h3>{tUi("sent_to_a_moderator")}</h3>
            <ul>
              {requested.map((key) => (
                <li key={key}>{label(key)}</li>
              ))}
            </ul>
          </section>
        )}
        <label className="block text-[15px] font-semibold">
          {tUi("note_optional")}{" "}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            className="mt-2 w-full font-normal"
            style={{
              ...fieldInputStyle,
              minHeight: "96px",
              resize: "vertical",
            }}
          />
        </label>
        {error && (
          <div
            role="alert"
            className="mt-4 flex flex-col gap-3 rounded-[16px] px-4 py-3 text-[14px]"
            style={{ background: T.bg.surface, color: T.ink.base }}
          >
            <p className="m-0 flex items-start gap-2">
              <Icon
                aria-hidden="true"
                icon="mdi:alert-circle-outline"
                width={18}
                height={18}
                className="mt-0.5 shrink-0"
                style={{ color: T.accent.danger }}
              />
              <span>{error}</span>
            </p>
            {error.includes("Reload") && (
              <p className="m-0">
                <button
                  type="button"
                  className={OUTLINED_PILL}
                  style={{ borderColor: T.border.hi, color: T.ink.base }}
                  onClick={() => window.location.reload()}
                >
                  <Icon
                    aria-hidden="true"
                    icon="mdi:refresh"
                    width={16}
                    height={16}
                  />
                  {tUi("reload_record")}{" "}
                </button>
              </p>
            )}
          </div>
        )}
      </Sheet>
    </>
  )
}
