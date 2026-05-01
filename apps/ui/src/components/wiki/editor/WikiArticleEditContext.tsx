"use client"

import { useSearchParams } from "next/navigation"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

type WikiEditContextValue = {
  editMode: boolean
  canEdit: boolean
  submissionId: number | undefined
  editSummary: string
  setEditMode: (v: boolean) => void
  setSubmissionId: (id: number) => void
  setEditSummary: (s: string) => void
  handleFinalize: () => Promise<void>
}

const WikiEditContext = createContext<WikiEditContextValue | null>(null)

export function WikiArticleEditProvider({
  slug,
  children,
}: {
  readonly slug: string
  readonly children: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const [editMode, setEditMode] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [submissionId, setSubmissionId] = useState<number | undefined>(
    undefined
  )
  const [editSummary, setEditSummary] = useState("")

  useEffect(() => {
    fetch("/api/profile/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const profile = data.data as Record<string, unknown> | undefined
        const role = profile?.contributorRole as string | undefined
        if (role === "wiki_editor" || role === "editorial_board") {
          setCanEdit(true)
          if (searchParams.get("edit") === "true") setEditMode(true)
        }
      })
      .catch(() => {})
  }, [searchParams])

  useEffect(() => {
    if (!editMode || !slug) return
    fetch(`/api/contribute/wiki/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.submissionId) setSubmissionId(data.submissionId as number)
      })
      .catch(() => {})
  }, [editMode, slug])

  const handleFinalize = useCallback(async () => {
    if (!submissionId) return
    const res = await fetch(`/api/contribute/wiki/${slug}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    })
    if (!res.ok) throw new Error("Finalize failed")
  }, [slug, submissionId])

  const value = useMemo(
    () => ({
      editMode,
      canEdit,
      submissionId,
      editSummary,
      setEditMode,
      setSubmissionId,
      setEditSummary,
      handleFinalize,
    }),
    [editMode, canEdit, submissionId, editSummary, handleFinalize]
  )

  return (
    <WikiEditContext.Provider value={value}>
      {children}
    </WikiEditContext.Provider>
  )
}

export function useWikiEdit() {
  const ctx = useContext(WikiEditContext)
  if (!ctx)
    throw new Error("useWikiEdit must be used within WikiArticleEditProvider")

  return ctx
}
