"use client"

import type React from "react"

import { ImageUploadEditor } from "./ImageUploadEditor"
import { LocationHierarchySelector } from "./LocationHierarchySelector"
import { OpeningTimesEditor } from "./OpeningTimesEditor"
import { SocialLinksEditor } from "./SocialLinksEditor"
import {
  EVIDENCE_TYPES,
  LIBRARY_TYPES,
  OPERATIONAL_STATUSES,
  OPERATOR_TYPES,
} from "./wizard.constants"
import type { StepProps } from "./wizard.types"
import {
  Field,
  SubSection,
  StepHeader,
  TagSelector,
  TextareaField,
  WizardSelect,
} from "./WizardFields"

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

function StepVisit({ f, set, setFormData }: StepProps) {
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

// ── Step registry ─────────────────────────────────────────────────────────────

export const STEP_COMPONENTS: React.FC<StepProps>[] = [
  StepBasics,
  StepLocation,
  StepVisit,
  StepCollections,
  StepBuilding,
  StepImagery,
  StepSources,
]
