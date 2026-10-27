"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { Badge, Notice } from "@/components/ds"
import { LocationHierarchySelector } from "@/components/library-editor/LocationHierarchySelector"
import {
  EMPTY_FORM,
  type FormData,
} from "@/components/library-editor/wizard.types"
import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"
import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"

import { KeyValueList } from "./KeyValueList"
import {
  decisionErrorMessage,
  EXCLUDE_FROM_OTHER,
  FIELD_GROUPS,
  humanise,
  isHttpUrl,
} from "./submissionMeta"

const RELATION_KEYS = ["services", "amenities", "accessibility"] as const
const PLACES = ["continent", "country", "region", "area"] as const
type Place = (typeof PLACES)[number]

const SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-5 py-2.5 text-base font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-60"

const asRecord = (v: unknown) =>
  (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<
    string,
    unknown
  >
const idOf = (v: unknown) => (typeof v === "string" ? v : "")

function GroupHeading({ children }: { children: string }) {
  return (
    <h3 className="type-small-heading m-0 mb-2" style={{ color: T.ink.dim }}>
      {children}
    </h3>
  )
}

/** Option names for the relation ids in `fields`, from the moderation API. */
function RelationNames({ type, ids }: { type: string; ids: string[] }) {
  const [labels, setLabels] = useState<Record<string, string>>({})

  useEffect(() => {
    if (ids.length === 0) return
    fetch(`/api/moderation/relation-labels?type=${encodeURIComponent(type)}`)
      .then((r) => (r.ok ? r.json() : { data: {} }))
      .then((j: { data?: Record<string, string> }) => setLabels(j.data ?? {}))
      .catch(() => {})
  }, [type, ids.length])

  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <Badge
          key={id}
          label={labels[id] ?? `Unknown option (${id.slice(0, 8)}…)`}
          color="dim"
        />
      ))}
    </div>
  )
}

type Image = { url?: unknown; isHero?: unknown }

