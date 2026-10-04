"use client"

import type React from "react"

import { formatCoord, parseCoordinatePair } from "@/lib/geocode/coordinates"

import { LocationHierarchySelector } from "./LocationHierarchySelector"
import type { StepProps } from "./wizard.types"
import { Field, SharedBlock, StepHeader, SubSection } from "./WizardFields"

// ── Step 2 — Location ─────────────────────────────────────────────────────────

export function StepLocation({ f, set, setFormData }: StepProps) {
  // "51.5297, -0.1271" pasted into either box fills both.
  const pasteCoordinates = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pair = parseCoordinatePair(e.clipboardData.getData("text"))
    if (!pair) return
    e.preventDefault()
    setFormData((prev) => ({
      ...prev,
      lat: formatCoord(pair.lat),
      lng: formatCoord(pair.lng),
    }))
  }

  return (
    <fieldset
      style={{
        border: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "22px",
      }}
    >
      <legend style={{ display: "contents" }}>
        <StepHeader
          n={2}
          label="Location"
          title="Where is it?"
          sub="An address and coordinates put the library on the map and in the right place in the atlas."
        />
      </legend>
      <Field
        label="Street address"
        id="streetAddress"
        value={f.streetAddress}
        onChange={set}
        autoComplete="street-address"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="City / Town"
          id="city"
          value={f.city}
          onChange={set}
          required
          autoComplete="address-level2"
        />
        <Field
          label="District / Borough"
          id="district"
          value={f.district}
          onChange={set}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Country"
          id="country"
          value={f.country}
          onChange={set}
          required
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Latitude"
          id="lat"
          value={f.lat}
          onChange={set}
          onPaste={pasteCoordinates}
          placeholder="51.5297"
          hint="Paste “51.5297, -0.1271” from Google Maps into either box to fill both."
          errorText="Latitude is a number between -90 and 90."
        />
        <Field
          label="Longitude"
          id="lng"
          value={f.lng}
          onChange={set}
          onPaste={pasteCoordinates}
          placeholder="-0.1271"
          errorText="Longitude is a number between -180 and 180."
        />
      </div>

      <SubSection
        label="Content hierarchy"
        sub="Link this library to its place in the atlas — used for breadcrumbs and location browsing."
      />
      <SharedBlock
        fields={[
          "continentDocumentId",
          "countryDocumentId",
          "regionDocumentId",
          "areaDocumentId",
        ]}
      >
        <LocationHierarchySelector f={f} setFormData={setFormData} />
      </SharedBlock>
    </fieldset>
  )
}
