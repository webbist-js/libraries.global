"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import type React from "react"

import { TimetableEditor } from "@/components/mobile/TimetableEditor"
import { TimetableServiceNotices } from "@/components/mobile/TimetableServiceNotices"

import { FacilityChecklistRows } from "./FacilityChecklistRows"
import { ImageUploadEditor } from "./ImageUploadEditor"
import { OpeningTimesEditor } from "./OpeningTimesEditor"
import { SocialLinksEditor } from "./SocialLinksEditor"
import { SourceRecordsEditor } from "./SourceRecordsEditor"
import { StepLocation } from "./StepLocation"
import {
  EVIDENCE_TYPES,
  LIBRARY_TYPES,
  OPERATIONAL_STATUSES,
  OPERATOR_TYPES,
} from "./wizard.constants"
import type { StepProps } from "./wizard.types"
import {
  Field,
  SharedBlock,
  SubSection,
  StepHeader,
  TagSelector,
  TextareaField,
  WizardSelect,
  useIsShared,
} from "./WizardFields"

// ── Step 1 — Identity ─────────────────────────────────────────────────────────

function StepBasics({ f, set }: StepProps) {
  const tUi = useUiTranslations("ui")

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
          n={1}
          label={tUi("identity")}
          title={tUi("what_library_is_this")}
          sub="Name, type and status drive the listing card and the search index. Use the name the library uses for itself."
        />
      </legend>
      <Field
        label={tUi("library_name")}
        id="name"
        value={f.name}
        onChange={set}
        required
        autoComplete="organization"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={tUi("short_name_abbreviation")}
          id="shortName"
          value={f.shortName}
          onChange={set}
          placeholder="BL, BnF, LOC"
        />
        <Field
          label={tUi("official_formal_name_if_different")}
          id="officialName"
          value={f.officialName}
          onChange={set}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WizardSelect
          label={tUi("library_type")}
          id="libraryType"
          value={f.libraryType}
          onChange={set}
          options={LIBRARY_TYPES}
          required
        />
        <WizardSelect
          label={tUi("operator_type")}
          id="operatorType"
          value={f.operatorType}
          onChange={set}
          options={OPERATOR_TYPES}
        />
      </div>
      <WizardSelect
        label={tUi("operational_status")}
        id="operationalStatus"
        value={f.operationalStatus}
        onChange={set}
        options={OPERATIONAL_STATUSES}
        required
      />
      {f.libraryType === "Mobile" && (
        <Field
          label={tUi("run_by")}
          id="operatorName"
          value={f.operatorName}
          onChange={set}
          hint="The council, organisation or service that runs this vehicle."
        />
      )}
      <TextareaField
        label={tUi("summary_description")}
        id="summary"
        value={f.summary}
        onChange={set}
        rows={3}
        hint="2–4 sentences. Appears in search results and listing cards."
      />
      {(f.operationalStatus === "permanently_closed" ||
        f.operationalStatus === "temporarily_closed") && (
        <TextareaField
          label={tUi("closure_reason")}
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

// ── Stops & times — mobile libraries only ────────────────────────────────────

function StepTimetable({ f, set, setFormData, timetableContext }: StepProps) {
  const tUi = useUiTranslations("ui")

  const timetableReadOnly = useIsShared("mobileTimetable")

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
          n={3}
          label={tUi("stops_times")}
          title={tUi("where_does_the_vehicle_stop")}
          sub="Add the stops and visits for this vehicle. A timetable is optional; the base and area are required."
        />
      </legend>
      <SharedBlock fields={["mobileTimetable"]}>
        <TimetableEditor
          disabled={timetableReadOnly}
          value={f.mobileTimetable}
          onChange={(mobileTimetable) =>
            setFormData((prev) => ({ ...prev, mobileTimetable }))
          }
          notices={timetableContext?.notices}
          timezone={timetableContext?.timezone}
          noticesBlock={
            timetableContext ? (
              <TimetableServiceNotices context={timetableContext} />
            ) : undefined
          }
        />
      </SharedBlock>
      <Field
        label={tUi("published_timetable_page_or_pdf")}
        id="timetableUrl"
        value={f.timetableUrl}
        onChange={set}
        type="url"
      />
    </fieldset>
  )
}

// ── Visit — shared contact, services and access fields ───────────────────────

function StepVisit({ f, set, setFormData }: StepProps) {
  const tUi = useUiTranslations("ui")

  const mobile = f.libraryType === "Mobile"

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
          n={mobile ? 8 : 3}
          label={mobile ? "Visit & access" : tUi("visit")}
          title={tUi("how_do_people_visit")}
          sub={
            mobile
              ? "Links, contact details, services and vehicle access: what a visitor needs to know before setting off."
              : "Links, contact details, opening hours and access: what a visitor needs to know before setting off."
          }
        />
      </legend>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={tUi("website_url")}
          id="website"
          value={f.website}
          onChange={set}
          placeholder="https://"
          type="url"
        />
        <Field
          label={tUi("plan_your_visit_url")}
          id="planVisitUrl"
          value={f.planVisitUrl}
          onChange={set}
          placeholder="https://"
          type="url"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={tUi("catalogue_opac_url")}
          id="catalogueUrl"
          value={f.catalogueUrl}
          onChange={set}
          placeholder="https://"
          type="url"
          hint="Counts as the contact link if there’s no website."
        />
        <Field
          label={tUi("membership_reader_registration_url")}
          id="membershipUrl"
          value={f.membershipUrl}
          onChange={set}
          placeholder="https://"
          type="url"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={tUi("booking_url")}
          id="bookingUrl"
          value={f.bookingUrl}
          onChange={set}
          placeholder="https://"
          type="url"
        />
        <Field
          label={tUi("donation_url")}
          id="donationUrl"
          value={f.donationUrl}
          onChange={set}
          placeholder="https://"
          type="url"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={tUi("virtual_tour_url")}
          id="virtualTourUrl"
          value={f.virtualTourUrl}
          onChange={set}
          placeholder="https://"
          type="url"
        />
        <Field
          label={tUi("virtual_tour_embed_code")}
          id="virtualTourEmbed"
          value={f.virtualTourEmbed}
          onChange={set}
          placeholder="<iframe…>"
          hint="Paste the embed snippet if you have one."
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={tUi("phone")}
          id="phone"
          value={f.phone}
          onChange={set}
          type="tel"
          autoComplete="tel"
        />
        <Field
          label={tUi("public_email")}
          id="email"
          value={f.email}
          onChange={set}
          type="email"
          autoComplete="email"
        />
      </div>
      <TextareaField
        label={tUi("admission_policy")}
        id="admissionInfo"
        value={f.admissionInfo}
        onChange={set}
        placeholder="Free general admission. Reader pass required for reading rooms…"
      />
      <Field
        label={tUi("languages_served")}
        id="languagesServed"
        value={f.languagesServed}
        onChange={set}
        placeholder="English, Welsh"
      />
      <TextareaField
        label={tUi("getting_there_transit_info")}
        id="transitInfo"
        value={f.transitInfo}
        onChange={set}
        rows={2}
      />
      <TextareaField
        label={tUi("visitor_notes")}
        id="visitNotes"
        value={f.visitNotes}
        onChange={set}
        rows={3}
        placeholder="What visitors should know — queues, bag policies, photography rules…"
      />

      {f.libraryType !== "Mobile" &&
        f.operationalStatus !== "permanently_closed" &&
        f.operationalStatus !== "temporarily_closed" && (
          <>
            <SubSection
              label={tUi("opening_hours")}
              sub="Weekly schedule shown on the library detail page. Leave slots empty for days you don't have data for."
            />
            <SharedBlock fields={["openingTimes"]}>
              <OpeningTimesEditor
                value={f.openingTimes}
                onChange={(updated) =>
                  setFormData((prev) => ({ ...prev, openingTimes: updated }))
                }
              />
            </SharedBlock>
          </>
        )}

      <SubSection
        label={tUi("services_amenities")}
        sub="Select the services, amenities and access features visitors can use."
      />
      <SharedBlock fields={["services", "amenities", "accessibility"]}>
        <FacilityChecklistRows f={f} setFormData={setFormData} />
      </SharedBlock>
      <TagSelector
        label={tUi("services")}
        endpoint="/api/relations/services"
        fieldKey="services"
        value={f.services}
        onChange={(ids) => setFormData((prev) => ({ ...prev, services: ids }))}
      />
      <TagSelector
        label={tUi("amenities")}
        endpoint="/api/relations/amenities"
        fieldKey="amenities"
        value={f.amenities}
        onChange={(ids) => setFormData((prev) => ({ ...prev, amenities: ids }))}
      />
      <TagSelector
        label={tUi("accessibility_features")}
        endpoint="/api/relations/accessibility"
        fieldKey="accessibility"
        value={f.accessibility}
        onChange={(ids) =>
          setFormData((prev) => ({ ...prev, accessibility: ids }))
        }
        hint="Use the access notes below for details about using these facilities."
      />
      <TextareaField
        label={tUi("accessibility_notes")}
        id="accessibilityNotes"
        value={f.accessibilityNotes}
        onChange={set}
        rows={3}
        placeholder={
          mobile
            ? "Lift into the vehicle, wheelchair space and a hearing loop…"
            : "Ramp at the courtyard entrance, accessible toilets and a hearing loop…"
        }
      />

      <SubSection
        label={tUi("social_media")}
        sub="Official social media accounts for this library."
      />
      <SharedBlock fields={["socialLinks"]}>
        <SocialLinksEditor
          value={f.socialLinks}
          onChange={(links) =>
            setFormData((prev) => ({ ...prev, socialLinks: links }))
          }
        />
      </SharedBlock>
    </fieldset>
  )
}

// ── Step 4 — Collections ──────────────────────────────────────────────────────

function StepCollections({ f, set }: StepProps) {
  const tUi = useUiTranslations("ui")

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
          n={4}
          label={tUi("collections")}
          title={tUi("what_does_it_hold")}
          sub="Holdings size, notable collections, classification system and any digital endpoints."
        />
      </legend>
      <Field
        label={tUi("collection_size_volumes_items")}
        id="collectionSize"
        value={f.collectionSize}
        onChange={set}
        hint="Approximate total — include unit (e.g. '170 million items', '2.4 million volumes')"
      />
      <Field
        label={tUi("collection_types")}
        id="collectionTypes"
        value={f.collectionTypes}
        onChange={set}
        placeholder="Books, Manuscripts, Maps, Sound recordings"
      />
      <TextareaField
        label={tUi("special_collections_notable_holdings")}
        id="specialCollections"
        value={f.specialCollections}
        onChange={set}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={tUi("classification_system")}
          id="classificationSystem"
          value={f.classificationSystem}
          onChange={set}
          placeholder="Dewey, LC, UDC, proprietary"
        />
        <Field
          label={tUi("iiif_endpoint_url")}
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
  const tUi = useUiTranslations("ui")

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
          n={5}
          label={tUi("history")}
          title={tUi("when_did_it_begin")}
          sub="Founding and opening dates, the building, and who designed it."
        />
      </legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          label={tUi("founded_year")}
          id="foundedYear"
          value={f.foundedYear}
          onChange={set}
          placeholder="YYYY"
        />
        <Field
          label={tUi("current_building_opened")}
          id="openedYear"
          value={f.openedYear}
          onChange={set}
          placeholder="YYYY"
        />
        <Field
          label={tUi("closed_year_if_applicable")}
          id="closedYear"
          value={f.closedYear}
          onChange={set}
          placeholder="YYYY"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={tUi("architect")}
          id="architect"
          value={f.architect}
          onChange={set}
        />
        <Field
          label={tUi("architectural_style")}
          id="architecturalStyle"
          value={f.architecturalStyle}
          onChange={set}
        />
      </div>
      <TextareaField
        label={tUi("building_notes")}
        id="buildingInfo"
        value={f.buildingInfo}
        onChange={set}
      />
    </fieldset>
  )
}

