"use client"

import { useEffect, useState } from "react"

import { useHydratedSession } from "@/lib/access-client"

type OwnershipResult = {
  scope: string
  eligibility: Record<string, boolean>
  failed: boolean
}
const NO_SLUGS: readonly string[] = []

/** Ownership is private capability metadata, never inferred from the public byline. */
export function useJournalOwnership(slugs: readonly string[] = NO_SLUGS) {
  const actor = useHydratedSession()
  const actorId =
    !actor.isPending && !actor.error ? actor.data?.user?.id : undefined
  const encoded = [...new Set(slugs)]
    .filter((slug) => /^[a-z0-9-]{1,120}$/.test(slug))
    // The configured TypeScript library does not expose ES2023 toSorted. This is a fresh array.

    .sort((left, right) => left.localeCompare(right))
    .slice(0, 24)
    .join(",")
  const scope = actorId && encoded ? `${actorId}:${encoded}` : null
  const [result, setResult] = useState<OwnershipResult | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!scope) return
    const controller = new AbortController()
    const query = new URLSearchParams()
    for (const slug of encoded.split(",")) query.append("slug", slug)
    fetch(`/api/contribute/journal-ownership?${query}`, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Ownership unavailable")
        const json = (await response.json()) as {
          data?: { eligibility?: Record<string, unknown> }
        }
        const eligibility: Record<string, boolean> = {}
        for (const slug of encoded.split(",")) {
          if (typeof json.data?.eligibility?.[slug] !== "boolean")
            throw new Error("Invalid ownership result")
          eligibility[slug] = json.data.eligibility[slug]
        }
        if (!controller.signal.aborted)
          setResult({ scope, eligibility, failed: false })
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ scope, eligibility: {}, failed: true })
      })

    return () => controller.abort()
  }, [scope, encoded, retry])
  const current = scope && result?.scope === scope ? result : null

  return {
    eligibility: current?.eligibility ?? {},
    loading: Boolean(scope && !current),
    failed: Boolean(current?.failed),
    retry: () => setRetry((value) => value + 1),
  }
}