function Photos({ images }: { images: Image[] }) {
  const tUi = useUiTranslations("ui")

  const shown = images.flatMap((img, i) => {
    const raw = typeof img.url === "string" ? img.url.trim() : ""
    const ok = isHttpUrl(raw) || /^\/uploads\/[^\s]+$/.test(raw)
    const src = ok ? formatStrapiMediaUrlForClient(raw) : undefined

    return src ? [{ src, hero: img.isHero === true, key: `${i}-${raw}` }] : []
  })
  if (shown.length === 0) return null

  return (
    <div>
      <GroupHeading>Photos</GroupHeading>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        {shown.map((p, i) => (
          <li key={p.key} className="flex flex-col gap-1">
            <a href={p.src} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt={`Submitted photo ${i + 1}`}
                className="block h-32 w-48 rounded-[14px] object-cover"
                style={{ border: `1px solid ${T.border.line}` }}
              />
            </a>
            {p.hero ? <Badge label={tUi("main_image")} color="aurora" /> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * A submission's `fields`, grouped as the Index editor groups them, with
 * option names, photos and an "Other" group for anything else. The
 * fallback panel for types without one of their own.
 */
export function FieldsList({ fields: raw }: { readonly fields: unknown }) {
  const fields = asRecord(raw)
  if (Object.keys(fields).length === 0)
    return (
      <p className="m-0 text-base" style={{ color: T.ink.dim }}>
        No details in this submission.
      </p>
    )
  const present = (k: string) =>
    fields[k] !== undefined && fields[k] !== null && fields[k] !== ""
  const used = new Set(FIELD_GROUPS.flatMap((g) => g.keys))
  const other = Object.keys(fields).filter(
    (k) => !used.has(k) && !EXCLUDE_FROM_OTHER.has(k) && present(k)
  )
  const images: Image[] = [
    ...(Array.isArray(fields.uploadedImages)
      ? (fields.uploadedImages as Image[])
      : []),
    ...(fields.kind === "photo" && typeof fields.photoUrl === "string"
      ? [{ url: fields.photoUrl }]
      : []),
  ]

  return (
    <div className="flex flex-col gap-5">
      {FIELD_GROUPS.map((group) => {
        const keys = group.keys.filter(present)
        if (keys.length === 0) return null

        return (
          <div key={group.label}>
            <GroupHeading>{group.label}</GroupHeading>
            <KeyValueList
              rows={keys.map((k) => ({ label: humanise(k), value: fields[k] }))}
            />
          </div>
        )
      })}
      {other.length > 0 ? (
        <div>
          <GroupHeading>Other</GroupHeading>
          <KeyValueList
            rows={other.map((k) => ({ label: humanise(k), value: fields[k] }))}
          />
        </div>
      ) : null}
      {RELATION_KEYS.map((key) => {
        const ids = Array.isArray(fields[key])
          ? (fields[key] as unknown[]).filter(
              (x): x is string => typeof x === "string"
            )
          : []

        return ids.length > 0 ? (
          <div key={key}>
            <GroupHeading>{humanise(key)}</GroupHeading>
            <RelationNames type={key} ids={ids} />
          </div>
        ) : null
      })}
      <Photos images={images} />
    </div>
  )
}

/** The place the library will be filed under: the moderator's, else the submitter's. */
function initialPlace(
  fields: Record<string, unknown>,
  draftData: Record<string, unknown>
): FormData {
  const target = asRecord(draftData.moderatorTarget)
  const useTarget = PLACES.some((p) => idOf(target[p]))
  const pick = (p: Place) =>
    useTarget ? idOf(target[p]) : idOf(fields[`${p}DocumentId`])

  return {
    ...EMPTY_FORM,
    continentDocumentId: pick("continent"),
    countryDocumentId: pick("country"),
    regionDocumentId: pick("region"),
    areaDocumentId: pick("area"),
  }
}

/**
 * A proposed new library: its fields, and where in the atlas it will be
 * filed. While the submission is open the Moderator can change that place
 * (Strapi's `target` route); publishing on approval needs a continent,
 * country and region.
 */
export function NewLibraryPanel({
  documentId,
  status,
  fields,
  draftData,
}: {
  readonly documentId: string
  readonly status: string
  readonly fields: Record<string, unknown> | null
  readonly draftData: Record<string, unknown> | null
}) {
  const tUi = useUiTranslations("ui")

  const router = useRouter()
  const editable = status === "pending" || status === "needs_info"
  const [place, setPlace] = useState<FormData>(() =>
    initialPlace(fields ?? {}, draftData ?? {})
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{
    ok: boolean
    text: string
  } | null>(null)

  async function save() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/moderation/submissions/${encodeURIComponent(documentId)}/target`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            continent: place.continentDocumentId || null,
            country: place.countryDocumentId || null,
            region: place.regionDocumentId || null,
            area: place.areaDocumentId || null,
          }),
        }
      )
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage({ ok: false, text: decisionErrorMessage(res.status, body) })

        return
      }
      setMessage({
        ok: true,
        text: "Location saved. It is used when you approve.",
      })
      router.refresh()
    } catch {
      setMessage({
        ok: false,
        text: "Something went wrong. Check your connection and try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  const complete =
    !!place.continentDocumentId &&
    !!place.countryDocumentId &&
    !!place.regionDocumentId
  const creation = asRecord(asRecord(draftData).staffCreation)

  return (
    <div className="flex flex-col gap-6">
      {Object.keys(creation).length > 0 && (
        <Notice
          icon="mdi:shield-account-outline"
          tone="warn"
          title={tUi("staff_ownership_requested")}
        >
          <p className="m-0">
            Approval also grants the submitter owner access to this library.
            {typeof creation.teamName === "string" &&
              ` It adds the library to ${creation.teamName}’s Team coverage.`}{" "}
            Verify their staff relationship and service before approving.
          </p>
        </Notice>
      )}
      <FieldsList fields={fields ?? {}} />
      <fieldset
        className="m-0 flex flex-col gap-3 rounded-[14px] p-4"
        style={{
          border: `1px solid ${T.border.line}`,
          background: T.bg.surface,
        }}
        disabled={!editable || busy}
      >
        <legend
          className="px-1 text-base font-semibold"
          style={{ color: T.ink.base }}
        >
          Where it goes in the atlas
        </legend>
        <LocationHierarchySelector f={place} setFormData={setPlace} />
        {editable ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={SECONDARY}
              style={{ color: T.ink.base }}
              onClick={() => void save()}
            >
              {busy ? tUi("saving") : "Save location"}
            </button>
            {!complete ? (
              <span className="text-sm" style={{ color: T.ink.dim }}>
                Approve and publish needs a continent, country and region.
              </span>
            ) : null}
          </div>
        ) : null}
        <p
          aria-live="polite"
          role={message && !message.ok ? "alert" : undefined}
          className="m-0 text-sm"
          style={{ color: message?.ok ? T.accent.ok : T.accent.danger }}
        >
          {message?.text}
        </p>
      </fieldset>
    </div>
  )
}
