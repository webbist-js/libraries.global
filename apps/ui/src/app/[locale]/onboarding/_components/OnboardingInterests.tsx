"use client"

import { useState } from "react"

import { InterestsChips } from "@/components/settings/InterestsChips"
import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

const LANGUAGE_OPTIONS = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ar", name: "Arabic" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ru", name: "Russian" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "sv", name: "Swedish" },
  { code: "la", name: "Latin" },
  { code: "el", name: "Greek" },
]

const PROFICIENCY = ["native", "fluent", "conversational"] as const

type LanguageEntry = {
  code: string
  proficiency: "native" | "fluent" | "conversational"
}

export function OnboardingInterests({
  initialProfile,
  saving,
  onNext,
  onSkip,
}: {
  initialProfile: UserProfile | null
  saving: boolean
  onNext: (data: Record<string, unknown>) => void
  onSkip: () => void
}) {
  const [interests, setInterests] = useState<string[]>(
    initialProfile?.interests?.map((i) => i.documentId) ?? []
  )
  const [languages, setLanguages] = useState<LanguageEntry[]>(
    (initialProfile?.languages as LanguageEntry[] | undefined) ?? []
  )
  const [addingLang, setAddingLang] = useState("")
  const [addingProf, setAddingProf] = useState<
    "native" | "fluent" | "conversational"
  >("fluent")

  const inputStyle = {
    padding: "8px 12px",
    borderRadius: "6px",
    border: `1px solid ${T.border.hi}`,
    background: "rgba(255,255,255,0.04)",
    color: T.ink.base,
    fontSize: "13px",
    fontFamily: "Roboto, sans-serif",
    outline: "none",
  }

  const addLanguage = () => {
    if (!addingLang || languages.some((l) => l.code === addingLang)) return
    setLanguages((prev) => [
      ...prev,
      { code: addingLang, proficiency: addingProf },
    ])
    setAddingLang("")
  }

  const removeLanguage = (code: string) => {
    setLanguages((prev) => prev.filter((l) => l.code !== code))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "28px",
            fontWeight: 700,
            fontFamily: "Fraunces, serif",
            color: T.ink.base,
          }}
        >
          Interests &amp; languages
        </h1>
        <p style={{ margin: 0, fontSize: "14px", color: T.ink.faint }}>
          Help us connect you with relevant libraries, collections, and
          contributors.
        </p>
      </div>

      <div>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "13px",
            fontWeight: 600,
            color: T.ink.dim,
          }}
        >
          Interests
        </p>
        <InterestsChips selected={interests} onChange={setInterests} />
      </div>

      <div>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "13px",
            fontWeight: 600,
            color: T.ink.dim,
          }}
        >
          Languages
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          {languages.map((lang) => {
            const name =
              LANGUAGE_OPTIONS.find((l) => l.code === lang.code)?.name ??
              lang.code

            return (
              <span
                key={lang.code}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  border: "1px solid rgba(127,223,255,0.3)",
                  background: "rgba(127,223,255,0.06)",
                  color: T.accent.aurora,
                  fontSize: "12px",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                {name} · {lang.proficiency}
                <button
                  type="button"
                  onClick={() => removeLanguage(lang.code)}
                  style={{
                    background: "none",
                    border: "none",
                    color: T.ink.faint,
                    cursor: "pointer",
                    padding: 0,
                    lineHeight: 1,
                    fontSize: "14px",
                  }}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select
            style={inputStyle}
            value={addingLang}
            onChange={(e) => setAddingLang(e.target.value)}
          >
            <option value="" style={{ background: "#070b1e" }}>
              Add language…
            </option>
            {LANGUAGE_OPTIONS.filter(
              (l) => !languages.some((ll) => ll.code === l.code)
            ).map((l) => (
              <option
                key={l.code}
                value={l.code}
                style={{ background: "#070b1e" }}
              >
                {l.name}
              </option>
            ))}
          </select>
          <select
            style={inputStyle}
            value={addingProf}
            onChange={(e) => setAddingProf(e.target.value as typeof addingProf)}
          >
            {PROFICIENCY.map((p) => (
              <option key={p} value={p} style={{ background: "#070b1e" }}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addLanguage}
            disabled={!addingLang}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: `1px solid ${T.border.hi}`,
              background: "rgba(255,255,255,0.05)",
              color: T.ink.dim,
              fontSize: "12px",
              cursor: addingLang ? "pointer" : "not-allowed",
              opacity: addingLang ? 1 : 0.5,
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: "8px",
        }}
      >
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            color: T.ink.faint,
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: "Roboto, sans-serif",
          }}
        >
          Skip for now
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onNext({ interests, languages })}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            background: T.ink.base,
            color: "#030511",
            fontSize: "13px",
            fontFamily: "Roboto, sans-serif",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  )
}
