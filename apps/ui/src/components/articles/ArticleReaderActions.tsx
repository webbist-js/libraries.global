"use client"

import { Icon } from "@iconify/react"
import { isSupportedLocale } from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useState, type MouseEvent } from "react"

import { ProfileFollowButton } from "@/app/[locale]/profile/[username]/_components/ProfileFollowButton"
import { SelectField } from "@/components/ds/SelectField"
import { useCapabilities, useHydratedSession } from "@/lib/access-client"
import { articleReaderPath } from "@/lib/article-content-language"
import { requestArticleDiscussion } from "@/lib/discussion-composer"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"
import { useJournalOwnership } from "@/lib/use-journal-ownership"

function handleDiscuss(event: MouseEvent<HTMLAnchorElement>) {
  if (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    requestArticleDiscussion()
  )
    event.preventDefault()
}

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
  const [languageLoading, setLanguageLoading] = useState(false)
  const loadLanguages = async () => {
    setTranslationOpen(true)
    setLanguageFailed(false)
    setLanguageLoading(true)
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
            isSupportedLocale(language.code) &&
            language.code !== contentLocale &&
            !availableLocales.includes(language.code)
        )
      )
    } catch {
      setLanguageFailed(true)
    } finally {
      setLanguageLoading(false)
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
    <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-(--t-divider) py-3 text-xs">
      <span
        className="rounded-full bg-(--t-bg-inverse) px-2.5 py-1.5 font-semibold text-white"
        aria-current="true"
      >
        {languageName(contentLocale, [], interfaceLocale)}
      </span>
      {availableLocales
        .filter(
          (language) =>
            isSupportedLocale(language) && language !== contentLocale
        )
        .map((language) => (
          <Link
            key={language}
            href={articleReaderPath(path, interfaceLocale, language)}
            className="inline-flex min-h-9 items-center rounded-full bg-(--t-bg-muted) px-2.5 font-semibold text-(--t-ink-dim) hover:bg-(--t-accent-chip)"
            aria-label={t("alsoLanguage", {
              language: languageName(language, [], interfaceLocale),
            })}
          >
            {languageName(language, [], interfaceLocale)}
          </Link>
        ))}
      {kind === "knowledge" && (
        <>
          <button
            type="button"
            onClick={() =>
              translationOpen ? setTranslationOpen(false) : void loadLanguages()
            }
            aria-expanded={translationOpen}
            className="inline-flex min-h-10 cursor-pointer items-center text-(--t-accent-primary) underline underline-offset-4"
          >
            {t("addTranslation")}
          </button>
          {translationOpen && (
            <span
              className="order-last flex w-full flex-wrap items-center gap-3 rounded-xl bg-(--t-bg-surface) p-3"
              aria-live="polite"
            >
              {languageLoading ? (
                <span>{t("loadingLanguages")}</span>
              ) : languageFailed ? (
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
                  <SelectField
                    value={String(targetLanguage ?? "")}
                    onValueChange={(selectedValue) =>
                      setTargetLanguage(selectedValue)
                    }
                    className="rounded-lg border p-2"
                    options={[
                      { value: "", label: "—" },
                      ...languages.map((language) => ({
                        value: String(language.code),
                        label: String(
                          languageName(
                            language.code,
                            languages,
                            interfaceLocale
                          )
                        ),
                      })),
                    ]}
                  />
                </label>
              )}
              {!languageLoading && targetLanguage && (
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
          <Link
            href={
              signedIn
                ? improve
                : `/auth/signin?callbackUrl=${encodeURIComponent(improve)}`
            }
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-(--t-accent-primary) px-3 py-2 font-semibold text-(--t-accent-primary) transition-colors hover:bg-(--t-accent-chip) sm:ml-auto"
          >
            <Icon aria-hidden="true" icon="mdi:pencil-outline" width={14} />
            {t("suggestImprovement")}
          </Link>
        </>
      )}
      {kind === "journal" && (direct || ownJournal) && (
        <Link
          href={`${edit}?locale=${encodeURIComponent(contentLocale)}&sourceLocale=${encodeURIComponent(contentLocale)}`}
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-(--t-accent-primary) px-3 py-2 font-semibold text-(--t-accent-primary) hover:bg-(--t-accent-chip) sm:ml-auto"
        >
          {ownJournal ? t("editYourStory") : t("suggestImprovement")}
        </Link>
      )}
      {kind === "journal" && signedIn && ownership.failed && (
        <button type="button" onClick={ownership.retry} className="underline">
          {t("ownershipRetry")}
        </button>
      )}
      <a
        href="#article-discussion"
        onClick={handleDiscuss}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-(--t-border-line) px-3 py-2 font-semibold transition-colors hover:bg-(--t-bg-muted)"
      >
        <Icon aria-hidden="true" icon="mdi:message-outline" width={14} />
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
