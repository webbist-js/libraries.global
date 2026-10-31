"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import type React from "react"
import { useContext, useState } from "react"

import { HomeLibraryPicker } from "@/components/mobile/HomeLibraryPicker"
import { T } from "@/lib/design-tokens"
import { formatCoord, parseCoordinatePair } from "@/lib/geocode/coordinates"
import type { Place } from "@/lib/geocode/place"

import { addressIsEmpty } from "./location.apply"
import { LocationHierarchySelector } from "./LocationHierarchySelector"
import { LocationLookup } from "./LocationLookup"
import { LocationPinMap } from "./LocationPinMap"
import { useLocationFill } from "./useLocationFill"
import type { StepProps } from "./wizard.types"
import {
  Field,
  ModeratedFieldsContext,
  ModeratedTag,
  SharedBlock,
  StepHeader,
  SubSection,
  useIsShared,
} from "./WizardFields"

// ── Step 2 — Location ─────────────────────────────────────────────────────────

/** The address found under a dropped pin, when the form already has one. */
function NearestAddress({
  place,
  onUse,
}: {
  readonly place: Place
  readonly onUse: () => void
}) {
  const tUi = useUiTranslations("ui")

  const { streetAddress, city } = place.address
  const where = [streetAddress, city].filter(Boolean).join(", ") || place.label

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] px-4 py-3"
      style={{ background: T.accent.chip }}
    >
      <p className="m-0 text-base" style={{ color: T.ink.base }}>
        <span className="font-semibold">
          {tUi("nearest_address_to_the_pin")}
        </span>{" "}
        {where}
      </p>
      <button
        type="button"
        onClick={onUse}
        className="rounded-full bg-(--t-action-primary) px-4 py-2 text-sm font-semibold text-white hover:bg-(--t-action-primary-hover)"
      >
        {tUi("use_this_address")}{" "}
      </button>
    </div>
  )
}

function HierarchyNote() {
  const tUi = useUiTranslations("ui")

  return (
    <p
      role="status"
      className="m-0 flex items-center gap-1.5 text-sm"
      style={{ color: T.accent.ok }}
    >
      <Icon
        aria-hidden="true"
        icon="mdi:check-circle-outline"
        width={16}
        height={16}
      />
      {tUi("set_from_the_address_check_these")}{" "}
    </p>
  )
}

export function StepLocation({ f, set, setFormData, improving }: StepProps) {
  const tUi = useUiTranslations("ui")

  // Translation mode: the coordinates are shared, and Photon answers in English.
  const translating = useIsShared("lat")
  const staff = useContext(ModeratedFieldsContext)
  const fill = useLocationFill(f, setFormData)
  const { offer } = fill
  // A new library's search starts from the name given on step 1.
  const [startQuery] = useState(() =>
    !improving && addressIsEmpty(f) && !f.lat.trim() ? f.name : ""
  )

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
          label={f.libraryType === "Mobile" ? "Base & area" : tUi("location")}
          title={
            f.libraryType === "Mobile"
              ? "Where is the vehicle based?"
              : "Where is it?"
          }
          sub={
            f.libraryType === "Mobile"
              ? "Choose a home branch or depot, then check the region and area for this vehicle. Placement is reviewed by a Moderator."
              : "Search for the library or its address and the rest fills in, pin included. You can always type it yourself."
          }
        />
      </legend>
      {f.libraryType === "Mobile" && staff && (
        <div>
          <ModeratedTag />
        </div>
      )}
      {f.libraryType === "Mobile" && !translating && (
        <HomeLibraryPicker
          value={f.homeLibrary}
          onChange={(homeLibrary, home) =>
            setFormData((prev) => ({
              ...prev,
              homeLibrary,
              ...(home
                ? {
                    streetAddress: home.streetAddress ?? "",
                    city: home.city ?? "",
                    postalCode: home.postalCode ?? "",
                    lat: home.location ? formatCoord(home.location.lat) : "",
                    lng: home.location ? formatCoord(home.location.lng) : "",
                    country: home.country?.name ?? "",
                    continentDocumentId: home.continent?.documentId ?? "",
                    countryDocumentId: home.country?.documentId ?? "",
                    regionDocumentId: home.region?.documentId ?? "",
                    areaDocumentId: home.area?.documentId ?? "",
                  }
                : {}),
            }))
          }
        />
      )}
      {translating ? null : (
        <LocationLookup
          initialQuery={startQuery}
          onPick={fill.pick}
          onLocate={fill.placeAt}
        />
      )}
      <Field
        label={tUi("street_address")}
        id="streetAddress"
        value={f.streetAddress}
        onChange={set}
        autoComplete="street-address"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={tUi("city_town")}
          id="city"
          value={f.city}
          onChange={set}
          required={f.libraryType !== "Mobile"}
          autoComplete="address-level2"
        />
        <Field
          label={tUi("district_borough")}
          id="district"
          value={f.district}
          onChange={set}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={tUi("country")}
          id="country"
          value={f.country}
          onChange={set}
          required
          autoComplete="country-name"
        />
        <Field
          label={tUi("postal_code")}
          id="postalCode"
          value={f.postalCode}
          onChange={set}
          autoComplete="postal-code"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={tUi("latitude")}
          id="lat"
          value={f.lat}
          onChange={set}
          onPaste={pasteCoordinates}
          placeholder="51.5297"
          hint="Paste “51.5297, -0.1271” from Google Maps into either box to fill both."
          errorText="Latitude is a number between -90 and 90."
        />
        <Field
          label={tUi("longitude")}
          id="lng"
          value={f.lng}
          onChange={set}
          onPaste={pasteCoordinates}
          placeholder="-0.1271"
          errorText="Longitude is a number between -180 and 180."
        />
      </div>
      {translating ? null : (
        <LocationPinMap
          lat={f.lat}
          lng={f.lng}
          precise={fill.precise}
          onMove={fill.placeAt}
        />
      )}
      {offer ? (
        <NearestAddress place={offer} onUse={() => fill.takeAddress(offer)} />
      ) : null}

      <SubSection
        label={tUi("content_hierarchy")}
        sub="Link this library to its place in the atlas — used for breadcrumbs and location browsing."
      />
      {fill.hierarchyFilled ? <HierarchyNote /> : null}
      {staff ? (
        <div>
          <ModeratedTag />
        </div>
      ) : null}
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
