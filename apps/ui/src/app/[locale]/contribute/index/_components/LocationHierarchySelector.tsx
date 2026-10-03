"use client"

import { Icon } from "@iconify/react"
import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"

import { T } from "@/lib/design-tokens"

import {
  LOCATION_REQUEST_SENT,
  LocationRequestForm,
  type LocationRequestKind,
} from "./LocationRequestForm"
import { fieldInputStyle, fieldLabelStyle } from "./wizard.constants"
import type { FormData } from "./wizard.types"

type RelationOption = { documentId: string; name: string }

/**
 * Whether the selector offers "Not listed?" (a Location Request). On only
 * where a new library is being proposed: the Index editor's `new` mode
 * provides `true`; the Moderator's panel and improve mode don't.
 */
export const LocationRequestsContext = createContext(false)

/** The form with any Location Request proposal dropped. */
const withoutProposal = (prev: FormData): FormData => ({
  ...prev,
  proposedRegionName: "",
  proposedAreaName: "",
  locationRequestDocumentId: "",
})

const LINK_BUTTON =
  "inline-flex items-center gap-1 self-start rounded-full text-[14px] font-semibold underline-offset-2 hover:underline"

/** The proposal line under a select: what was asked for, and an undo. */
function Proposal({
  name,
  onRemove,
}: {
  readonly name: string
  readonly onRemove: () => void
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-[14px] px-3 py-2"
      style={{ background: "#E6EFE6", color: T.accent.ok }}
    >
      <p
        role="status"
        className="m-0 flex items-start gap-1.5 text-[14px] leading-normal"
      >
        <Icon
          aria-hidden="true"
          icon="mdi:check-circle-outline"
          width={16}
          height={16}
          className="mt-0.5 shrink-0"
        />
        <span>
          <strong>{`Requested: ${name}. `}</strong>
          {LOCATION_REQUEST_SENT}
        </span>
      </p>
      <button
        type="button"
        className={LINK_BUTTON}
        style={{ color: T.accent.primary }}
        onClick={onRemove}
      >
        Don’t link this library to it
      </button>
    </div>
  )
}

export function LocationHierarchySelector({
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
  const requestsOn = useContext(LocationRequestsContext)
  const [asking, setAsking] = useState<LocationRequestKind | null>(null)

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
          fontFamily: T.font.sans,
          fontSize: "13px",
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
              setAsking(null)
              setFormData((prev) => ({
                ...withoutProposal(prev),
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
              setAsking(null)
              setFormData((prev) => ({
                ...withoutProposal(prev),
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
              setAsking(null)
              // A listed region replaces any requested region or area.
              setFormData((prev) => ({
                ...withoutProposal(prev),
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
          {requestsOn && f.proposedRegionName ? (
            <Proposal
              name={f.proposedRegionName}
              onRemove={() => setFormData(withoutProposal)}
            />
          ) : null}
          {requestsOn &&
          f.countryDocumentId &&
          !f.proposedRegionName &&
          asking !== "region" ? (
            <button
              type="button"
              className={LINK_BUTTON}
              style={{ color: T.accent.primary }}
              onClick={() => setAsking("region")}
            >
              Not listed?
            </button>
          ) : null}
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
            onChange={(e) => {
              const v = e.target.value
              setAsking(null)
              setFormData((prev) => ({
                ...(prev.proposedAreaName ? withoutProposal(prev) : prev),
                areaDocumentId: v,
              }))
            }}
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
          {requestsOn && f.proposedAreaName ? (
            <Proposal
              name={f.proposedAreaName}
              onRemove={() => setFormData(withoutProposal)}
            />
          ) : null}
          {requestsOn &&
          f.regionDocumentId &&
          !f.proposedAreaName &&
          asking !== "area" ? (
            <button
              type="button"
              className={LINK_BUTTON}
              style={{ color: T.accent.primary }}
              onClick={() => setAsking("area")}
            >
              Not listed?
            </button>
          ) : null}
        </div>
      </div>
      {requestsOn && asking && f.countryDocumentId ? (
        <LocationRequestForm
          key={asking}
          kind={asking}
          countryDocumentId={f.countryDocumentId}
          regionDocumentId={
            asking === "area" ? f.regionDocumentId || undefined : undefined
          }
          parentName={
            asking === "area"
              ? regions.find((r) => r.documentId === f.regionDocumentId)?.name
              : countries.find((c) => c.documentId === f.countryDocumentId)
                  ?.name
          }
          onCancel={() => setAsking(null)}
          onCreated={({ documentId, name }) => {
            const kind = asking
            setAsking(null)
            setFormData((prev) => ({
              ...withoutProposal(prev),
              ...(kind === "region"
                ? { proposedRegionName: name, areaDocumentId: "" }
                : { proposedAreaName: name, areaDocumentId: "" }),
              locationRequestDocumentId: documentId,
            }))
          }}
        />
      ) : null}
    </div>
  )
}
