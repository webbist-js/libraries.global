"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useState } from "react"

import { ChoiceCard, Notice } from "@/components/ds"
import { AvatarUpload } from "@/components/settings/AvatarUpload"
import { CountryCombobox } from "@/components/settings/CountryCombobox"
import { InterestsChips } from "@/components/settings/InterestsChips"
import { TimezoneCombobox } from "@/components/settings/TimezoneCombobox"
import { VisibilityCards } from "@/components/settings/VisibilityCards"
import { T } from "@/lib/design-tokens"
import type { ClaimedLibrary } from "@/lib/types/profile"

import {
  fieldHint,
  fieldInput,
  fieldLabel,
  SectionCard,
  Select,
  Tag,
} from "./FormParts"
import { LibraryClaimSearch } from "./LibraryClaimSearch"
import {
  AFFILIATION_TYPES,
  BIO_MAX,
  LANGUAGE_OPTIONS,
  PROFICIENCY,
  PROFICIENCY_LABEL,
  type Proficiency,
  PRONOUNS,
} from "./profile-form.model"
import type { ProfileForm } from "./useProfileForm"

// The profile form's section cards, shared by onboarding and settings. Each
// card is controlled by `useProfileForm`; the page around them saves.

// ── Identity ──────────────────────────────────────────────────────────────────

function UsernameStatusText({
  status,
}: {
  status: ProfileForm["usernameStatus"]
}) {
  if (status === "checking")
    return <span style={{ color: T.ink.dim }}>Checking…</span>
  if (status === "available")
    return (
      <span
        className="inline-flex items-center gap-1"
        style={{ color: T.accent.ok }}
      >
        <Icon aria-hidden="true" icon="mdi:check-circle-outline" width={16} />
        Available
      </span>
    )
  if (status === "taken")
    return (
      <span
        className="inline-flex items-center gap-1"
        style={{ color: T.accent.danger }}
      >
        <Icon aria-hidden="true" icon="mdi:alert-circle-outline" width={16} />
        Taken
      </span>
    )

  return null
}

