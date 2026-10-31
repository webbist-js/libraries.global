"use client"

import { useEffect, useState } from "react"

import { RecordChangesTable } from "@/components/moderation/RecordChangesTable"

/** Reuse the same before/after rendering the reviewer sees, without decisions. */
export function LibraryContributionReview({
  fields,
}: {
  readonly fields: Record<string, unknown>
}) {
  const [names, setNames] = useState<Record<string, string>>({})
  const relations = ["services", "amenities", "accessibility"]
    .filter((key) => key in fields)
    .join(",")
  useEffect(() => {
    const abort = new AbortController()
    Promise.all(
      relations
        .split(",")
        .filter(Boolean)
        .map(async (key) => {
          const response = await fetch(`/api/relations/${key}`, {
            signal: abort.signal,
          })
          if (!response.ok) return []

          return (await response.json()).data as {
            documentId: string
            name: string
          }[]
        })
    )
      .then((groups) => {
        if (!abort.signal.aborted)
          setNames(
            Object.fromEntries(
              groups.flat().map((option) => [option.documentId, option.name])
            )
          )
      })
      .catch(() => {})

    return () => abort.abort()
  }, [relations])

  return (
    <div className="mb-5">
      <RecordChangesTable
        audience="contributor"
        submissionType="correction"
        fields={fields}
        review={{ current: fields.previous ?? {}, names }}
      />
    </div>
  )
}
