"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import {
  Select as RadixSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCreateSubmission,
  useFinalizeDraft,
  useResumeDraft,
  useSaveDraft,
} from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"
import { auroraCtaSm } from "@/lib/styles"

import { AddLibraryHero } from "./AddLibraryHero"
import { LibrarySearchGate } from "./LibrarySearchGate"
import {
  emptyOpeningTimes,
  OpeningTimesEditor,
  type OpeningTimesData,
} from "./OpeningTimesEditor"
import { WizardCompletionSidebar } from "./WizardCompletionSidebar"
import { WizardStepNav } from "./WizardStepNav"
import { ContributeNavBar } from "../../_components/ContributeNavBar"

// ── FormData type ─────────────────────────────────────────────────────────────

export interface SocialLink {
  platform: string
  url: string
  label: string
}

export interface UploadedImage {
  strapiId: number
  url: string
  isHero: boolean
}

export interface FormData {
  // Step 1 – Identity
  name: string
  shortName: string
  libraryType: string
  operatorType: string
  operationalStatus: string
  officialName: string
  summary: string
  // Step 1 addition
  closureReason: string
  // Step 2 – Location
  streetAddress: string
  district: string
  city: string
  country: string
  postalCode: string
  lat: string
  lng: string
  // Step 2 – Hierarchy relations
  continentDocumentId: string
  countryDocumentId: string
  regionDocumentId: string
  areaDocumentId: string
  // Step 3 – Visit
  website: string
  planVisitUrl: string
  catalogueUrl: string
  membershipUrl: string
  bookingUrl: string
  virtualTourUrl: string
  virtualTourEmbed: string
  donationUrl: string
  admissionInfo: string
  visitNotes: string
  accessibilityNotes: string
  phone: string
  email: string
  transitInfo: string
  languagesServed: string
  // Step 3 – Opening times
  openingTimes: OpeningTimesData
  // Step 3 – Relations
  services: string[]
  amenities: string[]
  accessibility: string[]
  // Step 3 – Social links
  socialLinks: SocialLink[]
  // Step 4 – Collections
  collectionSize: string
  collectionTypes: string
  specialCollections: string
  classificationSystem: string
  iiifEndpoint: string
  // Step 5 – Building
  foundedYear: string
  openedYear: string
  closedYear: string
  architect: string
  architecturalStyle: string
  buildingInfo: string
  // Step 6 – Imagery
  uploadedImages: UploadedImage[]
  imageCredit: string
  imageNote: string
  // Step 7 – Sources
  evidenceType: string
  evidenceUrl: string
  source: string
  sourceUrl: string
  editSummary: string
  note: string
}

const EMPTY_FORM: FormData = {
  name: "",
  shortName: "",
  libraryType: "",
  operatorType: "",
  operationalStatus: "",
  officialName: "",
  summary: "",
  closureReason: "",
  streetAddress: "",
  district: "",
  city: "",
  country: "",
  postalCode: "",
  lat: "",
  lng: "",
  continentDocumentId: "",
  countryDocumentId: "",
  regionDocumentId: "",
  areaDocumentId: "",
  website: "",
  planVisitUrl: "",
  catalogueUrl: "",
  membershipUrl: "",
  bookingUrl: "",
  virtualTourUrl: "",
  virtualTourEmbed: "",
  donationUrl: "",
  admissionInfo: "",
  visitNotes: "",
  accessibilityNotes: "",
  phone: "",
  email: "",
  transitInfo: "",
  languagesServed: "",
  openingTimes: emptyOpeningTimes(),
  services: [],
  amenities: [],
  accessibility: [],
  socialLinks: [],
  collectionSize: "",
  collectionTypes: "",
  specialCollections: "",
  classificationSystem: "",
  iiifEndpoint: "",
  foundedYear: "",
  openedYear: "",
  closedYear: "",
  architect: "",
  architecturalStyle: "",
  buildingInfo: "",
  uploadedImages: [],
  imageCredit: "",
  imageNote: "",
  evidenceType: "",
  evidenceUrl: "",
  source: "",
  sourceUrl: "",
  editSummary: "",
  note: "",
}

// ── Completeness score — one check per step ──────────────────────────────────
// 7 binary checks, one per step; filling a step fully ticks its check.

export function calcScore(f: FormData): number {
  const checks = [
    // Step 1: identity essentials
    !!f.name && !!f.libraryType && !!f.operationalStatus,
    // Step 2: location essentials
    !!f.city && !!f.country,
    // Step 3: contact — at least one web URL
    !!(f.website || f.catalogueUrl),
    // Step 4: collections — at least a size
    !!f.collectionSize,
    // Step 5: history — at least a founded year
    !!f.foundedYear,
    // Step 6: imagery — at least one uploaded image
    f.uploadedImages.length > 0,
    // Step 7: sources — evidence URL + summary
    !!f.evidenceUrl && !!f.editSummary,
  ]

  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

// ── Design tokens for field elements ─────────────────────────────────────────

const fieldInputStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "8px",
  border: `1px solid ${T.border.hi}`,
  background: "rgba(255,255,255,0.03)",
  color: T.ink.base,
  fontSize: "14px",
  fontFamily: T.font.sans,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
}

const fieldLabelStyle: React.CSSProperties = {
  fontFamily: T.font.mono,
  fontSize: "11px",
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: T.ink.faint,
  display: "flex",
  alignItems: "center",
  gap: "6px",
}

// ── ScoreTag — aurora diamond shown on fields that count toward the score ─────

function ScoreTag() {
  return (
    <span
      title="This field counts toward your completeness score"
      style={{
        fontFamily: T.font.mono,
        fontSize: "9px",
        letterSpacing: ".1em",
        color: T.accent.aurora,
        opacity: 0.7,
        userSelect: "none",
      }}
    >
      ◈
    </span>
  )
}

