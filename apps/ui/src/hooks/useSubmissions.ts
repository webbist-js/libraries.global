"use client"

import { useMutation, useQuery } from "@tanstack/react-query"

import { getEnvVar } from "@/lib/env-vars"

export interface Submission {
  documentId: string
  submissionType:
    | "correction"
    | "new_library"
    | "library_claim"
    | "wiki_edit"
    | "blog_submission"
  status: "pending" | "approved" | "rejected" | "needs_info"
  targetEntityType?: string | null
  targetDocumentId?: string | null
  targetSlug?: string | null
  fields?: Record<string, unknown> | null
  note?: string | null
  reviewNote?: string | null
  createdAt: string
  reviewedAt?: string | null
}

export interface CreateSubmissionPayload {
  submissionType: Submission["submissionType"]
  targetEntityType?: string
  targetDocumentId?: string
  targetSlug?: string
  fields?: Record<string, unknown>
  note?: string
}

async function apiFetch(path: string, init?: RequestInit) {
  const strapiUrl = getEnvVar("NEXT_PUBLIC_STRAPI_URL") ?? ""
  const res = await fetch(`${strapiUrl}/api/content-moderation${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    credentials: "include",
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)

  return res.json()
}

export function useMySubmissions() {
  return useQuery({
    queryKey: ["my-submissions"],
    queryFn: async () => {
      const json = await apiFetch("/submissions/my")

      return json.data as Submission[]
    },
    enabled: false, // caller controls when to fetch
  })
}

export function useCreateSubmission() {
  return useMutation({
    mutationFn: async (payload: CreateSubmissionPayload) => {
      const json = await apiFetch("/submissions", {
        method: "POST",
        body: JSON.stringify(payload),
      })

      return json.data as Submission
    },
  })
}
