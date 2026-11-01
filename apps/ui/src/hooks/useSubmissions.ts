"use client"

import type { SubmissionType } from "@repo/access"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useHydratedSession } from "@/lib/access-client"
import { captureWorkspaceRouteAction } from "@/lib/workspace-analytics"

export interface Submission {
  documentId: string
  locale?: string | null
  submissionType: SubmissionType
  status: "draft" | "pending" | "approved" | "rejected" | "needs_info"
  targetEntityType?: string | null
  targetDocumentId?: string | null
  targetSlug?: string | null
  /** The library's name or article's title, resolved by Strapi. */
  targetLabel?: string | null
  fields?: Record<string, unknown> | null
  note?: string | null
  reviewNote?: string | null
  createdAt: string
  updatedAt: string
  reviewedAt?: string | null
  draftData?: Record<string, unknown> | null
  stepCompleted?: number | null
  editSummary?: string | null
  evidenceType?: string | null
  evidenceUrl?: string | null
  /** The Drive this change is tagged to, when it's part of one. */
  drive?: { documentId: string; slug: string; title: string } | null
}

export interface CreateSubmissionPayload {
  submissionType: Submission["submissionType"]
  targetEntityType?: string
  targetDocumentId?: string
  targetSlug?: string
  fields?: Record<string, unknown>
  draftData?: Record<string, unknown>
  note?: string
  editSummary?: string
  evidenceType?: string
  evidenceUrl?: string
  /** When true, creates with status "draft" — invisible to the moderation queue until finalized */
  asDraft?: boolean
  /** Staff creation intent; Strapi verifies access before storing it. */
  staffCreation?: { teamDocumentId: string | null }
}

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api/submissions${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)

  return res.json()
}

export function useMySubmissions() {
  const { data: session, isPending } = useHydratedSession()
  const userId = !isPending ? session?.user?.id : undefined
  const query = useQuery({
    queryKey: ["my-submissions", userId ?? null],
    queryFn: async ({ signal }) => {
      // Callers may refetch a disabled query while their session is hydrating.
      if (!userId) return []
      const json = await apiFetch("/my", { cache: "no-store", signal })

      return json.data as Submission[]
    },
    enabled: Boolean(userId),
  })

  return {
    ...query,
    data: userId ? query.data : undefined,
    isLoading: isPending || query.isLoading,
  }
}

export function useCreateSubmission() {
  const client = useQueryClient()

  return useMutation({
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["my-submissions"] })
      client.invalidateQueries({ queryKey: ["draft"] })
    },
    mutationFn: async (payload: CreateSubmissionPayload) => {
      const measured = payload.asDraft
        ? () => false
        : captureWorkspaceRouteAction("submit")
      try {
        const json = await apiFetch("", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        measured("success")

        return json.data as Submission
      } catch (error) {
        measured("error")
        throw error
      }
    },
  })
}

export function useSaveDraft() {
  const client = useQueryClient()

  return useMutation({
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["my-submissions"] })
      client.invalidateQueries({ queryKey: ["draft"] })
    },
    mutationFn: async ({
      id,
      draftData,
      stepCompleted,
    }: {
      id: string
      draftData: Record<string, unknown>
      stepCompleted: number
    }) => {
      const res = await fetch(`/api/submissions/${id}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftData, stepCompleted }),
      })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)

      return res.json()
    },
  })
}

export function useFinalizeDraft() {
  const client = useQueryClient()

  return useMutation({
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["my-submissions"] })
      client.invalidateQueries({ queryKey: ["draft"] })
    },
    mutationFn: async ({
      id,
      formData,
    }: {
      id: string
      formData: Record<string, unknown>
    }) => {
      const measured = captureWorkspaceRouteAction("submit")
      try {
        const res = await fetch(`/api/submissions/${id}/finalize`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const json = await res.json()
        measured("success")

        return json.data as Submission
      } catch (error) {
        measured("error")
        throw error
      }
    },
  })
}

/**
 * The draft lookup URL. `locale` (translation mode only) asks for that
 * locale's draft; without it Strapi returns the default locale's.
 */
export function resumeDraftUrl(
  type: string,
  targetSlug: string | undefined,
  locale: string | undefined,
  origin: string,
  staffCreation = false
): string {
  const url = new URL(`/api/submissions/draft/${type}`, origin)
  if (targetSlug) url.searchParams.set("targetSlug", targetSlug)
  if (locale) url.searchParams.set("locale", locale)
  if (staffCreation) url.searchParams.set("staffCreation", "true")

  return url.toString()
}

export function useResumeDraft(
  type: string,
  targetSlug?: string,
  locale?: string,
  staffCreation = false
) {
  const { data: session, isPending } = useHydratedSession()
  const userId = !isPending ? session?.user?.id : undefined

  return useQuery({
    queryKey: [
      "draft",
      userId ?? null,
      type,
      targetSlug,
      locale ?? null,
      staffCreation,
    ],
    queryFn: async ({ signal }) => {
      if (!userId) return null
      const res = await fetch(
        resumeDraftUrl(
          type,
          targetSlug,
          locale,
          window.location.origin,
          staffCreation
        ),
        { cache: "no-store", signal }
      )
      if (!res.ok) return null
      const json = await res.json()

      return (json.data ?? null) as Submission | null
    },
    enabled: Boolean(userId && type),
  })
}