// ── Field primitive ───────────────────────────────────────────────────────────

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  score,
  hint,
  autoComplete,
}: {
  label: string
  id: keyof FormData
  value: string
  onChange: (name: keyof FormData, val: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  score?: boolean
  hint?: string
  autoComplete?: string
}) {
  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label htmlFor={id} style={fieldLabelStyle}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: T.accent.danger }}>
            *
          </span>
        )}
        {score && <ScoreTag />}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-required={required}
        aria-describedby={hintId}
        autoComplete={autoComplete}
        style={fieldInputStyle}
      />
      {hint && (
        <p
          id={hintId}
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            color: T.ink.faint,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

// ── WizardSelect primitive (Radix, accessible) ────────────────────────────────

function WizardSelect({
  label,
  id,
  value,
  onChange,
  options,
  required,
  score,
}: {
  label: string
  id: keyof FormData
  value: string
  onChange: (name: keyof FormData, val: string) => void
  options: { value: string; label: string }[]
  required?: boolean
  score?: boolean
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {/* Radix Select doesn't support htmlFor; aria-labelledby used instead */}
      <span id={`${id}-label`} style={fieldLabelStyle} aria-hidden="false">
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: T.accent.danger }}>
            *
          </span>
        )}
        {score && <ScoreTag />}
      </span>
      <RadixSelect
        value={value}
        onValueChange={(v) => onChange(id, v)}
        required={required}
        name={id}
      >
        <SelectTrigger
          aria-labelledby={`${id}-label`}
          aria-required={required}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "8px",
            border: `1px solid ${T.border.hi}`,
            background: "rgba(5,8,22,1)",
            color: value ? T.ink.base : T.ink.faint,
            fontSize: "14px",
            fontFamily: T.font.sans,
            height: "auto",
            minHeight: "42px",
            justifyContent: "space-between",
            outline: "none",
            boxSizing: "border-box",
          }}
        >
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent
          style={{
            background: "rgba(6,9,26,0.98)",
            border: "1px solid rgba(255,255,255,0.09)",
            backdropFilter: "blur(20px)",
            borderRadius: "8px",
            zIndex: 9999,
          }}
        >
          {options.map((o) => (
            <SelectItem
              key={o.value}
              value={o.value}
              style={{
                color: T.ink.base,
                fontSize: "14px",
                fontFamily: T.font.sans,
                cursor: "pointer",
              }}
            >
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </RadixSelect>
    </div>
  )
}

// ── TextareaField primitive ───────────────────────────────────────────────────

function TextareaField({
  label,
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
  hint,
  score,
}: {
  label: string
  id: keyof FormData
  value: string
  onChange: (name: keyof FormData, val: string) => void
  placeholder?: string
  rows?: number
  hint?: string
  score?: boolean
}) {
  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label htmlFor={id} style={fieldLabelStyle}>
        {label}
        {score && <ScoreTag />}
      </label>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-describedby={hintId}
        style={{ ...fieldInputStyle, resize: "vertical", lineHeight: 1.6 }}
      />
      {hint && (
        <p
          id={hintId}
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            color: T.ink.faint,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

// ── TagSelector — chip multi-select for relation fields ───────────────────────

function TagSelector({
  label,
  endpoint,
  value,
  onChange,
  hint,
}: {
  label: string
  endpoint: string
  value: string[]
  onChange: (ids: string[]) => void
  hint?: string
}) {
  const [options, setOptions] = useState<
    { documentId: string; name: string }[]
  >([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetch(endpoint)
      .then((r) => r.json())
      .then((j) => setOptions(j.data ?? []))
      .catch(() => {})
  }, [endpoint])

  const toggle = (id: string) => {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
    )
  }

  // Show selected first, then unselected up to limit
  const selected = options.filter((o) => value.includes(o.documentId))
  const unselected = options.filter((o) => !value.includes(o.documentId))
  const LIMIT = 12
  const visibleUnselected = showAll ? unselected : unselected.slice(0, LIMIT)
  const overflow = unselected.length - LIMIT

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <span style={fieldLabelStyle}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {selected.map((o) => (
          <button
            key={o.documentId}
            type="button"
            onClick={() => toggle(o.documentId)}
            style={{
              padding: "6px 12px",
              borderRadius: "20px",
              border: `1px solid ${T.accent.aurora}`,
              background: "rgba(127,223,255,0.1)",
              color: T.accent.aurora,
              fontSize: "13px",
              fontFamily: T.font.sans,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              lineHeight: 1,
            }}
          >
            {o.name}
            <span style={{ opacity: 0.6, fontSize: "11px" }}>×</span>
          </button>
        ))}
        {visibleUnselected.map((o) => (
          <button
            key={o.documentId}
            type="button"
            onClick={() => toggle(o.documentId)}
            style={{
              padding: "6px 12px",
              borderRadius: "20px",
              border: `1px solid ${T.border.hi}`,
              background: "transparent",
              color: T.ink.dim,
              fontSize: "13px",
              fontFamily: T.font.sans,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            + {o.name}
          </button>
        ))}
        {!showAll && overflow > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            style={{
              padding: "6px 12px",
              borderRadius: "20px",
              border: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.faint,
              fontSize: "13px",
              fontFamily: T.font.sans,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            + search {overflow} more…
          </button>
        )}
      </div>
      {hint && (
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            color: T.ink.faint,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

// ── Sub-section divider ───────────────────────────────────────────────────────

function SubSection({ label, sub }: { label: string; sub?: string }) {
  return (
    <div
      style={{
        borderTop: `1px solid ${T.border.line}`,
        paddingTop: "18px",
        marginTop: "4px",
      }}
    >
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "11px",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: T.ink.faint,
          margin: "0 0 4px",
        }}
      >
        Sub-section
      </p>
      <h3
        style={{
          fontFamily: T.font.serif,
          fontSize: "22px",
          fontWeight: 600,
          color: T.ink.base,
          margin: "0 0 4px",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </h3>
      {sub && (
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.dim,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}

// ── Step header ───────────────────────────────────────────────────────────────

function StepHeader({
  n,
  title,
  sub,
}: {
  n: number
  title: string
  sub: string
}) {
  return (
    <div style={{ marginBottom: "4px" }}>
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "11px",
          letterSpacing: ".16em",
          textTransform: "uppercase",
          color: T.accent.aurora,
          margin: "0 0 6px",
          opacity: 0.8,
        }}
      >
        Step {n} of 7
      </p>
      <h2
        style={{
          fontFamily: T.font.serif,
          fontSize: "32px",
          fontWeight: 600,
          color: T.ink.base,
          margin: "0 0 8px",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "14px",
          color: T.ink.dim,
          margin: 0,
          lineHeight: 1.55,
          maxWidth: "54ch",
        }}
      >
        {sub}
      </p>
    </div>
  )
}

// ── RelationOption type ───────────────────────────────────────────────────────

type RelationOption = { documentId: string; name: string }

// ── Location hierarchy selector ───────────────────────────────────────────────

function LocationHierarchySelector({
  f,
  setFormData,
}: {
  f: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
}) {
  const [continents, setContinents] = useState<RelationOption[]>([])
  const [countries, setCountries] = useState<RelationOption[]>([])
  const [regions, setRegions] = useState<RelationOption[]>([])
  const [areas, setAreas] = useState<RelationOption[]>([])

  useEffect(() => {
    fetch("/api/relations/continents")
      .then((r) => r.json())
      .then((j) => setContinents(j.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!f.continentDocumentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountries([])

      return
    }
    fetch(
      `/api/relations/countries?continentDocumentId=${encodeURIComponent(f.continentDocumentId)}`
    )
      .then((r) => r.json())
      .then((j) => setCountries(j.data ?? []))
      .catch(() => {})
  }, [f.continentDocumentId])

  useEffect(() => {
    if (!f.countryDocumentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRegions([])

      return
    }
    fetch(
      `/api/relations/regions?countryDocumentId=${encodeURIComponent(f.countryDocumentId)}`
    )
      .then((r) => r.json())
      .then((j) => setRegions(j.data ?? []))
      .catch(() => {})
  }, [f.countryDocumentId])

  useEffect(() => {
    if (!f.regionDocumentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAreas([])

      return
    }
    fetch(
      `/api/relations/areas?regionDocumentId=${encodeURIComponent(f.regionDocumentId)}`
    )
      .then((r) => r.json())
      .then((j) => setAreas(j.data ?? []))
      .catch(() => {})
  }, [f.regionDocumentId])

  const selectStyle: React.CSSProperties = {
    ...fieldInputStyle,
    cursor: "pointer",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "11px",
          color: T.ink.faint,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        Link to the content hierarchy for atlas navigation and breadcrumbs.
        Select continent first, then narrow down.
      </p>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={fieldLabelStyle} htmlFor="hier-continent">
            Continent
          </label>
          <select
            id="hier-continent"
            value={f.continentDocumentId}
            onChange={(e) => {
              const v = e.target.value
              setFormData((prev) => ({
                ...prev,
                continentDocumentId: v,
                countryDocumentId: "",
                regionDocumentId: "",
                areaDocumentId: "",
              }))
            }}
            style={selectStyle}
          >
            <option value="">— select —</option>
            {continents.map((c) => (
              <option key={c.documentId} value={c.documentId}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={fieldLabelStyle} htmlFor="hier-country">
            Country
          </label>
          <select
            id="hier-country"
            value={f.countryDocumentId}
            disabled={!f.continentDocumentId}
            onChange={(e) => {
              const v = e.target.value
              setFormData((prev) => ({
                ...prev,
                countryDocumentId: v,
                regionDocumentId: "",
                areaDocumentId: "",
              }))
            }}
            style={{
              ...selectStyle,
              opacity: f.continentDocumentId ? 1 : 0.4,
            }}
          >
            <option value="">— select —</option>
            {countries.map((c) => (
              <option key={c.documentId} value={c.documentId}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={fieldLabelStyle} htmlFor="hier-region">
            Region
          </label>
          <select
            id="hier-region"
            value={f.regionDocumentId}
            disabled={!f.countryDocumentId}
            onChange={(e) => {
              const v = e.target.value
              setFormData((prev) => ({
                ...prev,
                regionDocumentId: v,
                areaDocumentId: "",
              }))
            }}
            style={{
              ...selectStyle,
              opacity: f.countryDocumentId ? 1 : 0.4,
            }}
          >
            <option value="">— select —</option>
            {regions.map((r) => (
              <option key={r.documentId} value={r.documentId}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={fieldLabelStyle} htmlFor="hier-area">
            Area{" "}
            <span style={{ color: T.ink.faint, fontWeight: 400 }}>
              (optional)
            </span>
          </label>
          <select
            id="hier-area"
            value={f.areaDocumentId}
            disabled={!f.regionDocumentId}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                areaDocumentId: e.target.value,
              }))
            }
            style={{
              ...selectStyle,
              opacity: f.regionDocumentId ? 1 : 0.4,
            }}
          >
            <option value="">— select —</option>
            {areas.map((a) => (
              <option key={a.documentId} value={a.documentId}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

// ── Social links editor ────────────────────────────────────────────────────────

const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X (Twitter)" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "wechat", label: "WeChat" },
  { value: "threads", label: "Threads" },
  { value: "bluesky", label: "Bluesky" },
  { value: "mastodon", label: "Mastodon" },
  { value: "pinterest", label: "Pinterest" },
]

function SocialLinksEditor({
  value,
  onChange,
}: {
  value: SocialLink[]
  onChange: (links: SocialLink[]) => void
}) {
  const addLink = () =>
    onChange([...value, { platform: "facebook", url: "", label: "" }])

  const updateLink = (i: number, patch: Partial<SocialLink>) =>
    onChange(value.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const removeLink = (i: number) =>
    onChange(value.filter((_, idx) => idx !== i))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {value.map((link, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr auto",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <select
            value={link.platform}
            onChange={(e) => updateLink(i, { platform: e.target.value })}
            style={{
              ...fieldInputStyle,
              cursor: "pointer",
              padding: "9px 12px",
            }}
          >
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            type="url"
            value={link.url}
            onChange={(e) => updateLink(i, { url: e.target.value })}
            placeholder="https://"
            style={fieldInputStyle}
          />
          <button
            type="button"
            onClick={() => removeLink(i)}
            aria-label="Remove social link"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "6px",
              border: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.faint,
              fontSize: "18px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addLink}
        style={{
          padding: "8px 16px",
          borderRadius: "7px",
          border: `1px solid ${T.border.hi}`,
          background: "transparent",
          color: T.ink.dim,
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".12em",
          textTransform: "uppercase",
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
      >
        + Add social link
      </button>
    </div>
  )
}

// ── Field set constants ───────────────────────────────────────────────────────

const LIBRARY_TYPES = [
  { value: "National", label: "National" },
  { value: "Public", label: "Public" },
  { value: "Academic", label: "Academic" },
  { value: "University", label: "University" },
  { value: "Parliamentary", label: "Parliamentary" },
  { value: "State", label: "State" },
  { value: "Municipal", label: "Municipal" },
  { value: "Special", label: "Special" },
  { value: "Monastic", label: "Monastic" },
  { value: "Archive", label: "Archive" },
  { value: "Private", label: "Private" },
  { value: "Cultural", label: "Cultural" },
  { value: "Digital", label: "Digital" },
  { value: "Mobile", label: "Mobile" },
  { value: "Other", label: "Other" },
]

const OPERATOR_TYPES = [
  { value: "National Government", label: "National Government" },
  { value: "Regional Government", label: "Regional Government" },
  { value: "Municipality", label: "Municipality" },
  { value: "University", label: "University" },
  { value: "Religious Institution", label: "Religious Institution" },
  { value: "Private Foundation", label: "Private Foundation" },
  { value: "Independent", label: "Independent" },
  { value: "Volunteer Managed", label: "Volunteer Managed" },
  { value: "Community Managed", label: "Community Managed" },
  { value: "Other", label: "Other" },
]

const OPERATIONAL_STATUSES = [
  { value: "open", label: "Open" },
  { value: "temporarily_closed", label: "Temporarily Closed" },
  { value: "permanently_closed", label: "Permanently Closed" },
  { value: "seasonal", label: "Seasonal" },
  { value: "appointment_only", label: "Appointment Only" },
  { value: "planned", label: "Planned / Under Construction" },
  { value: "unknown", label: "Unknown" },
]

const EVIDENCE_TYPES = [
  { value: "institutional_url", label: "Institutional URL" },
  { value: "on_site_photo", label: "On-site Photo" },
  { value: "press_release", label: "Press Release" },
  { value: "personal_communication", label: "Personal Communication" },
  {
    value: "my_institutional_affiliation",
    label: "My Institutional Affiliation",
  },
  { value: "other", label: "Other" },
]

// ── Step 1 — Identity ─────────────────────────────────────────────────────────

function StepBasics({ f, set }: StepProps) {
  return (
    <fieldset
      style={{
        border: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <legend style={{ display: "contents" }}>
        <StepHeader
          n={1}
          title="Identity"
          sub="Core fields that drive the listing card and search index."
        />
      </legend>
      <Field
        label="Library name"
        id="name"
        value={f.name}
        onChange={set}
        required
        score
        autoComplete="organization"
      />
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <Field
          label="Short name / abbreviation"
          id="shortName"
          value={f.shortName}
          onChange={set}
          placeholder="BL, BnF, LOC"
        />
        <Field
          label="Official / formal name (if different)"
          id="officialName"
          value={f.officialName}
          onChange={set}
        />
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <WizardSelect
          label="Library type"
          id="libraryType"
          value={f.libraryType}
          onChange={set}
          options={LIBRARY_TYPES}
          required
          score
        />
        <WizardSelect
          label="Operator type"
          id="operatorType"
          value={f.operatorType}
          onChange={set}
          options={OPERATOR_TYPES}
        />
      </div>
      <WizardSelect
        label="Operational status"
        id="operationalStatus"
        value={f.operationalStatus}
        onChange={set}
        options={OPERATIONAL_STATUSES}
        required
        score
      />
      <TextareaField
        label="Summary / description"
        id="summary"
        value={f.summary}
        onChange={set}
        rows={3}
        hint="2–4 sentences. Appears in search results and listing cards."
      />
      {(f.operationalStatus === "permanently_closed" ||
        f.operationalStatus === "temporarily_closed") && (
        <TextareaField
          label="Closure reason"
          id="closureReason"
          value={f.closureReason}
          onChange={set}
          rows={2}
          hint="Briefly explain why or when the library closed."
        />
      )}
    </fieldset>
  )
}

// ── Step 2 — Location ─────────────────────────────────────────────────────────

function StepLocation({ f, set, setFormData }: StepProps) {
  return (
    <fieldset
      style={{
        border: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <legend style={{ display: "contents" }}>
        <StepHeader
          n={2}
          title="Location"
          sub="Address details and coordinates. Coordinates place the library on the map."
        />
      </legend>
      <Field
        label="Street address"
        id="streetAddress"
        value={f.streetAddress}
        onChange={set}
        autoComplete="street-address"
      />
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <Field
          label="City / Town"
          id="city"
          value={f.city}
          onChange={set}
          required
          score
          autoComplete="address-level2"
        />
        <Field
          label="District / Borough"
          id="district"
          value={f.district}
          onChange={set}
        />
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <Field
          label="Country"
          id="country"
          value={f.country}
          onChange={set}
          required
          score
          autoComplete="country-name"
        />
        <Field
          label="Postal code"
          id="postalCode"
          value={f.postalCode}
          onChange={set}
          autoComplete="postal-code"
        />
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <Field
          label="Latitude"
          id="lat"
          value={f.lat}
          onChange={set}
          placeholder="51.5297"
          hint="Right-click in Google Maps → copy coordinates"
        />
        <Field
          label="Longitude"
          id="lng"
          value={f.lng}
          onChange={set}
          placeholder="-0.1271"
        />
      </div>

      <SubSection
        label="Content hierarchy"
        sub="Link this library to its place in the atlas — used for breadcrumbs and location browsing."
      />
      <LocationHierarchySelector f={f} setFormData={setFormData} />
    </fieldset>
  )
}

// ── Step 3 — Visit ────────────────────────────────────────────────────────────

function StepVisit({
  f,
  set,
  setFormData,
}: {
  f: FormData
  set: (k: keyof FormData, v: string) => void
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
}) {
  return (
    <fieldset
      style={{
        border: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <legend style={{ display: "contents" }}>
        <StepHeader
          n={3}
          title="Visit"
          sub="URLs, contact details, admission policy, and visitor access."
        />
      </legend>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <Field
          label="Website URL"
          id="website"
          value={f.website}
          onChange={set}
          placeholder="https://"
          type="url"
          score
        />
        <Field
          label="Plan your visit URL"
          id="planVisitUrl"
          value={f.planVisitUrl}
          onChange={set}
          placeholder="https://"
          type="url"
        />
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <Field
          label="Catalogue / OPAC URL"
          id="catalogueUrl"
          value={f.catalogueUrl}
          onChange={set}
          placeholder="https://"
          type="url"
          score
          hint="◈ counts if no website URL provided"
        />
        <Field
          label="Membership / reader registration URL"
          id="membershipUrl"
          value={f.membershipUrl}
          onChange={set}
          placeholder="https://"
          type="url"
        />
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <Field
          label="Booking URL"
          id="bookingUrl"
          value={f.bookingUrl}
          onChange={set}
          placeholder="https://"
          type="url"
        />
        <Field
          label="Donation URL"
          id="donationUrl"
          value={f.donationUrl}
          onChange={set}
          placeholder="https://"
          type="url"
        />
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <Field
          label="Virtual tour URL"
          id="virtualTourUrl"
          value={f.virtualTourUrl}
          onChange={set}
          placeholder="https://"
          type="url"
        />
        <Field
          label="Virtual tour embed code"
          id="virtualTourEmbed"
          value={f.virtualTourEmbed}
          onChange={set}
          placeholder="<iframe…>"
          hint="Paste the embed snippet if you have one."
        />
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <Field
          label="Phone"
          id="phone"
          value={f.phone}
          onChange={set}
          type="tel"
          autoComplete="tel"
        />
        <Field
          label="Public email"
          id="email"
          value={f.email}
          onChange={set}
          type="email"
          autoComplete="email"
        />
      </div>
      <TextareaField
        label="Admission policy"
        id="admissionInfo"
        value={f.admissionInfo}
        onChange={set}
        placeholder="Free general admission. Reader pass required for reading rooms…"
      />
      <Field
        label="Languages served"
        id="languagesServed"
        value={f.languagesServed}
        onChange={set}
        placeholder="English, Welsh"
      />
      <TextareaField
        label="Getting there (transit info)"
        id="transitInfo"
        value={f.transitInfo}
        onChange={set}
        rows={2}
      />
      <TextareaField
        label="Visitor notes"
        id="visitNotes"
        value={f.visitNotes}
        onChange={set}
        rows={3}
        placeholder="What visitors should know — queues, bag policies, photography rules…"
      />

      {/* Opening times — hidden when permanently or temporarily closed */}
      {f.operationalStatus !== "permanently_closed" &&
        f.operationalStatus !== "temporarily_closed" && (
          <>
            <SubSection
              label="Opening hours"
              sub="Weekly schedule shown on the library detail page. Leave slots empty for days you don't have data for."
            />
            <OpeningTimesEditor
              value={f.openingTimes}
              onChange={(updated) =>
                setFormData((prev) => ({ ...prev, openingTimes: updated }))
              }
            />
          </>
        )}

      {/* Services & amenities sub-section */}
      <SubSection
        label="Services & amenities"
        sub="Tag what's actually offered — relations to canonical services / amenities / accessibility records."
      />
      <TagSelector
        label="Services — Relation · Multi"
        endpoint="/api/relations/services"
        value={f.services}
        onChange={(ids) => setFormData((prev) => ({ ...prev, services: ids }))}
      />
      <TagSelector
        label="Amenities — Relation · Multi"
        endpoint="/api/relations/amenities"
        value={f.amenities}
        onChange={(ids) => setFormData((prev) => ({ ...prev, amenities: ids }))}
      />
      <TagSelector
        label="Accessibility — Relation · Multi"
        endpoint="/api/relations/accessibility"
        value={f.accessibility}
        onChange={(ids) =>
          setFormData((prev) => ({ ...prev, accessibility: ids }))
        }
        hint="Detailed access notes (alt text for staircases, etc.) are written in the next field."
      />
      <TextareaField
        label="Accessibility notes"
        id="accessibilityNotes"
        value={f.accessibilityNotes}
        onChange={set}
        rows={3}
        placeholder="Step-free access via the courtyard entrance…"
      />

      {/* Social links sub-section */}
      <SubSection
        label="Social media"
        sub="Official social media accounts for this library."
      />
      <SocialLinksEditor
        value={f.socialLinks}
        onChange={(links) =>
          setFormData((prev) => ({ ...prev, socialLinks: links }))
        }
      />
    </fieldset>
  )
}

// ── Step 4 — Collections ──────────────────────────────────────────────────────

function StepCollections({ f, set }: StepProps) {
  return (
    <fieldset
      style={{
        border: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <legend style={{ display: "contents" }}>
        <StepHeader
          n={4}
          title="Collections"
          sub="Holdings size, types, classification system, and digital endpoints."
        />
      </legend>
      <Field
        label="Collection size (volumes / items)"
        id="collectionSize"
        value={f.collectionSize}
        onChange={set}
        score
        hint="Approximate total — include unit (e.g. '170 million items', '2.4 million volumes')"
      />
      <Field
        label="Collection types"
        id="collectionTypes"
        value={f.collectionTypes}
        onChange={set}
        placeholder="Books, Manuscripts, Maps, Sound recordings"
      />
      <TextareaField
        label="Special collections (notable holdings)"
        id="specialCollections"
        value={f.specialCollections}
        onChange={set}
      />
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <Field
          label="Classification system"
          id="classificationSystem"
          value={f.classificationSystem}
          onChange={set}
          placeholder="Dewey, LC, UDC, proprietary"
        />
        <Field
          label="IIIF endpoint URL"
          id="iiifEndpoint"
          value={f.iiifEndpoint}
          onChange={set}
          placeholder="https://"
          type="url"
        />
      </div>
    </fieldset>
  )
}

// ── Step 5 — Building ─────────────────────────────────────────────────────────

function StepBuilding({ f, set }: StepProps) {
  return (
    <fieldset
      style={{
        border: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <legend style={{ display: "contents" }}>
        <StepHeader
          n={5}
          title="Building"
          sub="Dates, architect, and architectural notes."
        />
      </legend>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "14px",
        }}
      >
        <Field
          label="Founded year"
          id="foundedYear"
          value={f.foundedYear}
          onChange={set}
          placeholder="YYYY"
          score
        />
        <Field
          label="Current building opened"
          id="openedYear"
          value={f.openedYear}
          onChange={set}
          placeholder="YYYY"
        />
        <Field
          label="Closed year (if applicable)"
          id="closedYear"
          value={f.closedYear}
          onChange={set}
          placeholder="YYYY"
        />
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <Field
          label="Architect"
          id="architect"
          value={f.architect}
          onChange={set}
        />
        <Field
          label="Architectural style"
          id="architecturalStyle"
          value={f.architecturalStyle}
          onChange={set}
        />
      </div>
      <TextareaField
        label="Building notes"
        id="buildingInfo"
        value={f.buildingInfo}
        onChange={set}
      />
    </fieldset>
  )
}

// ── Step 6 — Imagery ──────────────────────────────────────────────────────────

function ImageUploadEditor({
  images,
  onChange,
}: {
  images: UploadedImage[]
  onChange: (imgs: UploadedImage[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)
    const results: UploadedImage[] = []
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append("file", file)
      try {
        const res = await fetch("/api/submissions/upload-image", {
          method: "POST",
          body: fd,
        })
        const json = (await res.json()) as {
          id?: number
          url?: string
          error?: string
        }
        if (!res.ok || !json.id) {
          setError(json.error ?? "Upload failed")
          continue
        }
        results.push({ strapiId: json.id, url: json.url!, isHero: false })
      } catch {
        setError("Upload failed — please try again.")
      }
    }
    if (results.length > 0) {
      const combined = [...images, ...results]
      // Auto-hero: if no hero set, first image becomes hero
      const hasHero = combined.some((img) => img.isHero)
      onChange(
        hasHero
          ? combined
          : combined.map((img, i) => ({ ...img, isHero: i === 0 }))
      )
    }
    setUploading(false)
  }

  const setHero = (idx: number) => {
    onChange(images.map((img, i) => ({ ...img, isHero: i === idx })))
  }

  const remove = (idx: number) => {
    const next = images.filter((_, i) => i !== idx)
    // Re-assign hero to first if removed was hero
    if (images[idx].isHero && next.length > 0) {
      next[0] = { ...next[0], isHero: true }
    }
    onChange(next)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Drop zone / trigger */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          padding: "28px 20px",
          borderRadius: "10px",
          border: `1.5px dashed ${uploading ? T.border.line : T.border.hi}`,
          background: "rgba(255,255,255,0.02)",
          color: uploading ? T.ink.faint : T.ink.dim,
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          cursor: uploading ? "not-allowed" : "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          transition: "border-color .15s, color .15s",
          width: "100%",
        }}
      >
        <span style={{ fontSize: "22px", opacity: 0.5 }}>↑</span>
        <span>{uploading ? "Uploading…" : "Click to select images"}</span>
        <span
          style={{
            fontSize: "9px",
            letterSpacing: ".10em",
            color: T.ink.faint,
            marginTop: "2px",
          }}
        >
          JPEG · PNG · WebP · max 10 MB each
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: "none" }}
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error && (
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".12em",
            color: T.accent.danger,
            margin: 0,
          }}
        >
          ⚠ {error}
        </p>
      )}

      {/* Uploaded image grid */}
      {images.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "10px",
          }}
        >
          {images.map((img, i) => (
            <div
              key={img.strapiId}
              style={{
                position: "relative",
                borderRadius: "8px",
                overflow: "hidden",
                border: img.isHero
                  ? `2px solid ${T.accent.aurora}`
                  : `1px solid ${T.border.line}`,
                background: T.bg.deep,
                aspectRatio: "4/3",
              }}
            >
              <img
                src={img.url}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />

              {/* Hero badge */}
              {img.isHero && (
                <div
                  style={{
                    position: "absolute",
                    top: "6px",
                    left: "6px",
                    fontFamily: T.font.mono,
                    fontSize: "8px",
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: T.bg.void,
                    background: T.accent.aurora,
                    padding: "2px 7px",
                    borderRadius: "4px",
                    fontWeight: 700,
                  }}
                >
                  Hero
                </div>
              )}

              {/* Action row */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: "flex",
                  gap: "4px",
                  padding: "6px",
                  background: "rgba(3,5,17,0.75)",
                }}
              >
                {!img.isHero && (
                  <button
                    type="button"
                    onClick={() => setHero(i)}
                    style={{
                      flex: 1,
                      fontFamily: T.font.mono,
                      fontSize: "8px",
                      letterSpacing: ".10em",
                      textTransform: "uppercase",
                      color: T.accent.aurora,
                      background: "rgba(127,223,255,0.10)",
                      border: `1px solid rgba(127,223,255,0.25)`,
                      borderRadius: "4px",
                      padding: "3px 4px",
                      cursor: "pointer",
                    }}
                  >
                    Set hero
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "8px",
                    letterSpacing: ".10em",
                    textTransform: "uppercase",
                    color: T.accent.danger,
                    background: "rgba(255,138,138,0.08)",
                    border: `1px solid rgba(255,138,138,0.20)`,
                    borderRadius: "4px",
                    padding: "3px 6px",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StepImagery({ f, set, setFormData }: StepProps) {
  return (
    <fieldset
      style={{
        border: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <legend style={{ display: "contents" }}>
        <StepHeader
          n={6}
          title="Imagery"
          sub="Upload images of the library. Mark one as the hero — it appears on the detail page header."
        />
      </legend>
      <ImageUploadEditor
        images={f.uploadedImages}
        onChange={(imgs) =>
          setFormData((prev) => ({ ...prev, uploadedImages: imgs }))
        }
      />
      <Field
        label="Image credit / attribution"
        id="imageCredit"
        value={f.imageCredit}
        onChange={set}
        placeholder="Photographer name, CC BY-SA 4.0"
        hint="Optional. Applies to all uploaded images."
      />
      <TextareaField
        label="Image notes"
        id="imageNote"
        value={f.imageNote}
        onChange={set}
        placeholder="Describe the shots — exterior, interior reading room, etc."
      />
    </fieldset>
  )
}

// ── Step 7 — Sources ──────────────────────────────────────────────────────────

function StepSources({ f, set }: StepProps) {
  return (
    <fieldset
      style={{
        border: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <legend style={{ display: "contents" }}>
        <StepHeader
          n={7}
          title="Sources & review"
          sub="Cite your evidence, provide a source, and summarise what you've added."
        />
      </legend>
      <WizardSelect
        label="Evidence type"
        id="evidenceType"
        value={f.evidenceType}
        onChange={set}
        options={EVIDENCE_TYPES}
        required
      />
      <Field
        label="Evidence URL"
        id="evidenceUrl"
        value={f.evidenceUrl}
        onChange={set}
        placeholder="https://"
        type="url"
        required
        score
      />
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <Field
          label="Primary source (Wikidata, Wikipedia…)"
          id="source"
          value={f.source}
          onChange={set}
        />
        <Field
          label="Source URL"
          id="sourceUrl"
          value={f.sourceUrl}
          onChange={set}
          placeholder="https://"
          type="url"
        />
      </div>
      <TextareaField
        label="Submission summary"
        id="editSummary"
        value={f.editSummary}
        onChange={set}
        placeholder="Briefly describe what you're adding and how you verified it."
        rows={2}
        score
      />
      <TextareaField
        label="Note to reviewer (optional)"
        id="note"
        value={f.note}
        onChange={set}
        placeholder="Additional context for the editorial team."
        rows={3}
      />
    </fieldset>
  )
}

type StepProps = {
  f: FormData
  set: (k: keyof FormData, v: string) => void
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
}

const STEP_COMPONENTS: React.FC<StepProps>[] = [
  StepBasics,
  StepLocation,
  StepVisit,
  StepCollections,
  StepBuilding,
  StepImagery,
  StepSources,
]

// ── Main wizard ───────────────────────────────────────────────────────────────

interface AddLibraryWizardProps {
  sessionUser: { id: string; name: string | null; email: string }
  /** Edit mode: pre-populate the form with an existing library's data */
  initialData?: Partial<FormData>
  /** documentId of the library being edited (sets submissionType = library_edit) */
  targetDocumentId?: string
  /** slug of the library being edited */
  targetSlug?: string
}

function DraftResumeBanner({
  savedStep,
  savedAt,
  onResume,
  onDiscard,
}: {
  savedStep: number
  savedAt: string
  onResume: () => void
  onDiscard: () => void
}) {
  const relTime = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - new Date(savedAt).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 2) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`

    return `${Math.floor(hrs / 24)}d ago`
  }, [savedAt])

  return (
    <div
      style={{
        border: `1px solid rgba(127,223,255,0.25)`,
        borderRadius: "10px",
        padding: "14px 18px",
        background: "rgba(127,223,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        marginBottom: "24px",
        flexWrap: "wrap",
      }}
    >
      <div>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: T.accent.aurora,
            display: "block",
            marginBottom: "2px",
          }}
        >
          Draft found · Step {savedStep} · saved {relTime}
        </span>
        <span
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.dim,
          }}
        >
          You have unsaved progress. Resume where you left off?
        </span>
      </div>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={onResume}
          style={{
            padding: "7px 16px",
            borderRadius: "6px",
            border: `1px solid rgba(127,223,255,0.35)`,
            background: "rgba(127,223,255,0.1)",
            color: T.accent.aurora,
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Continue →
        </button>
        <button
          onClick={onDiscard}
          style={{
            padding: "7px 16px",
            borderRadius: "6px",
            border: `1px solid ${T.border.line}`,
            background: "transparent",
            color: T.ink.faint,
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Start fresh
        </button>
      </div>
    </div>
  )
}

export function AddLibraryWizard({
  sessionUser: _,
  initialData,
  targetDocumentId,
  targetSlug,
}: AddLibraryWizardProps) {
  const isEditMode = !!(targetDocumentId && targetSlug)
  const router = useRouter()
  const [step, setStep] = useState(isEditMode ? 1 : 0)
  const [claimedEntityRefs, setClaimedEntityRefs] = useState<string[]>([])
  const [completed, setCompleted] = useState<number[]>([])
  const [formData, setFormData] = useState<FormData>(
    initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM
  )
  const [draftId, setDraftId] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false)

  // Fetch user's claimed entity refs for the duplicate-check gate
  useEffect(() => {
    fetch("/api/profile/me/affiliations")
      .then((r) => r.json())
      .then((j: { entityRefs?: string[] }) =>
        setClaimedEntityRefs(j.entityRefs ?? [])
      )
      .catch(() => {})
  }, [])

  const { mutate: createSubmission, isPending: isCreating } =
    useCreateSubmission()
  const { mutate: saveDraftMutation } = useSaveDraft()
  const { mutate: finalizeDraft, isPending: isFinalizing } = useFinalizeDraft()
  const { data: existingDraft } = useResumeDraft(
    isEditMode ? "" : "new_library"
  )

  const isPending = isCreating || isFinalizing

  const showDraftBanner =
    !draftBannerDismissed && !draftId && !!existingDraft?.draftData

  const resumeDraft = useCallback(() => {
    if (!existingDraft?.draftData) return
    setFormData(existingDraft.draftData as unknown as FormData)
    setStep(Math.max(1, (existingDraft.stepCompleted ?? 0) + 1))
    setDraftId(existingDraft.documentId)
    setDraftBannerDismissed(true)
  }, [existingDraft])

  // Skip gate when resuming a draft
  useEffect(() => {
    if (existingDraft?.draftData && step === 0) {
      setStep(Math.max(1, (existingDraft.stepCompleted ?? 0) + 1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDraft])

  const discardDraft = useCallback(() => {
    setDraftBannerDismissed(true)
  }, [])

  const set = useCallback((k: keyof FormData, v: string) => {
    setFormData((prev) => ({ ...prev, [k]: v }))
  }, [])

  const score = calcScore(formData)
  const StepComponent = step > 0 ? STEP_COMPONENTS[step - 1]! : null

  const saveDraft = useCallback(
    (currentFormData: FormData, currentStep: number, id: string) => {
      saveDraftMutation(
        {
          id,
          draftData: currentFormData as unknown as Record<string, unknown>,
          stepCompleted: currentStep,
        },
        { onSuccess: () => setLastSavedAt(new Date()) }
      )
    },
    [saveDraftMutation]
  )

  const goNext = () => {
    const nextCompleted = completed.includes(step)
      ? completed
      : [...completed, step]
    setCompleted(nextCompleted)
    const nextStep = Math.min(step + 1, 7)
    setStep(nextStep)

    if (draftId) {
      // Existing draft — just save progress
      saveDraft(formData, step, draftId)
    } else if (!isEditMode) {
      // First step completion — create the draft submission on the backend
      const { editSummary, evidenceType, evidenceUrl, note, ...libraryFields } =
        formData
      createSubmission(
        {
          submissionType: "new_library",
          note,
          editSummary,
          evidenceType,
          evidenceUrl,
          fields: libraryFields as unknown as Record<string, unknown>,
          asDraft: true,
        },
        {
          onSuccess: (submission) => {
            setDraftId(submission.documentId)
            setLastSavedAt(new Date())
          },
          onError: () => {
            // Non-fatal: wizard continues, autosave will retry on next step
          },
        }
      )
    }
  }

  const goPrev = () => setStep((s) => Math.max(s - 1, 0))

  const handleStepClick = (n: number) => {
    if (n === 0 || completed.includes(step) || n <= step) setStep(n)
  }

  // Autosave when navigating back (no draft creation needed, just sync)
  useEffect(() => {
    if (!draftId) return
    saveDraft(formData, step, draftId)
    // Only run when step changes, not on every formData keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const submit = () => {
    if (!formData.name || !formData.libraryType || !formData.evidenceUrl) {
      toast.error(
        "Please fill in the required fields: name, library type, and evidence URL."
      )

      return
    }

    if (draftId && !isEditMode) {
      // Finalize the existing draft — promotes it from "draft" → "pending" in the queue
      finalizeDraft(
        {
          id: draftId,
          formData: formData as unknown as Record<string, unknown>,
        },
        {
          onSuccess: () => {
            toast.success(
              "Submission received — editorial review typically takes 1–3 days."
            )
            router.push("/contribute/submissions")
          },
          onError: (err) => toast.error(err?.message ?? "Submission failed"),
        }
      )
    } else {
      // Edit mode or no draft — create submission directly
      const { editSummary, evidenceType, evidenceUrl, note, ...libraryFields } =
        formData
      createSubmission(
        {
          submissionType: isEditMode ? "library_edit" : "new_library",
          note,
          editSummary,
          evidenceType,
          evidenceUrl,
          fields: libraryFields as unknown as Record<string, unknown>,
          ...(isEditMode && targetDocumentId ? { targetDocumentId } : {}),
          ...(isEditMode && targetSlug ? { targetSlug } : {}),
        },
        {
          onSuccess: () => {
            toast.success(
              "Submission received — editorial review typically takes 1–3 days."
            )
            router.push("/contribute/submissions")
          },
          onError: (err) => toast.error(err?.message ?? "Submission failed"),
        }
      )
    }
  }

  return (
    <>
      <AddLibraryHero
        lastSavedAt={lastSavedAt}
        libraryName={isEditMode ? formData.name || undefined : undefined}
      />

      <ContributeNavBar />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr 260px",
          gap: "0",
          minHeight: "calc(100vh - 260px)",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
        className="grid-cols-1 lg:grid-cols-[220px_1fr_260px]"
      >
        {/* Left — step nav */}
        <aside
          style={{
            paddingRight: "24px",
            paddingTop: "8px",
            borderRight: `1px solid ${T.border.line}`,
            position: "sticky",
            top: "80px",
            alignSelf: "start",
          }}
        >
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "11px",
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: T.accent.aurora,
              margin: "0 0 16px",
              opacity: 0.7,
            }}
          >
            {isEditMode ? "Edit library" : "Add a library"}
          </p>
          <WizardStepNav
            currentStep={step}
            completedSteps={completed}
            onStepClick={handleStepClick}
          />
        </aside>

        {/* Centre — step form */}
        <main id="wizard-main" style={{ padding: "0 40px" }}>
          {step === 0 ? (
            <LibrarySearchGate
              claimedEntityRefs={claimedEntityRefs}
              onConfirmNew={({ name, city }) => {
                setFormData((prev) => ({
                  ...prev,
                  ...(name && !prev.name ? { name } : {}),
                  ...(city && !prev.city ? { city } : {}),
                }))
                setStep(1)
              }}
            />
          ) : (
            <>
              {showDraftBanner && existingDraft && (
                <DraftResumeBanner
                  savedStep={existingDraft.stepCompleted ?? 1}
                  savedAt={existingDraft.updatedAt}
                  onResume={resumeDraft}
                  onDiscard={discardDraft}
                />
              )}
              {StepComponent && (
                <StepComponent
                  f={formData}
                  set={set}
                  setFormData={setFormData}
                />
              )}

              <div
                role="group"
                aria-label="Step navigation"
                style={{ display: "flex", gap: "10px", marginTop: "36px" }}
              >
                {step > 1 && (
                  <button
                    type="button"
                    onClick={goPrev}
                    style={{
                      padding: "11px 22px",
                      borderRadius: "10px",
                      border: `1px solid ${T.border.hi}`,
                      background: "transparent",
                      color: T.ink.dim,
                      fontSize: "14px",
                      cursor: "pointer",
                      fontFamily: T.font.sans,
                    }}
                  >
                    ← Back
                  </button>
                )}

                {step < 7 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className={auroraCtaSm}
                    style={{ border: "none", cursor: "pointer" }}
                  >
                    Next step →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={isPending}
                    aria-busy={isPending}
                    className={auroraCtaSm}
                    style={{
                      border: "none",
                      cursor: isPending ? "not-allowed" : "pointer",
                      opacity: isPending ? 0.6 : 1,
                    }}
                  >
                    {isPending ? "Submitting…" : "Submit for review →"}
                  </button>
                )}
              </div>
            </>
          )}
        </main>

        {/* Right — completion sidebar */}
        <aside
          aria-label="Submission completeness"
          style={{
            paddingLeft: "24px",
            borderLeft: `1px solid ${T.border.line}`,
            position: "sticky",
            top: "80px",
            alignSelf: "start",
          }}
        >
          <WizardCompletionSidebar score={score} formData={formData} />
        </aside>
      </div>
    </>
  )
}
