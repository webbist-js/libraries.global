"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import { SearchField } from "@/components/ds"
import { analyticsAttributes } from "@/lib/analytics-events"
import { useRouter } from "@/lib/navigation"

import {
  journalHref,
  DEFAULT_JOURNAL_QUERY,
  type JournalQuery,
} from "./journalLanding.helpers"

/** Search shares the browse query so relation/language filters and counts stay aligned. */
export function BlogSearchBar({
  inputId,
  initialQuery = "",
  currentQuery = DEFAULT_JOURNAL_QUERY,
}: {
  inputId?: string
  initialQuery?: string
  currentQuery?: JournalQuery
}) {
  const t = useTranslations("ui")
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        router.push(journalHref(currentQuery, { q: query.trim(), page: 1 }))
      }}
      {...analyticsAttributes("search", {
        interaction_source: "article",
        search_type: "journal",
      })}
    >
      <SearchField
        id={inputId ?? "blog-search"}
        label={t("search_articles_authors_or_topics")}
        placeholder={t("search_articles_authors_or_topics")}
        onClear={() => {
          setQuery("")
          router.push(journalHref(currentQuery, { q: "", page: 1 }))
        }}
        inputProps={{
          name: "q",
          value: query,
          maxLength: 120,
          onChange: (event) => setQuery(event.target.value),
          autoComplete: "off",
        }}
      />
    </form>
  )
}
