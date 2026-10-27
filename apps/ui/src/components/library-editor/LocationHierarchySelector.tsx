"use client"

import { useLocale, useTranslations as useUiTranslations } from "next-intl"
import type React from "react"
import { useEffect, useState } from "react"

import {
  lowerFirst,
  placeLabels,
  type AreaLabelFields,
} from "@/components/location/location-page.helpers"
import { T } from "@/lib/design-tokens"

import { fieldInputStyle, fieldLabelStyle } from "./wizard.constants"
import type { FormData } from "./wizard.types"

type RelationOption = { documentId: string; name: string }
type CountryOption = RelationOption & {
  regionTypeLabel?: string | null
  regionsSectionLabel?: string | null
  areaTypeLabel?: string | null
  areasSectionLabel?: string | null
}
type RegionOption = RelationOption & AreaLabelFields

type RelationState<Option> = { key: string; data: Option[]; error: boolean }

function useRelationOptions<Option>(
  type: string,
  parent: string,
  locale: string,
  revision: number
) {
  const key = `${type}:${parent}:${locale}:${revision}`
  const [state, setState] = useState<RelationState<Option>>({
    key: "",
    data: [],
    error: false,
  })
  useEffect(() => {
    if (type !== "continents" && !parent) return
    const controller = new AbortController()
    const query = new URLSearchParams({ locale })
    const parentField = {
      countries: "continentDocumentId",
      regions: "countryDocumentId",
      areas: "regionDocumentId",
    }[type]
    if (parentField) query.set(parentField, parent)
    fetch(`/api/relations/${type}?${query}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Place choices unavailable")

        return res.json()
      })
      .then((json) => {
        if (!controller.signal.aborted)
          setState({ key, data: json.data ?? [], error: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, data: [], error: true })
      })

    return () => controller.abort()
  }, [type, parent, locale, revision, key])
  const current = state.key === key

  return {
    data: current ? state.data : [],
    loaded: current && !state.error,
    error: current && state.error,
  }
}

export function LocationHierarchySelector({
  f,
  setFormData,
}: {
  f: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
}) {
  const tUi = useUiTranslations("ui")

  const locale = useLocale()
  const [revision, setRevision] = useState(0)
  const continentOptions = useRelationOptions<RelationOption>(
    "continents",
    "",
    locale,
    revision
  )
  const countryOptions = useRelationOptions<CountryOption>(
    "countries",
    f.continentDocumentId,
    locale,
    revision
  )
  const regionOptions = useRelationOptions<RegionOption>(
    "regions",
    f.countryDocumentId,
    locale,
    revision
  )
  const areaOptions = useRelationOptions<RelationOption>(
    "areas",
    f.regionDocumentId,
    locale,
    revision
  )
  const continents = continentOptions.data
  const countries = countryOptions.data
  const regions = regionOptions.data
  const areas = areaOptions.data
  const unavailable = [
    continentOptions,
    countryOptions,
    regionOptions,
    areaOptions,
  ].some((options) => options.error)

  const selectStyle: React.CSSProperties = {
    ...fieldInputStyle,
    cursor: "pointer",
  }

  // What the chosen country (or Region, for its Areas) calls its places.
  const labels = placeLabels(
    countries.find((c) => c.documentId === f.countryDocumentId),
    regions.find((r) => r.documentId === f.regionDocumentId)
  )
  // A Region with no Areas (every Scottish council, say): nothing to pick.
  const noAreas =
    !!f.regionDocumentId && areaOptions.loaded && areas.length === 0
  const areaEnabled = !!f.regionDocumentId && areaOptions.loaded && !noAreas

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "var(--type-body-small-size)",
          color: T.ink.faint,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        Link to the content hierarchy for atlas navigation and breadcrumbs.
        Select continent first, then narrow down.
      </p>
      {unavailable ? (
        <p role="alert" style={{ color: T.ink.dim }}>
          Place choices are unavailable.{" "}
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
            className="min-h-11 underline"
          >
            Try again
          </button>
        </p>
      ) : null}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={fieldLabelStyle} htmlFor="hier-continent">
            {tUi("continent")}{" "}
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
            <option value="">{tUi("select")}</option>
            {continents.map((c) => (
              <option key={c.documentId} value={c.documentId}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={fieldLabelStyle} htmlFor="hier-country">
            {tUi("country")}{" "}
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
            <option value="">{tUi("select")}</option>
            {countries.map((c) => (
              <option key={c.documentId} value={c.documentId}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={fieldLabelStyle} htmlFor="hier-region">
            {labels.region.name}
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
            <option value="">{tUi("select")}</option>
            {regions.map((r) => (
              <option key={r.documentId} value={r.documentId}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={fieldLabelStyle} htmlFor="hier-area">
            {labels.area.name}{" "}
            <span style={{ color: T.ink.faint, fontWeight: 400 }}>
              {tUi("optional")}{" "}
            </span>
          </label>
          <select
            id="hier-area"
            value={f.areaDocumentId}
            disabled={!areaEnabled}
            onChange={(e) => {
              const v = e.target.value
              setFormData((prev) => ({ ...prev, areaDocumentId: v }))
            }}
            style={{
              ...selectStyle,
              opacity: areaEnabled ? 1 : 0.4,
            }}
          >
            <option value="">
              {noAreas
                ? `No ${lowerFirst(labels.area.plural)} listed`
                : tUi("select")}
            </option>
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
