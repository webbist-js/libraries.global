"use client"

import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { SelectField } from "@/components/ds/SelectField"

import { discussionRequest, type DiscussionTarget } from "./api"

export function DiscussionContextFilter({
  type = "",
  id = "",
  onChange,
}: {
  type?: string
  id?: string
  onChange: (value: {
    contextType: string
    contextId: string
    contextLocale?: string
  }) => void
}) {
  const t = useTranslations("discussions")
  const [choices, setChoices] = useState<
    { target: DiscussionTarget; title: string }[]
  >([])
  const [search, setSearch] = useState("")
  const [failed, setFailed] = useState(false)
  const [resolved, setResolved] = useState("")
  const key = `${type}:${search}`
  useEffect(() => {
    if (!type) return
    let cancelled = false
    const timer = setTimeout(() => {
      discussionRequest<{ data: typeof choices }>(
        `contexts?${new URLSearchParams({ contextType: type, ...(search ? { q: search } : {}) })}`
      )
        .then((result) => {
          if (!cancelled) {
            setChoices(result.data)
            setFailed(false)
            setResolved(key)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setChoices([])
            setFailed(true)
            setResolved(key)
          }
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [type, search, key])

  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <SelectField
        label={t("contextFilter")}
        value={type}
        onValueChange={(value) => {
          setSearch("")
          onChange({ contextType: value, contextId: "", contextLocale: "" })
        }}
        className="w-auto rounded-full"
        options={[
          { value: "", label: t("allContexts") },
          { value: "libraries", label: t("libraryConversations") },
          { value: "drives", label: t("driveConversations") },
        ]}
      />
      {type && (
        <>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t("findContext")}
            placeholder={t("findContext")}
            maxLength={180}
            className="min-w-40 flex-1 rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-4 py-3 text-sm"
          />
          <SelectField
            label={t("specificContext")}
            value={id}
            onValueChange={(contextId) =>
              onChange({
                contextType: type,
                contextId,
                contextLocale:
                  choices.find((item) => item.target.documentId === contextId)
                    ?.target.locale ?? "",
              })
            }
            className="w-auto rounded-full"
            options={[
              { value: "", label: t("allContexts") },
              ...(resolved === key ? choices : []).map((item) => ({
                value: item.target.documentId,
                label: item.title,
              })),
              ...(id &&
              (resolved !== key ||
                !choices.some((item) => item.target.documentId === id))
                ? [{ value: id, label: t("selectedContext") }]
                : []),
            ]}
          />
          {failed && resolved === key && (
            <span role="alert" className="text-xs">
              {t("error")}
            </span>
          )}
        </>
      )}
    </div>
  )
}