export function IdentitySection({ form }: { form: ProfileForm }) {
  const tUi = useUiTranslations("ui")

  const uid = useId()
  const ids = {
    firstName: `${uid}-first-name`,
    lastName: `${uid}-last-name`,
    username: `${uid}-username`,
    usernameStatus: `${uid}-username-status`,
    usernameHint: `${uid}-username-hint`,
    pronouns: `${uid}-pronouns`,
    city: `${uid}-city`,
    country: `${uid}-country`,
    countryLabel: `${uid}-country-label`,
    timezone: `${uid}-timezone`,
    timezoneLabel: `${uid}-timezone-label`,
    bio: `${uid}-bio`,
    bioCount: `${uid}-bio-count`,
    bioHelp: `${uid}-bio-help`,
  }
  const taken = form.usernameStatus === "taken"

  return (
    <SectionCard
      id="identity"
      title={tUi("identity")}
      requirement="required"
      lead="How you appear on the records you contribute to and on your profile page."
    >
      <AvatarUpload
        currentUrl={form.avatarUrl}
        initials={form.initials}
        onUpload={form.setAvatarUrl}
      />

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.firstName} style={fieldLabel}>
            {tUi("display_name")}
            <Tag>{tUi("required")}</Tag>
          </label>
          <input
            id={ids.firstName}
            style={fieldInput}
            type="text"
            autoComplete="given-name"
            aria-required="true"
            value={form.firstName}
            onChange={(e) => form.setFirstName(e.target.value)}
            placeholder="Amélie"
          />
        </div>
        <div>
          <label htmlFor={ids.lastName} style={fieldLabel}>
            Last name<Tag>{tUi("optional_59be71")}</Tag>
          </label>
          <input
            id={ids.lastName}
            style={fieldInput}
            type="text"
            autoComplete="family-name"
            value={form.lastName}
            onChange={(e) => form.setLastName(e.target.value)}
            placeholder="Rault"
          />
        </div>
      </div>

      <div>
        {/* The status sits beside the label, not in it: it's the field's
            live description, not part of its name. */}
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <label htmlFor={ids.username} style={{ ...fieldLabel, margin: 0 }}>
            Username<Tag>{tUi("required")}</Tag>
          </label>
          <span
            id={ids.usernameStatus}
            aria-live="polite"
            className="text-[14px] font-semibold"
          >
            <UsernameStatusText status={form.usernameStatus} />
          </span>
        </div>
        <input
          id={ids.username}
          aria-describedby={`${ids.usernameStatus} ${ids.usernameHint}`}
          aria-invalid={taken || undefined}
          aria-required="true"
          style={{
            ...fieldInput,
            borderColor: taken ? T.accent.danger : undefined,
          }}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={form.username}
          onChange={(e) =>
            form.setUsername(
              e.target.value.toLowerCase().replaceAll(/[^a-z0-9_]/g, "")
            )
          }
          placeholder="amelie_rault"
        />
        <p id={ids.usernameHint} style={fieldHint}>
          Lowercase letters, numbers and underscores. Your profile’s address:
          libraries.global/profile/
          <strong className="font-semibold" style={{ color: T.ink.base }}>
            {form.username || "your_name"}
          </strong>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.pronouns} style={fieldLabel}>
            Pronouns<Tag>{tUi("required")}</Tag>
          </label>
          <Select
            id={ids.pronouns}
            aria-required="true"
            value={form.pronouns}
            onChange={(e) => form.setPronouns(e.target.value)}
          >
            {PRONOUNS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor={ids.city} style={fieldLabel}>
            City<Tag>{tUi("optional_59be71")}</Tag>
          </label>
          <input
            id={ids.city}
            style={fieldInput}
            type="text"
            autoComplete="address-level2"
            value={form.city}
            onChange={(e) => form.setCity(e.target.value)}
            placeholder="Paris"
          />
        </div>
        <div>
          <label id={ids.countryLabel} htmlFor={ids.country} style={fieldLabel}>
            {tUi("country")}
            <Tag>{tUi("optional_59be71")}</Tag>
          </label>
          <CountryCombobox
            id={ids.country}
            labelledBy={ids.countryLabel}
            value={form.country}
            onChange={form.setCountry}
            triggerStyle={fieldInput}
          />
        </div>
        <div>
          <label
            id={ids.timezoneLabel}
            htmlFor={ids.timezone}
            style={fieldLabel}
          >
            Timezone<Tag>{tUi("optional_59be71")}</Tag>
          </label>
          <TimezoneCombobox
            id={ids.timezone}
            labelledBy={ids.timezoneLabel}
            value={form.timezone}
            onChange={form.setTimezone}
            triggerStyle={fieldInput}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor={ids.bio} style={{ ...fieldLabel, margin: 0 }}>
            Short bio<Tag>{tUi("optional_59be71")}</Tag>
          </label>
          <span
            id={ids.bioCount}
            className="text-[13px] font-semibold"
            style={{ color: T.ink.dim }}
          >
            {form.bio.length} of {BIO_MAX}
          </span>
        </div>
        <textarea
          id={ids.bio}
          aria-describedby={`${ids.bioHelp} ${ids.bioCount}`}
          rows={3}
          style={{ ...fieldInput, resize: "vertical", lineHeight: 1.6 }}
          value={form.bio}
          maxLength={BIO_MAX}
          onChange={(e) => form.setBio(e.target.value)}
          placeholder="e.g. Cataloguer at a parish library in Fife, mostly working on Scottish manuscripts."
        />
        <p id={ids.bioHelp} style={fieldHint}>
          Shown at the top of your profile. Plain text only.
        </p>
      </div>
    </SectionCard>
  )
}

// ── Affiliation ───────────────────────────────────────────────────────────────

/** A claim the profile already has, or the one just made on this page. */
function ClaimNotice({ name, verified }: { name: string; verified: boolean }) {
  if (verified)
    return (
      <Notice
        icon="mdi:check-decagram-outline"
        tone="ok"
        title={`Verified at ${name}`}
      >
        <p className="m-0" style={{ color: T.ink.base }}>
          You can look after this library’s record from its Staff area.
        </p>
      </Notice>
    )

  return (
    <Notice
      icon="mdi:clock-outline"
      tone="info"
      title={`Claim sent for ${name}`}
    >
      <p className="m-0" style={{ color: T.ink.base }}>
        A moderator will check it and email you.
      </p>
    </Notice>
  )
}

