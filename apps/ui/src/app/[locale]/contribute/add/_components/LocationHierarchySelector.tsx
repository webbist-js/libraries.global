"use client"

import type React from "react"
import { useEffect, useState } from "react"

import { T } from "@/lib/design-tokens"

import { fieldInputStyle, fieldLabelStyle } from "./wizard.constants"
import type { FormData } from "./wizard.types"

type RelationOption = { documentId: string; name: string }

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
