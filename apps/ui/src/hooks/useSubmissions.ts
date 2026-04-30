"use client"

import { useMutation, useQuery } from "@tanstack/react-query"

export interface Submission {
  documentId: string
  submissionType:
    | "correction"
    | "new_library"
    | "library_claim"
    | "library_edit"
    | "wiki_edit"
    | "blog_submission"
    | "topic_suggestion"
  status: "draft" | "pending" | "approved" | "rejected" | "needs_info"
  targetEntityType?: string | null
  targetDocumentId?: string | null
  targetSlug?: string | null
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
}

export interface CreateSubmissionPayload {
  submissionType: Submission["submissionType"]
  targetEntityType?: string
  targetDocumentId?: string
  targetSlug?: string
  fields?: Record<string, unknown>
  note?: string
  editSummary?: string
  evidenceType?: string
  evidenceUrl?: string
  /** When true, creates with status "draft" — invisible to the moderation queue until finalized */
  asDraft?: boolean
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
  return useQuery({
    queryKey: ["my-submissions"],
    queryFn: async () => {
      const json = await apiFetch("/my")

      return json.data as Submission[]
    },
  })
}

export function useCreateSubmission() {
  return useMutation({
    mutationFn: async (payload: CreateSubmissionPayload) => {
      const json = await apiFetch("", {
        method: "POST",
        body: JSON.stringify(payload),
      })

      return json.data as Submission
    },
  })
}

export function useSaveDraft() {
  return useMutation({
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
  return useMutation({
    mutationFn: async ({
      id,
      formData,
    }: {
      id: string
      formData: Record<string, unknown>
    }) => {
      const res = await fetch(`/api/submissions/${id}/finalize`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const json = await res.json()

      return json.data as Submission
    },
  })
}

export function useResumeDraft(type: string, targetSlug?: string) {
  return useQuery({
    queryKey: ["draft", type, targetSlug],
    queryFn: async () => {
      const url = new URL(
        `/api/submissions/draft/${type}`,
        window.location.origin
      )
      if (targetSlug) url.searchParams.set("targetSlug", targetSlug)
      const res = await fetch(url.toString())
      if (!res.ok) return null
      const json = await res.json()

      return (json.data ?? null) as Submission | null
    },
    enabled: !!type,
  })
}