export function AffiliationSection({
  form,
  claimedLibraries = [],
  isVerifiedLibrarian = false,
}: {
  form: ProfileForm
  /** Libraries the profile has already claimed (settings). */
  claimedLibraries?: readonly ClaimedLibrary[]
  isVerifiedLibrarian?: boolean
}) {
  const tUi = useUiTranslations("ui")

  const uid = useId()
  const jobTitleId = `${uid}-job-title`
  const claimed = claimedLibraries.filter((l) => l.name)
  const [claimAnother, setClaimAnother] = useState(false)
  const hasClaim = claimed.length > 0 || form.claimResult !== null
  const showSearch =
    Boolean(form.selectedAffiliation?.showClaim) &&
    form.claimResult === null &&
    (claimed.length === 0 || claimAnother)

  return (
    <SectionCard
      id="affiliation"
      title={tUi("affiliation")}
      requirement="required"
      lead="How are you connected to libraries? This shapes which review queues you fast-track and what badges you can earn."
    >
      <div
        role="radiogroup"
        aria-labelledby="affiliation-title"
        aria-describedby="affiliation-lead"
        aria-required="true"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {AFFILIATION_TYPES.map((type) => (
          <ChoiceCard
            key={type.value}
            name={`${uid}-affiliation`}
            value={type.value}
            checked={form.affiliationType === type.value}
            onChange={() => form.setAffiliationType(type.value)}
            icon={type.icon}
            tint={type.tint}
            title={type.label}
            hint={type.desc}
          />
        ))}
      </div>

      <div className="sm:max-w-[calc(50%-6px)]">
        <label htmlFor={jobTitleId} style={fieldLabel}>
          Job title<Tag>{tUi("optional_59be71")}</Tag>
        </label>
        <input
          id={jobTitleId}
          style={fieldInput}
          type="text"
          autoComplete="organization-title"
          value={form.jobTitle}
          onChange={(e) => form.setJobTitle(e.target.value)}
          placeholder="e.g. Senior curator"
        />
      </div>

      {claimed.map((lib) => (
        <ClaimNotice
          key={lib.documentId ?? lib.entityRef ?? lib.name}
          name={lib.name ?? ""}
          verified={isVerifiedLibrarian}
        />
      ))}
      {form.claimResult ? (
        <ClaimNotice
          name={form.claimResult.libraryName}
          verified={form.claimResult.status === "verified"}
        />
      ) : null}

      {showSearch ? (
        <div
          className="flex flex-col gap-5 rounded-[20px] p-5 sm:p-6"
          style={{
            background: T.bg.surface,
            border: `1px solid ${T.border.line}`,
          }}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: T.accent.chip, color: T.accent.primary }}
            >
              <Icon icon="mdi:check-decagram-outline" width={18} />
            </span>
            <div>
              <h3
                className="m-0 text-[16px] font-semibold"
                style={{ color: T.ink.base }}
              >
                {hasClaim
                  ? "Claim another library"
                  : "Are you affiliated with a library on the atlas?"}
              </h3>
              <p
                className="m-0 mt-1 text-[15px] leading-[1.55]"
                style={{ color: T.ink.dim }}
              >
                Search libraries by name, city or entity ref. Verified
                affiliations get a green tick on every contribution record and
                unlock the Verified Librarian badge.
              </p>
            </div>
          </div>
          <LibraryClaimSearch onClaimed={form.setClaimResult} />
        </div>
      ) : form.selectedAffiliation?.showClaim &&
        claimed.length > 0 &&
        form.claimResult === null ? (
        <button
          type="button"
          onClick={() => setClaimAnother(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-full px-4 py-2 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-surface)"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.hi}`,
            color: T.ink.base,
            fontFamily: T.font.sans,
          }}
        >
          <Icon aria-hidden="true" icon="mdi:plus" width={16} />
          Claim another library
        </button>
      ) : null}
    </SectionCard>
  )
}

// ── Interests & languages ─────────────────────────────────────────────────────

