"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import { ProfileFollowButton } from "@/app/[locale]/profile/[username]/_components/ProfileFollowButton"
import { useCapabilities, useHydratedSession } from "@/lib/access-client"
import { articleReaderPath } from "@/lib/article-content-language"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"
import { useJournalOwnership } from "@/lib/use-journal-ownership"

export function ArticleReaderActions({
  kind,
  slug,
  path,
  contentLocale,
  interfaceLocale,
  availableLocales = [],
  authorUsername,
}: {
  kind: "journal" | "knowledge"
  slug: string
  path: string
  contentLocale: string
  interfaceLocale: string
  availableLocales?: readonly string[]
  authorUsername?: string | null
}) {
  const t = useTranslations("publishing")
  const actor = useHydratedSession()
  const caps = useCapabilities()
  const signedIn = !actor.isPending && !actor.error && Boolean(actor.data?.user)
  const [translationOpen, setTranslationOpen] = useState(false)
  const [languages, setLanguages] = useState<{ code: string; name: string }[]>(
    []
  )
  const [targetLanguage, setTargetLanguage] = useState("")
  const [languageFailed, setLanguageFailed] = useState(false)
  const loadLanguages = async () => {
    setTranslationOpen(true)
    setLanguageFailed(false)
    try {
      const response = await fetch("/api/relations/locales")
      if (!response.ok) throw new Error("Languages unavailable")
      const json = (await response.json()) as {
        data?: { code: string; name: string }[]
      }
      if (!json.data?.length) throw new Error("Languages unavailable")
      setLanguages(
        json.data.filter(
          (language) =>
            language.code !== contentLocale &&
            !availableLocales.includes(language.code)
        )
      )
    } catch {
      setLanguageFailed(true)
    }
  }
  const direct =
    signedIn &&
    caps.ready &&
    caps.canDirectEdit(kind === "journal" ? "journal" : "docs", contentLocale)
  const ownership = useJournalOwnership(
    kind === "journal" && !direct ? [slug] : []
  )
  const ownJournal = signedIn && ownership.eligibility[slug] === true
  const edit = `/contribute/knowledge/${kind === "journal" ? "journal/" : ""}${encodeURIComponent(slug)}`
  const improve = `${edit}?mode=${direct ? "edit" : "report"}&locale=${encodeURIComponent(contentLocale)}&sourceLocale=${encodeURIComponent(contentLocale)}`

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      {availableLocales
        .filter((language) => language !== contentLocale)
        .map((language) => (
          <Link
            key={language}
            href={articleReaderPath(path, interfaceLocale, language)}
            className="underline underline-offset-4"
          >
            {t("alsoLanguage", {
              language: languageName(language, [], interfaceLocale),
            })}
          </Link>
        ))}
      {kind === "knowledge" && (
        <>
          <Link
            href={
              signedIn
                ? improve
                : `/auth/signin?callbackUrl=${encodeURIComponent(improve)}`
            }
            className="rounded-full border px-3 py-2 font-semibold"
          >
            {t("suggestImprovement")}
          </Link>
          <button
            type="button"
            onClick={() => void loadLanguages()}
            className="underline underline-offset-4"
          >
            {t("addTranslation")}
          </button>
          {translationOpen && (
            <span className="flex flex-wrap items-center gap-2">
              {languageFailed ? (
                <button
                  type="button"
                  onClick={() => void loadLanguages()}
                  className="underline"
                >
                  {t("languageFailed")}
                </button>
              ) : (
                <label>
                  {t("chooseTranslation")}{" "}
                  <select
                    value={targetLanguage}
                    onChange={(event) => setTargetLanguage(event.target.value)}
                    className="rounded-lg border p-2"
                  >
                    <option value="">—</option>
                    {languages.map((language) => (
                      <option key={language.code} value={language.code}>
                        {languageName(
                          language.code,
                          languages,
                          interfaceLocale
                        )}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {targetLanguage && (
                <Link
                  className="rounded-full border px-3 py-2"
                  href={
                    signedIn
                      ? caps.canDirectEdit("docs", targetLanguage)
                        ? `${edit}?locale=${encodeURIComponent(targetLanguage)}&sourceLocale=${encodeURIComponent(contentLocale)}&mode=edit`
                        : "/contribute/knowledge/apply?role=wiki_editor"
                      : `/auth/signin?callbackUrl=${encodeURIComponent(`/contribute/knowledge/apply?role=wiki_editor`)}`
                  }
                >
                  {t("addTranslation")}
                </Link>
              )}
            </span>
          )}
        </>
      )}
      {kind === "journal" && (direct || ownJournal) && (
        <Link
          href={`${edit}?locale=${encodeURIComponent(contentLocale)}&sourceLocale=${encodeURIComponent(contentLocale)}`}
          className="underline"
        >
          {ownJournal ? t("editYourStory") : t("suggestImprovement")}
        </Link>
      )}
      {kind === "journal" && signedIn && ownership.failed && (
        <button type="button" onClick={ownership.retry} className="underline">
          {t("ownershipRetry")}
        </button>
      )}
      <a href="#article-discussion" className="underline underline-offset-4">
        {t("discuss")}
      </a>
      {kind === "journal" &&
        authorUsername &&
        !ownJournal &&
        actor.data?.user?.username !== authorUsername && (
          <ProfileFollowButton
            targetUsername={authorUsername}
            isSignedIn={signedIn}
            compact
          />
        )}
    </div>
  )
}