// ── Step 6 — Imagery ──────────────────────────────────────────────────────────

function StepImagery({ f, set, setFormData }: StepProps) {
  const tUi = useUiTranslations("ui")

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
          n={6}
          label={tUi("photo")}
          title={tUi("add_a_photo")}
          sub="Upload images of the library and mark one as the hero. It appears at the top of the library page."
        />
      </legend>
      <SharedBlock fields={["uploadedImages"]}>
        <ImageUploadEditor
          images={f.uploadedImages}
          onChange={(imgs) =>
            setFormData((prev) => ({ ...prev, uploadedImages: imgs }))
          }
        />
      </SharedBlock>
      <Field
        label={tUi("image_credit_attribution")}
        id="imageCredit"
        value={f.imageCredit}
        onChange={set}
        placeholder="Photographer name, CC BY-SA 4.0"
        hint="Optional. Applies to all uploaded images."
      />
      <TextareaField
        label={tUi("image_notes")}
        id="imageNote"
        value={f.imageNote}
        onChange={set}
        placeholder="Describe the shots — exterior, interior reading room, etc."
      />
    </fieldset>
  )
}

// ── Step 7 — Sources ──────────────────────────────────────────────────────────

function StepSources({ f, set, setFormData, improving }: StepProps) {
  const tUi = useUiTranslations("ui")

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
          n={7}
          label={tUi("sources_send")}
          title={tUi("cite_your_sources")}
          sub="Tell reviewers how you know. Good evidence is the fastest route through editorial review."
        />
      </legend>
      <WizardSelect
        label={tUi("evidence_type")}
        id="evidenceType"
        value={f.evidenceType}
        onChange={set}
        options={EVIDENCE_TYPES}
        required={!f.sourceRecords.length}
      />
      <Field
        label={tUi("evidence_url")}
        id="evidenceUrl"
        value={f.evidenceUrl}
        onChange={set}
        placeholder="https://"
        type="url"
        required={!f.sourceRecords.length}
      />
      <SourceRecordsEditor
        value={f.sourceRecords}
        onChange={(value) =>
          setFormData((current) => ({ ...current, sourceRecords: value }))
        }
      />
      <TextareaField
        label={tUi("submission_summary")}
        id="editSummary"
        value={f.editSummary}
        onChange={set}
        placeholder={tUi(
          "briefly_describe_what_you_re_adding_and_how_you_verified_it"
        )}
        rows={2}
        required={improving}
      />
      <TextareaField
        label={tUi("note_to_reviewer_optional")}
        id="note"
        value={f.note}
        onChange={set}
        placeholder={tUi("additional_context_for_the_editorial_team")}
        rows={3}
      />
    </fieldset>
  )
}

// ── Step registry ─────────────────────────────────────────────────────────────

export const STEP_COMPONENTS: React.FC<StepProps>[] = [
  StepBasics,
  StepLocation,
  (props) =>
    props.f.libraryType === "Mobile" ? (
      <StepTimetable {...props} />
    ) : (
      <StepVisit {...props} />
    ),
  StepCollections,
  StepBuilding,
  StepImagery,
  StepSources,
  StepVisit,
]