export function InterestsSection({ form }: { form: ProfileForm }) {
  const tUi = useUiTranslations("ui")

  const uid = useId()
  const languageId = `${uid}-language`
  const proficiencyId = `${uid}-proficiency`
  const [addingLang, setAddingLang] = useState("")
  const [addingProf, setAddingProf] = useState<Proficiency>("fluent")

  const addLanguage = () => {
    if (!addingLang || form.languages.some((l) => l.code === addingLang)) return
    form.setLanguages((prev) => [
      ...prev,
      { code: addingLang, proficiency: addingProf },
    ])
    setAddingLang("")
  }
  const removeLanguage = (code: string) =>
    form.setLanguages((prev) => prev.filter((l) => l.code !== code))

  return (
    <SectionCard
      id="interests"
      title={tUi("interests_languages")}
      requirement="optional"
      lead="We use these to suggest contribution paths and route translation requests in your direction."
    >
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend style={{ ...fieldLabel, marginBottom: 12 }}>
          Topics you care about
        </legend>
        <InterestsChips
          selected={form.interests}
          onChange={form.setInterests}
          inputStyle={{ ...fieldInput, flex: 1, minWidth: 0 }}
        />
      </fieldset>

      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend style={{ ...fieldLabel, margin: 0 }}>
          Languages you can review in
        </legend>
        <p style={{ ...fieldHint, margin: "4px 0 14px" }}>
          Add each language with how well you know it.
        </p>

        {form.languages.length > 0 ? (
          <ul className="m-0 mb-4 flex list-none flex-wrap gap-2 p-0">
            {form.languages.map((lang) => {
              const name =
                LANGUAGE_OPTIONS.find((l) => l.code === lang.code)?.name ??
                lang.code

              return (
                <li
                  key={lang.code}
                  className="inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3.5 text-[14px] font-semibold"
                  style={{
                    background: T.accent.chip,
                    color: T.accent.primaryHover,
                  }}
                >
                  {name}
                  <span className="font-normal"> · {lang.proficiency}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => removeLanguage(lang.code)}
                    className="ml-0.5 flex size-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent transition-colors hover:bg-(--t-bg-deep)"
                    style={{ color: T.accent.primaryHover }}
                  >
                    <Icon aria-hidden="true" icon="mdi:close" width={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,200px)_auto] sm:items-end">
          <div>
            <label htmlFor={languageId} style={fieldLabel}>
              {tUi("language")}{" "}
            </label>
            <Select
              id={languageId}
              value={addingLang}
              onChange={(e) => setAddingLang(e.target.value)}
            >
              <option value="">Choose a language</option>
              {LANGUAGE_OPTIONS.filter(
                (l) => !form.languages.some((ll) => ll.code === l.code)
              ).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor={proficiencyId} style={fieldLabel}>
              Proficiency
            </label>
            <Select
              id={proficiencyId}
              value={addingProf}
              onChange={(e) => setAddingProf(e.target.value as Proficiency)}
            >
              {PROFICIENCY.map((p) => (
                <option key={p} value={p}>
                  {PROFICIENCY_LABEL[p]}
                </option>
              ))}
            </Select>
          </div>
          <button
            type="button"
            onClick={addLanguage}
            disabled={!addingLang}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-full px-5 text-[15px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: T.bg.deep,
              border: `1px solid ${T.border.hi}`,
              color: T.ink.base,
              fontFamily: T.font.sans,
            }}
          >
            <Icon aria-hidden="true" icon="mdi:plus" width={16} />
            {tUi("add")}
            <span className="sr-only"> language</span>
          </button>
        </div>
      </fieldset>
    </SectionCard>
  )
}

// ── External links ────────────────────────────────────────────────────────────

export function LinksSection({ form }: { form: ProfileForm }) {
  const tUi = useUiTranslations("ui")

  const uid = useId()
  const fields = [
    {
      id: `${uid}-website`,
      label: "Website",
      value: form.website,
      set: form.setWebsite,
      type: "url",
      placeholder: "https://",
    },
    {
      id: `${uid}-orcid`,
      label: "ORCID",
      value: form.orcid,
      set: form.setOrcid,
      type: "text",
      placeholder: "0000-0000-0000-0000",
    },
    {
      id: `${uid}-mastodon`,
      label: "Mastodon / Bluesky",
      value: form.mastodon,
      set: form.setMastodon,
      type: "text",
      placeholder: "@you@mastodon.social",
    },
    {
      id: `${uid}-linkedin`,
      label: "LinkedIn",
      value: form.linkedin,
      set: form.setLinkedin,
      type: "url",
      placeholder: "linkedin.com/in/",
    },
  ]

  return (
    <SectionCard
      id="links"
      title={tUi("external_links")}
      requirement="optional"
      lead="Shown on your public profile. Add only the ones you’re happy to share."
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.id}>
            <label htmlFor={f.id} style={fieldLabel}>
              {f.label}
            </label>
            <input
              id={f.id}
              style={fieldInput}
              type={f.type}
              inputMode={f.type === "url" ? "url" : undefined}
              autoCapitalize="none"
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              placeholder={f.placeholder}
            />
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

// ── Visibility ────────────────────────────────────────────────────────────────

/**
 * Who can see the profile, as radio cards in a group named by `labelledBy`:
 * the Visibility card's title here, the Privacy card's in settings.
 */
export function VisibilityChoice({
  value,
  onChange,
  labelledBy,
  describedBy,
}: {
  value: ProfileForm["visibility"]
  onChange: (v: ProfileForm["visibility"]) => void
  labelledBy: string
  describedBy?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      <VisibilityCards value={value} onChange={onChange} />
    </div>
  )
}

export function VisibilitySection({ form }: { form: ProfileForm }) {
  const tUi = useUiTranslations("ui")

  return (
    <SectionCard
      id="visibility"
      title={tUi("profile_visibility")}
      lead="You can change this any time in Settings. A verified affiliation badge shows either way."
    >
      <VisibilityChoice
        value={form.visibility}
        onChange={form.setVisibility}
        labelledBy="visibility-title"
        describedBy="visibility-lead"
      />
    </SectionCard>
  )
}
