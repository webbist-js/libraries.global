"use client"

import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { DiscussionListSkeleton } from "@/components/discussions/DiscussionSkeleton"
import { SelectField } from "@/components/ds/SelectField"
import { languageName } from "@/lib/locale-fallback"

import {
  discussionRequest,
  type DiscussionList,
  type DiscussionRecord,
} from "./api"

/** Only the server's readable, published thread catalogue can be selected. */
export function DiscussionLinkPicker({
  selected = [],
  onSelect,
  disabled = false,
  defaultLanguage,
}: {
  selected?: readonly string[]
  onSelect: (thread: DiscussionRecord) => void
  disabled?: boolean
  defaultLanguage?: string
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const [query, setQuery] = useState("")
  const [mine, setMine] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)
  const language = selectedLanguage ?? defaultLanguage ?? locale
  const [languages, setLanguages] = useState<{ code: string; name: string }[]>(
    []
  )
  const current = useRef("")
  useEffect(() => {
    let cancelled = false
    fetch("/api/relations/locales", { cache: "no-store" })
      .then(async (response) =>
        response.ok ? ((await response.json()).data ?? []) : []
      )
      .then((choices) => {
        if (!cancelled) setLanguages(choices)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])
  const [records, setRecords] = useState<DiscussionRecord[]>([])
  const [offset, setOffset] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [resolved, setResolved] = useState("")
  const search = new URLSearchParams({
    limit: "10",
    ...(query ? { q: query } : {}),
    ...(mine ? { mine: "1" } : {}),
    ...(language ? { language } : {}),
  }).toString()
  current.current = search
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      setFailed(false)
      discussionRequest<DiscussionList<DiscussionRecord>>(`threads?${search}`)
        .then((result) => {
          if (cancelled) return
          setRecords(result.data)
          setOffset(result.nextOffset ?? null)
          setResolved(search)
        })
        .catch(() => {
          if (!cancelled) {
            setRecords([])
            setFailed(true)
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search])

  return (
    <div className="grid gap-3">
      <input
        aria-label={t("searchConversations")}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        maxLength={180}
        placeholder={t("searchConversations")}
        className="w-full rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) p-3 text-sm"
      />
      <SelectField
        label={t("conversationCatalogue")}
        value={mine ? "mine" : "all"}
        onValueChange={(value) => setMine(value === "mine")}
        options={[
          { value: "all", label: t("allPublishedConversations") },
          { value: "mine", label: t("myConversations") },
        ]}
      />
      <SelectField
        label={t("language")}
        value={language}
        onValueChange={setSelectedLanguage}
        options={[
          { value: "", label: t("allLanguages") },
          ...[...new Set([...languages.map((item) => item.code), language])]
            .filter(Boolean)
            .map((code) => ({
              value: code,
              label: languageName(code, languages, locale),
            })),
        ]}
      />
      {failed ? (
        <p role="alert">{t("error")}</p>
      ) : loading || resolved !== search ? (
        <DiscussionListSkeleton variant="picker" />
      ) : (
        <>
          <ul className="m-0 grid list-none gap-2 p-0">
            {records.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  disabled={disabled || selected.includes(thread.id)}
                  onClick={() => onSelect(thread)}
                  className="w-full rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) p-3 text-left text-sm disabled:opacity-50"
                >
                  <span className="block font-semibold">{thread.title}</span>
                  <span className="text-xs text-(--t-ink-dim)">
                    {thread.author?.name} · {thread.language}
                    {selected.includes(thread.id) ? ` · ${t("linked")}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!records.length && <p>{t("empty")}</p>}
          {offset !== null && (
            <button
              type="button"
              className="justify-self-start text-sm underline"
              onClick={async () => {
                setLoading(true)
                try {
                  const result = await discussionRequest<
                    DiscussionList<DiscussionRecord>
                  >(`threads?${search}&offset=${offset}`)
                  if (current.current !== search) return
                  setRecords((previous) => [...previous, ...result.data])
                  setOffset(result.nextOffset ?? null)
                } catch {
                  if (current.current === search) setFailed(true)
                } finally {
                  if (current.current === search) setLoading(false)
                }
              }}
            >
              {t("loadMore")}
            </button>
          )}
        </>
      )}
    </div>
  )
}
